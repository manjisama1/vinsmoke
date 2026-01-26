import { Command, Listen, GameSession, TicTacToe, GoGame, Connect4, Othello, Checkers, Chess } from '../lib/index.js';


Command({
    pattern: 'tictactoe ?(.*)',
    aliases: ['ttt'],
    desc: 'Professional TicTacToe',
    type: 'game'
}, async (message) => {
    if (GameSession.exists(message.chat)) 
        return await message.send('Active game exists.');

    const p1 = message.lid,
          p2 = message.mention?.[0] || message.quoted?.lid || null,
          game = new TicTacToe(message.chat, p1, p2),
          body = game.state === 'play' 
            ? `│🎮Turn: @${game.turn.split('@')[0]}\n│${game.board()}` 
            : `│✅Joined: @${p1.split('@')[0]}\n├─────────────\n│⏳Waiting...\n│`;

    await message.send('```' + `${game.head()}\n${body}\n╰──【  𝐓𝐈𝐂 𝐓𝐀𝐂 𝐓𝐎𝐄 】──` + '```', { 
        mentions: [p1, p2].filter(Boolean) 
    });
});


Listen({ on: 'text' }, async (message) => {
    if (!GameSession.db.size) return;

    const game = GameSession.get(message.chat);
    if (!game || game.type !== 'ttt') return;

    const raw = message.text.trim(),
          txt = raw.toLowerCase(),
          id = message.lid,
          isP = id === game.p1 || id === game.p2,
          p = [game.p1, game.p2].filter(Boolean);

    if (['leave', 'quit', 'exit', 'surrender'].includes(txt) && isP) {
        const info = game.state === 'wait' ? `│🏳️ @${id.split('@')[0]} left.` : `│🏳️ @${id.split('@')[0]} left.\n│${game.board()}`;
        GameSession.delete(message.chat);
        return await message.send('```' + `${game.head()}\n${info}\n╰──【  𝐓𝐈𝐂 𝐓𝐀𝐂 𝐓𝐎𝐄 】──` + '```', { mentions: p });
    }

    if (game.state === 'wait' && txt === 'join' && id !== game.p1) {
        game.state = 'play';
        game.assign(id, game.sym[game.p1] === '⭕' ? '❌' : '⭕');
        return await message.send('```' + `${game.head()}\n│🎮Turn: @${game.turn.split('@')[0]}\n│${game.board()}\n╰──【  𝐓𝐈𝐂 𝐓𝐀𝐂 𝐓𝐎𝐄 】──` + '```', { mentions: [game.p1, game.p2] });
    }

    if (game.state !== 'play' || !isP) return;

    const pos = parseInt(txt) - 1;
    if (isNaN(pos) || pos < 0 || pos > 8 || game.grid[pos]) return;

    if (id !== game.turn) {
        const s = game.sym[id];
        if (s) await message.react(s);
        return;
    }

    game.grid[pos] = game.sym[id] === '❌' ? 'X' : 'O';
    const res = game.judge();

    if (res) {
        const out = res === 'draw' 
            ? `│🤝🏻Draw: @${game.p1.split('@')[0]} @${game.p2.split('@')[0]}` 
            : `│🏁Won: @${id.split('@')[0]}`;
        GameSession.delete(message.chat);
        return await message.send('```' + `${game.head()}\n${out}\n│${game.board()}\n╰──【  𝐓𝐈𝐂 𝐓𝐀𝐂 𝐓𝐎𝐄 】──` + '```', { mentions: p });
    }

    game.turn = game.turn === game.p1 ? game.p2 : game.p1;
    await message.send('```' + `${game.head()}\n│🎮Turn: @${game.turn.split('@')[0]}\n│${game.board()}\n╰──【  𝐓𝐈𝐂 𝐓𝐀𝐂 𝐓𝐎𝐄 】──` + '```', { mentions: p });
});


Command({
    pattern: 'gogame',
    aliases: ['gog'],
    desc: '9x9 Go game',
    type: 'game'
}, async (message) => {
    if (GameSession.exists(message.chat)) 
        return await message.send('A Game already active.');

    const p1 = message.lid, 
          p2 = message.mention?.[0] || message.quoted?.lid || null,
          game = new GoGame(message.chat, p1, p2);

    const body = game.state === 'play' 
        ? `│🎮Turn: @${game.turn.split('@')[0]}\n${game.board()}` 
        : `│⏳Type 'join' to start...`;

    await message.send('```' + `${game.head()}\n${body}\n╰──【  𝐆 𝐎  】───` + '```', { 
        mentions: [p1, p2].filter(Boolean) 
    });
});


Listen({ on: 'text' }, async (message) => {
    if (!GameSession.db.size) return;

    const game = GameSession.get(message.chat);
    if (!game || game.jid !== message.chat || game.type !== 'go') return;

    const raw = message.text.trim(),
          txt = raw.toLowerCase(),
          id = message.lid;

    if (game.state === 'wait' && txt === 'join') {
        if (id === game.p1) return await message.react('⏳');
        game.p2 = id;
        game.state = 'play';
        game.assign(game.p1, game.p2);
        return await message.send('```' + `${game.head()}\n│🎮Turn: @${game.turn.split('@')[0]}\n${game.board()}\n╰──【  𝐆 𝐎  】───` + '```', { mentions: [game.p1, game.p2] });
    }

    const p = [game.p1, game.p2].filter(Boolean);
    if (!p.includes(id)) return;

    if (['leave', 'quit', 'exit', 'surrender'].includes(txt)) {
        const f = game.score();
        GameSession.delete(message.chat);
        return await message.send('```' + `${game.head()}\n│🏳️ @${id.split('@')[0]} surrendered.\n│🏆 Final: ⚫:${f[1]} ⚪:${f[2]}\n╰──【  𝐆 𝐎  】───` + '```', { mentions: p });
    }

    if (game.state !== 'play') return;

    const res = game.move(id, raw);
    if (res.error === 'turn') return await message.react(game.roles[id]);
    if (res.error) return await message.react('🚫');

    if (res.over) {
        const f = res.final, 
              win = f[1] > f[2] ? game.black : game.white;
        GameSession.delete(message.chat);
        return await message.send('```' + `${game.head()}\n│🏁 Game Over.\n│🚩 Final: ⚫:${f[1]} ⚪:${f[2]}\n│🏆 Winner: @${win.split('@')[0]}\n╰──【  𝐆 𝐎  】───` + '```', { mentions: p });
    }

    const caps = `│🚩Captures: ⚫:${game.caps[1]} ⚪:${game.caps[2]}`,
          pass = res.passed ? '│⏩ Passed.\n' : '';

    await message.send('```' + `${game.head()}\n${caps}\n│🎮Turn: @${game.turn.split('@')[0]}\n${pass}${game.board()}\n╰──【  𝐆 𝐎  】───` + '```', { mentions: p });
});


Command({
    pattern: 'connect4',
    aliases: ['c4'],
    desc: 'Connect 4 game',
    type: 'game'
}, async (message) => {
    if (GameSession.exists(message.chat)) 
        return await message.send('A Game is already active.');

    const p1 = message.lid, 
          p2 = message.mention?.[0] || message.quoted?.lid || null,
          game = new Connect4(message.chat, p1, p2);

    const body = game.state === 'play' 
        ? `│🎮Turn: @${game.turn.split('@')[0]}\n${game.board()}` 
        : `│⏳Type 'join' to start...`;

    await message.send('```' + `${game.head()}\n${body}\n╰──【 𝐂𝐎𝐍𝐍𝐄𝐂𝐓 𝟒 】──` + '```', { 
        mentions: [p1, p2].filter(Boolean) 
    });
});


Listen({ on: 'text' }, async (message) => {
    if (!GameSession.db.size) return;

    const game = GameSession.get(message.chat);
    if (!game || game.jid !== message.chat || game.type !== 'c4') return;

    const raw = message.text.trim(),
          txt = raw.toLowerCase(),
          id = message.lid;

    if (game.state === 'wait' && txt === 'join') {
        if (id === game.p1) return await message.react('⏳');
        game.p2 = id;
        game.state = 'play';
        game.assign(game.p1, game.p2);
        return await message.send('```' + `${game.head()}\n│🎮Turn: @${game.turn.split('@')[0]}\n${game.board()}\n╰──【 𝐂𝐎𝐍𝐍𝐄𝐂𝐓 𝟒 】──` + '```', { mentions: [game.p1, game.p2] });
    }

    const p = [game.p1, game.p2].filter(Boolean);
    if (!p.includes(id)) return;

    if (['leave', 'quit', 'exit', 'surrender'].includes(txt)) {
        GameSession.delete(message.chat);
        return await message.send('```' + `${game.head()}\n│🏳️ @${id.split('@')[0]} surrendered.\n╰──【 𝐂𝐎𝐍𝐍𝐄𝐂𝐓 𝟒 】──` + '```', { mentions: p });
    }

    if (game.state !== 'play') return;

    const res = game.move(id, raw);
    if (res.error === 'turn') return await message.react(game.roles[id]);
    if (res.error) return await message.react('🚫');

    if (res.win) {
        const out = game.board();
        GameSession.delete(message.chat);
        return await message.send('```' + `${game.head()}\n│🏆 Winner: @${id.split('@')[0]}\n${out}\n╰──【 𝐂𝐎𝐍𝐍𝐄𝐂𝐓 𝟒 】──` + '```', { mentions: p });
    }

    if (res.draw) {
        const out = game.board();
        GameSession.delete(message.chat);
        return await message.send('```' + `${game.head()}\n│🤝 Draw: Board Full\n${out}\n╰──【 𝐂𝐎𝐍𝐍𝐄𝐂𝐓 𝟒 】──` + '```', { mentions: p });
    }

    await message.send('```' + `${game.head()}\n│🎮Turn: @${game.turn.split('@')[0]}\n${game.board()}\n╰──【 𝐂𝐎𝐍𝐍𝐄𝐂𝐓 𝟒 】──` + '```', { mentions: p });
});


Command({
    pattern: 'othello',
    aliases: ['reversi'],
    desc: 'Professional 8x8 Othello',
    type: 'game'
}, async (message) => {
    if (GameSession.exists(message.chat)) 
        return await message.send('A Game is already active.');

    const p1 = message.lid, 
          p2 = message.mention?.[0] || message.quoted?.lid || null,
          game = new Othello(message.chat, p1, p2);

    const body = game.state === 'play' 
        ? `│🎮Turn: @${game.turn.split('@')[0]}\n${game.board()}` 
        : `│⏳Type 'join' to start...`;

    await message.send('```' + `${game.head()}\n${body}\n╰──【 𝐎𝐓𝐇𝐄𝐋𝐋𝐎 】───` + '```', { 
        mentions: [p1, p2].filter(Boolean) 
    });
});


Listen({ on: 'text' }, async (message) => {
    if (!GameSession.db.size) return;

    const game = GameSession.get(message.chat);
    if (!game || game.jid !== message.chat || game.type !== 'othello') return;

    const raw = message.text.trim(), 
          txt = raw.toLowerCase(), 
          id = message.lid;

    if (game.state === 'wait' && txt === 'join') {
        if (id === game.p1) return await message.react('⏳');
        game.p2 = id;
        game.state = 'play';
        game.assign(game.p1, game.p2);
        return await message.send('```' + `${game.head()}\n│🎮Turn: @${game.turn.split('@')[0]}\n${game.board()}\n╰──【 𝐎𝐓𝐇𝐄𝐋𝐋𝐎 】───` + '```', { mentions: [game.p1, game.p2] });
    }

    const p = [game.p1, game.p2].filter(Boolean);
    if (!p.includes(id)) return;

    if (['leave', 'quit', 'exit', 'surrender'].includes(txt)) {
        const sc = game.count();
        GameSession.delete(message.chat);
        return await message.send('```' + `${game.head()}\n│🏳️ @${id.split('@')[0]} left.\n│🏆 Score: ⚫:${sc[1]} ⚪:${sc[2]}\n╰──【 𝐎𝐓𝐇𝐄𝐋𝐋𝐎 】───` + '```', { mentions: p });
    }

    if (game.state !== 'play') return;

    const res = game.move(id, raw);
    if (res.error === 'turn') return await message.react(game.roles[id]);
    if (res.error) return await message.react('🚫');

    const sc = res.score;
    if (res.over) {
        const resTxt = sc[1] > sc[2] ? '⚫' : sc[1] < sc[2] ? '⚪' : 'Draw';
        GameSession.delete(message.chat);
        return await message.send('```' + `${game.head()}\n│🏁 Game Over!\n│🚩 Score: ⚫:${sc[1]} ⚪:${sc[2]}\n│🏆 Result: ${resTxt}\n╰──【 𝐎𝐓𝐇𝐄𝐋𝐋𝐎 】───` + '```', { mentions: p });
    }

    await message.send('```' + `${game.head()}\n│🚩Score: ⚫:${sc[1]} ⚪:${sc[2]}\n│🎮Turn: @${game.turn.split('@')[0]}\n${game.board()}\n╰──【 𝐎𝐓𝐇𝐄𝐋𝐋𝐎 】───` + '```', { mentions: p });
});


Command({
    pattern: 'checkers',
    aliases: ['draughts'],
    desc: 'Pro Checkers',
    type: 'game'
}, async (message) => {
    if (GameSession.exists(message.chat)) return await message.send('A Game is already active.');

    const p1 = message.lid, 
          p2 = message.mention?.[0] || message.quoted?.lid || null,
          game = new Checkers(message.chat, p1, p2);

    const body = game.state === 'play' 
        ? `│🎮Turn: @${game.turn.split('@')[0]}\n${game.board()}` 
        : `│⏳Type 'join' to start...`;

    await message.send('```' + `${game.head()}\n${body}\n╰──【 𝐂𝐇𝐄𝐂𝐊𝐄𝐑𝐒 】──` + '```', { 
        mentions: [p1, p2].filter(Boolean) 
    });
});


Listen({ on: 'text' }, async (message) => {
    if (!GameSession.db.size) return;

    const game = GameSession.get(message.chat);
    if (!game || game.type !== 'checkers') return;

    const raw = message.text.trim(), 
          txt = raw.toLowerCase(), 
          id = message.lid;

    if (game.state === 'wait' && txt === 'join' && id !== game.p1) {
        game.p2 = id; 
        game.state = 'play'; 
        game.assign(game.p1, game.p2);
        return await message.send('```' + `${game.head()}\n│🎮Turn: @${game.turn.split('@')[0]}\n${game.board()}\n╰──【 𝐂𝐇𝐄𝐂𝐊𝐄𝐑𝐒 】──` + '```', { mentions: [game.p1, game.p2] });
    }

    const p = [game.p1, game.p2].filter(Boolean);
    if (!p.includes(id)) return;

    if (['leave', 'quit', 'exit', 'surrender'].includes(txt)) {
        GameSession.delete(message.chat);
        return await message.send('```' + `${game.head()}\n│🏳️ Surrendered.\n╰──【 𝐂𝐇𝐄𝐂𝐊𝐄𝐑𝐒 】──` + '```', { mentions: p });
    }

    if (game.state !== 'play') return;

    const res = game.move(id, raw);
    if (res.error === 'turn') return await message.react(game.roles[id]);
    if (res.error) return await message.react('🚫');

    if (res.double) 
        return await message.send('```' + `${game.head()}\n│⚡ Double Jump!\n${game.board()}\n╰──【 𝐂𝐇𝐄𝐂𝐊𝐄𝐑𝐒 】──` + '```', { mentions: p });

    if (res.over) {
        GameSession.delete(message.chat);
        return await message.send('```' + `${game.head()}\n│🏆 Winner: @${id.split('@')[0]}\n${game.board()}\n╰──【 𝐂𝐇𝐄𝐂𝐊𝐄𝐑𝐒 】──` + '```', { mentions: p });
    }

    await message.send('```' + `${game.head()}\n│🎮Turn: @${game.turn.split('@')[0]}\n${game.board()}\n╰──【 𝐂𝐇𝐄𝐂𝐊𝐄𝐑𝐒 】──` + '```', { mentions: p });
});


Command({
    pattern: 'chess ?(.*)',
    aliases: ['c'],
    desc: 'Professional Chess',
    type: 'game'
}, async (message, match) => {
    if (GameSession.exists(message.chat)) return await message.send('A Game is already active.');

    const timeMatch = match?.match(/\b(\d+)m\b/i),
          timeLimit = timeMatch ? parseInt(timeMatch[1]) * 60000 : 0,
          p1 = message.lid,
          p2 = message.mention?.[0] || message.quoted?.lid || 'BOT',
          game = new Chess(message.chat, p1, p2, timeLimit);

    if (game.p2 === 'BOT' && game.turn === 'BOT') {
        const mv = game.botMove();
        if (mv) {
            game.grid[mv.t] = game.grid[mv.f]; game.grid[mv.f] = null;
            game.moved[mv.f] = game.moved[mv.t] = true;
            game.turn = game.p1;
        }
    }

    const body = game.state === 'play' ? game.board() : "│⏳Type 'join' to start...";
    await message.send('```' + `${game.head()}\n${body}\n╰──【  𝐂 𝐇 𝐄 𝐒 𝐒  】──` + '```', { 
        mentions: [p1, p2].filter(v => v !== 'BOT') 
    });
});


Listen({ on: 'text' }, async (message) => {
    if (!GameSession.db.size) return;

    const game = GameSession.get(message.chat);
    if (!game || game.type !== 'chess') return;

    const raw = message.text.trim(),
          txt = raw.toLowerCase(),
          id = message.lid,
          p = [game.p1, game.p2].filter(v => v !== 'BOT');

    if (game.state === 'wait' && txt === 'join' && id !== game.p1) {
        game.p2 = id;
        game.state = 'play';
        game.assign(game.p1, game.p2);
        if (game.timer) {
            game.timer[id] = game.timer[game.p1];
            game.timer.last = Date.now();
        }
        return await message.send('```' + `${game.head()}\n${game.board()}\n╰──【  𝐂 𝐇 𝐄 𝐒 𝐒  】──` + '```', { mentions: [game.p1, game.p2] });
    }

    if (![game.p1, game.p2].includes(id)) return;

    if (['leave', 'quit', 'exit', 'surrender'].includes(txt)) {
        GameSession.delete(message.chat);
        return await message.send('```' + `${game.head()}\n│🏳️ @${id.split('@')[0]} surrendered.\n╰──【  𝐂 𝐇 𝐄 𝐒 𝐒  】──` + '```', { mentions: p });
    }

    if (game.state !== 'play' || id !== game.turn) return;

    if (game.timer && game.updateClock()) {
        const win = game.turn === game.p1 ? game.p2 : game.p1;
        GameSession.delete(message.chat);
        return await message.send('```' + `${game.head()}\n│⏰ Time Out! @${win.split('@')[0]} wins.\n╰──【  𝐂 𝐇 𝐄 𝐒 𝐒  】──` + '```', { mentions: p });
    }

    const moveMatch = raw.match(/^([1-8])([1-8])([1-8])([1-8])$/);
    if (!moveMatch) return;

    const f = (parseInt(moveMatch[2]) - 1) * 8 + (parseInt(moveMatch[1]) - 1),
          t = (parseInt(moveMatch[4]) - 1) * 8 + (parseInt(moveMatch[3]) - 1);

    if (!game.getMoves(f).includes(t)) return await message.react('🚫');

    const nG = [...game.grid]; 
    if (nG[t]) game.caps[game.roles[id]].push(nG[t]);
    nG[t] = game.grid[f]; nG[f] = null;

    if (game.isCheck(game.roles[id], nG)) return await message.react('⚠️');
    
    game.grid = nG; 
    game.moved[f] = game.moved[t] = true;
    game.turn = game.p2 === 'BOT' ? 'BOT' : (game.turn === game.p1 ? game.p2 : game.p1);

    if (game.p2 === 'BOT' && game.turn === 'BOT') {
        const mv = game.botMove();
        if (mv) {
            if (game.grid[mv.t]) game.caps.B.push(game.grid[mv.t]);
            game.grid[mv.t] = game.grid[mv.f]; game.grid[mv.f] = null;
            game.moved[mv.f] = game.moved[mv.t] = true;
            game.turn = game.p1;
        }
    }

    const check = game.isCheck(game.roles[game.turn]);
    const checkLine = check ? '│⚠️ CHECK!\n' : '';
    await message.send('```' + `${game.head()}\n${game.board()}\n${checkLine}╰──【  𝐂 𝐇 𝐄 𝐒 𝐒  】──` + '```', { mentions: p });
});