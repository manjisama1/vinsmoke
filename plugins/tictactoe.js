import { Command, Listen } from '../lib/index.js';

const db = new Map();
const icons = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
const win = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

const head = (s) => `╭──【 𝐓𝐈𝐂 𝐓𝐀𝐂 𝐓𝐎𝐄 】──\n│👤P1: @${s.p1.split('@')[0]} (${s.sym[s.p1]})\n│👤P2: ${s.p2 ? `@${s.p2.split('@')[0]} (${s.sym[s.p2]})` : 'Waiting...'}\n├─────────────`;

const board = (b) => {
    let out = '\n│           ';
    for (let i = 0; i < 9; i++) {
        out += (b[i] === 'X' ? '❌' : b[i] === 'O' ? '⭕' : icons[i]);
        if ((i + 1) % 3 === 0 && i !== 8) out += '\n│           ';
    }
    return out + '\n│';
};

const judge = (b) => {
    const res = win.find(([a, c, d]) => b[a] && b[a] === b[c] && b[a] === b[d]);
    return res ? b[res[0]] : b.every(v => v) ? 'draw' : null;
};



Command({
    pattern: 'tictatoe',
    aliases: ['ttt'],
    desc: 'Play TicTacToe with friends',
    type: 'game'
}, async (message) => {
    if (db.has(message.chat)) return await message.send('A game is already running in this chat.');

    let p1 = message.lid, p2 = null;
    const mentions = message.mention || [];

    if (mentions.length >= 2) [p1, p2] = [mentions[0], mentions[1]];
    else if (mentions.length === 1) p2 = mentions[0];
    else if (message.quoted?.lid) p2 = message.quoted.lid;

    const syms = Math.random() > 0.5 ? ['⭕', '❌'] : ['❌', '⭕'];
    const s = { p1, p2, grid: Array(9).fill(null), state: p2 ? 'play' : 'wait', sym: { [p1]: syms[0] } };
    
    if (p2) {
        s.sym[p2] = syms[1];
        s.turn = Math.random() > 0.5 ? p1 : p2;
    }

    db.set(message.chat, s);

    const body = s.state === 'play' ? `│🎮Turn: @${s.turn.split('@')[0]}\n│${board(s.grid)}` : `│✅Joined: @${p1.split('@')[0]}\n├─────────────\n│⏳Waiting...\n│`;
    await message.send('```' + `${head(s)}\n${body}\n╰──【  𝐓𝐈𝐂 𝐓𝐀𝐂 𝐓𝐎𝐄 】──` + '```', { mentions: [p1, p2].filter(Boolean) });
});


Listen({
    on: 'text'
}, async (message) => {
    const s = db.get(message.chat);
    if (!s) return;

    const cmd = message.text.toLowerCase().trim();
    const id = message.lid;
    const isP = id === s.p1 || id === s.p2;

    if (['leave', 'left', 'quit', 'exit'].includes(cmd) && isP) {
        const txt = s.state === 'wait' ? `╭──【 𝐓𝐈𝐂 𝐓𝐀𝐂 𝐓𝐎𝐄 】──\n│🏳️Left: @${id.split('@')[0]}\n╰──【  𝐓𝐈𝐂 𝐓𝐀𝐂 𝐓𝐎𝐄 】──` : `${head(s)}\n│🏳️Left: @${id.split('@')[0]}\n│${board(s.grid)}\n╰──【  𝐓𝐈𝐂 𝐓𝐀𝐂 𝐓𝐎𝐄 】──`;
        db.delete(message.chat);
        return await message.send('```' + txt + '```', { mentions: [s.p1, s.p2].filter(Boolean) });
    }

    if (s.state === 'wait' && cmd === 'join' && id !== s.p1) {
        s.p2 = id;
        s.state = 'play';
        s.sym[s.p2] = s.sym[s.p1] === '⭕' ? '❌' : '⭕';
        s.turn = Math.random() > 0.5 ? s.p1 : s.p2;
        return await message.send('```' + `${head(s)}\n│🎮Turn: @${s.turn.split('@')[0]}\n│${board(s.grid)}\n╰──【  𝐓𝐈𝐂 𝐓𝐀𝐂 𝐓𝐎𝐄 】──` + '```', { mentions: [s.p1, s.p2] });
    }

    if (s.state !== 'play' || !isP) return;

    const pos = parseInt(cmd) - 1;
    if (isNaN(pos) || pos < 0 || pos > 8 || s.grid[pos]) return;
    if (id !== s.turn) return await message.react(s.sym[id]);

    s.grid[pos] = s.sym[id] === '❌' ? 'X' : 'O';
    const res = judge(s.grid);

    if (res) {
        const resTxt = res === 'draw' ? `│🤝🏻Draw: @${s.p1.split('@')[0]} @${s.p2.split('@')[0]}` : `│🏁Won: @${id.split('@')[0]}`;
        const b = board(s.grid);
        db.delete(message.chat);
        return await message.send('```' + `${head(s)}\n${resTxt}\n│${b}\n╰──【  𝐓𝐈𝐂 𝐓𝐀𝐂 𝐓𝐎𝐄 】──` + '```', { mentions: [s.p1, s.p2] });
    }

    s.turn = s.turn === s.p1 ? s.p2 : s.p1;
    await message.send('```' + `${head(s)}\n│🎮Turn: @${s.turn.split('@')[0]}\n│${board(s.grid)}\n╰──【  𝐓𝐈𝐂 𝐓𝐀𝐂 𝐓𝐎𝐄 】──` + '```', { mentions: [s.p1, s.p2] });
});