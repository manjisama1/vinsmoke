import crypto from 'crypto';

export class GameSession {
    static db = new Map();
    static get(jid) { return this.db.get(jid); }
    static delete(jid) { return this.db.delete(jid); }
    static exists(jid) { return this.db.has(jid); }
}

export class TicTacToe extends GameSession {
    static ICONS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    static WINS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

    constructor(jid, p1, p2 = null) {
        super();
        const syms = Math.random() > 0.5 ? ['⭕', '❌'] : ['❌', '⭕'];
        this.type = 'ttt', this.jid = jid, this.p1 = p1, this.p2 = p2;
        this.grid = Array(9).fill(null), this.state = p2 ? 'play' : 'wait';
        this.sym = { [p1]: syms[0] };
        this.turn = null; 
        if (p2) this.assign(p2, syms[1]);
        GameSession.db.set(jid, this);
    }

    assign(p2, s2) {
        this.p2 = p2, this.sym[p2] = s2;
        this.turn = Math.random() > 0.5 ? this.p1 : p2;
    }

    head() {
        const u1 = this.p1.split('@')[0], u2 = this.p2 ? this.p2.split('@')[0] : 'Waiting...';
        return `╭──【 𝐓𝐈𝐂 𝐓𝐀𝐂 𝐓𝐎𝐄 】──\n│👤P1: @${u1} (${this.sym[this.p1]})\n│👤P2: ${this.p2 ? `@${u2} (${this.sym[this.p2]})` : u2}\n├─────────────`;
    }

    board() {
        let out = '\n│           ';
        for (let i = 0; i < 9; i++) {
            out += (this.grid[i] === 'X' ? '❌' : this.grid[i] === 'O' ? '⭕' : TicTacToe.ICONS[i]);
            if ((i + 1) % 3 === 0 && i !== 8) out += '\n│           ';
        }
        return out + '\n│';
    }

    judge() {
        const win = TicTacToe.WINS.find(([a, b, c]) => this.grid[a] && this.grid[a] === this.grid[b] && this.grid[a] === this.grid[c]);
        return win ? this.grid[win[0]] : this.grid.every(v => v) ? 'draw' : null;
    }
}


export class GoGame extends GameSession {
    static COLS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    static ROWS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    constructor(jid, p1, p2 = null) {
        super();
        this.type = 'go';
        this.jid = jid;
        this.p1 = p1;
        this.p2 = p2;
        this.grid = Array(81).fill(0);
        this.state = p2 ? 'play' : 'wait';
        this.caps = { 1: 0, 2: 0 };
        this.history = [];
        this.passes = 0;
        this.roles = {};
        if (p2) this.assign(p1, p2);
        GameSession.db.set(jid, this);
    }

    assign(p1, p2) {
        const isEven = crypto.randomBytes(1)[0] % 2 === 0;
        const r = isEven ? ['⚫', '⚪'] : ['⚪', '⚫'];
        this.roles = { [p1]: r[0], [p2]: r[1] };
        this.black = r[0] === '⚫' ? p1 : p2;
        this.white = r[0] === '⚪' ? p1 : p2;
        this.turn = this.black;
    }

    head() {
        const u1 = this.p1.split('@')[0], 
              u2 = this.p2 ? this.p2.split('@')[0] : 'Waiting...';
        return `╭──【  𝐆 𝐎  】───\n│👤P1: @${u1} (${this.roles[this.p1] || '?'})\n│👤P2: @${u2} ${this.p2 ? `(${this.roles[this.p2]})` : ''}\n├─────────────`;
    }

    board() {
        let out = '│';
        for (let r = 8; r >= 0; r--) {
            out += `\n│${GoGame.ROWS[r]}️⃣`;
            for (let c = 0; c < 9; c++) {
                const v = this.grid[r * 9 + c];
                out += v === 1 ? '⚫' : v === 2 ? '⚪' : '🟧';
            }
        }
        return out + `\n│🔳${GoGame.COLS.map(v => v + '️⃣').join('')}\n│`;
    }

    libs(idx, g, col, vis = new Set()) {
        if (vis.has(idx)) return new Set();
        vis.add(idx);
        let l = new Set();
        const adj = [idx - 9, idx + 9, idx % 9 > 0 ? idx - 1 : -1, idx % 9 < 8 ? idx + 1 : -1].filter(n => n >= 0 && n < 81);
        for (const n of adj) {
            if (g[n] === 0) l.add(n);
            else if (g[n] === col) this.libs(n, g, col, vis).forEach(p => l.add(p));
        }
        return l;
    }

    group(idx, g, col, vis = new Set()) {
        vis.add(idx);
        const adj = [idx - 9, idx + 9, idx % 9 > 0 ? idx - 1 : -1, idx % 9 < 8 ? idx + 1 : -1].filter(n => n >= 0 && n < 81);
        for (const n of adj) if (g[n] === col && !vis.has(n)) this.group(n, g, col, vis);
        return vis;
    }

    score() {
        const res = { 1: this.caps[1], 2: this.caps[2] + 6.5 }, vis = new Set();
        for (let i = 0; i < 81; i++) {
            if (this.grid[i] !== 0 || vis.has(i)) continue;
            const area = new Set(), borders = new Set(), q = [i];
            vis.add(i);
            while (q.length) {
                const c = q.shift();
                area.add(c);
                [c - 9, c + 9, c % 9 > 0 ? c - 1 : -1, c % 9 < 8 ? c + 1 : -1].filter(n => n >= 0 && n < 81).forEach(n => {
                    if (this.grid[n] === 0 && !vis.has(n)) { vis.add(n); q.push(n); }
                    else if (this.grid[n] !== 0) borders.add(this.grid[n]);
                });
            }
            if (borders.size === 1) res[[...borders][0]] += area.size;
        }
        return res;
    }

    move(id, m) {
        if (this.state !== 'play' || id !== this.turn) return { error: 'turn' };
        if (m === this.roles[id]) return this.pass();
        const x = parseInt(m[0]) - 1, y = parseInt(m[1]) - 1, pos = y * 9 + x;
        if (m.length !== 2 || isNaN(pos) || x < 0 || x > 8 || y < 0 || y > 8 || this.grid[pos] !== 0) return { error: 'move' };
        const col = id === this.black ? 1 : 2, opp = col === 1 ? 2 : 1;
        let nG = [...this.grid], caps = 0;
        nG[pos] = col;
        [pos - 9, pos + 9, pos % 9 > 0 ? pos - 1 : -1, pos % 9 < 8 ? pos + 1 : -1].filter(n => n >= 0 && n < 81).forEach(n => {
            if (nG[n] === opp && this.libs(n, nG, opp).size === 0) {
                this.group(n, nG, opp).forEach(p => { nG[p] = 0; caps++; });
            }
        });
        if (this.libs(pos, nG, col).size === 0 || this.history.includes(JSON.stringify(nG))) return { error: 'invalid' };
        this.grid = nG; this.history.push(JSON.stringify(nG));
        if (this.history.length > 10) this.history.shift();
        this.caps[col] += caps; this.passes = 0;
        this.turn = (this.turn === this.p1) ? this.p2 : this.p1;
        return { success: true };
    }

    pass() {
        this.passes++;
        if (this.passes >= 2) return { over: true, final: this.score() };
        this.turn = (this.turn === this.p1) ? this.p2 : this.p1;
        return { success: true, passed: true };
    }
}


export class Connect4 extends GameSession {
    static COLS = ['1', '2', '3', '4', '5', '6', '7'];
    static ROWS = ['1', '2', '3', '4', '5', '6'];

    constructor(jid, p1, p2 = null) {
        super();
        this.type = 'c4';
        this.jid = jid;
        this.p1 = p1;
        this.p2 = p2;
        this.grid = Array(42).fill(0);
        this.state = p2 ? 'play' : 'wait';
        this.roles = {};
        if (p2) this.assign(p1, p2);
        GameSession.db.set(jid, this);
    }

    assign(p1, p2) {
        const isEven = crypto.randomBytes(1)[0] % 2 === 0;
        const r = isEven ? ['🔴', '🟡'] : ['🟡', '🔴'];
        this.roles = { [p1]: r[0], [p2]: r[1] };
        this.turn = r[0] === '🔴' ? p1 : p2;
    }

    head() {
        const u1 = this.p1.split('@')[0], 
              u2 = this.p2 ? this.p2.split('@')[0] : 'Waiting...';
        return `╭──【 𝐂𝐎𝐍𝐍𝐄𝐂𝐓 𝟒 】──\n│👤P1: @${u1} (${this.roles[this.p1] || '?'})\n│👤P2: @${u2} ${this.p2 ? `(${this.roles[this.p2]})` : ''}\n├─────────────`;
    }

    board() {
        let out = '│';
        for (let r = 0; r < 6; r++) {
            out += `\n│${Connect4.ROWS[5 - r]}️⃣`;
            for (let c = 0; c < 7; c++) {
                const v = this.grid[r * 7 + c];
                out += v === 1 ? '🔴' : v === 2 ? '🟡' : '⬛';
            }
        }
        return out + `\n│🔳${Connect4.COLS.map(v => v + '️⃣').join('')}\n│`;
    }

    checkWin(pos, color) {
        const r = Math.floor(pos / 7), c = pos % 7;
        const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (const [dr, dc] of DIRS) {
            let n = 1;
            for (const s of [1, -1]) {
                let nR = r + dr * s, nC = c + dc * s;
                while (nR >= 0 && nR < 6 && nC >= 0 && nC < 7 && this.grid[nR * 7 + nC] === color) {
                    n++; nR += dr * s; nC += dc * s;
                }
            }
            if (n >= 4) return true;
        }
        return false;
    }

    move(id, m) {
        if (this.state !== 'play' || id !== this.turn) return { error: 'turn' };
        const col = parseInt(m) - 1;
        if (isNaN(col) || col < 0 || col > 6) return { error: 'invalid' };
        let row = -1;
        for (let r = 5; r >= 0; r--) {
            if (this.grid[r * 7 + col] === 0) { row = r; break; }
        }
        if (row === -1) return { error: 'full' };
        const color = this.roles[id] === '🔴' ? 1 : 2;
        const pos = row * 7 + col;
        this.grid[pos] = color;
        if (this.checkWin(pos, color)) return { win: true };
        if (!this.grid.includes(0)) return { draw: true };
        this.turn = (this.turn === this.p1) ? this.p2 : this.p1;
        return { success: true };
    }
}

export class Othello extends GameSession {
    static COLS = ['1', '2', '3', '4', '5', '6', '7', '8'];
    static ROWS = ['1', '2', '3', '4', '5', '6', '7', '8'];
    static DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

    constructor(jid, p1, p2 = null) {
        super();
        this.type = 'othello';
        this.jid = jid;
        this.p1 = p1;
        this.p2 = p2;
        this.grid = Array(64).fill(0);
        [this.grid[35], this.grid[36], this.grid[27], this.grid[28]] = [2, 1, 1, 2];
        this.state = p2 ? 'play' : 'wait';
        this.roles = {};
        if (p2) this.assign(p1, p2);
        GameSession.db.set(jid, this);
    }

    assign(p1, p2) {
        const isEven = crypto.randomBytes(1)[0] % 2 === 0;
        const r = isEven ? ['⚫', '⚪'] : ['⚪', '⚫'];
        this.roles = { [p1]: r[0], [p2]: r[1] };
        this.turn = r[0] === '⚫' ? p1 : p2;
    }

    head() {
        const u1 = this.p1.split('@')[0],
              u2 = this.p2 ? this.p2.split('@')[0] : 'Waiting...';
        return `╭──【 𝐎𝐓𝐇𝐄𝐋𝐋𝐎 】───\n│👤P1: @${u1} (${this.roles[this.p1] || '?'})\n│👤P2: @${u2} ${this.p2 ? `(${this.roles[this.p2]})` : ''}\n├─────────────`;
    }

    board() {
        let out = '│';
        for (let r = 7; r >= 0; r--) {
            out += `\n│${Othello.ROWS[r]}️⃣`;
            for (let c = 0; c < 8; c++) {
                const v = this.grid[r * 8 + c];
                out += v === 1 ? '⚫' : v === 2 ? '⚪' : '🟩';
            }
        }
        return out + `\n│🔳${Othello.COLS.map(v => v + '️⃣').join('')}\n│`;
    }

    getFlips(pos, color) {
        const r = Math.floor(pos / 8), c = pos % 8, all = [];
        for (const [dr, dc] of Othello.DIRS) {
            let temp = [], nR = r + dr, nC = c + dc;
            while (nR >= 0 && nR < 8 && nC >= 0 && nC < 8) {
                const idx = nR * 8 + nC;
                if (this.grid[idx] === 0) break;
                if (this.grid[idx] === color) {
                    if (temp.length > 0) all.push(...temp);
                    break;
                }
                temp.push(idx); nR += dr; nC += dc;
            }
        }
        return all;
    }

    hasMoves(color) {
        for (let i = 0; i < 64; i++) if (this.grid[i] === 0 && this.getFlips(i, color).length > 0) return true;
        return false;
    }

    count() {
        const res = { 1: 0, 2: 0 };
        this.grid.forEach(v => v > 0 && res[v]++);
        return res;
    }

    move(id, m) {
        if (this.state !== 'play' || id !== this.turn) return { error: 'turn' };
        const x = parseInt(m[0]) - 1, y = parseInt(m[1]) - 1, pos = y * 8 + x;
        if (m.length !== 2 || isNaN(pos) || x < 0 || x > 7 || y < 0 || y > 7 || this.grid[pos] !== 0) return { error: 'invalid' };

        const col = this.roles[id] === '⚫' ? 1 : 2, flips = this.getFlips(pos, col);
        if (!flips.length) return { error: 'invalid' };

        this.grid[pos] = col;
        flips.forEach(f => this.grid[f] = col);

        const opp = id === this.p1 ? this.p2 : this.p1, 
              oppCol = col === 1 ? 2 : 1;
        this.turn = this.hasMoves(oppCol) ? opp : id;

        if (!this.hasMoves(1) && !this.hasMoves(2)) return { over: true, score: this.count() };
        return { success: true, score: this.count() };
    }
}


export class Checkers extends GameSession {
    static COLS = ['1', '2', '3', '4', '5', '6', '7', '8'];
    static ROWS = ['1', '2', '3', '4', '5', '6', '7', '8'];

    constructor(jid, p1, p2 = null) {
        super();
        this.type = 'checkers';
        this.jid = jid;
        this.p1 = p1;
        this.p2 = p2;
        this.grid = Array(64).fill(0);
        for (let i = 0; i < 64; i++) {
            const r = Math.floor(i / 8), c = i % 8;
            if ((r + c) % 2 === 0) {
                if (r >= 5) this.grid[i] = 1;
                if (r <= 2) this.grid[i] = 2;
            }
        }
        this.state = p2 ? 'play' : 'wait';
        this.roles = {};
        this.lock = null;
        if (p2) this.assign(p1, p2);
        GameSession.db.set(jid, this);
    }

    assign(p1, p2) {
        const isEven = crypto.randomBytes(1)[0] % 2 === 0;
        const r = isEven ? ['⚫', '⚪'] : ['⚪', '⚫'];
        this.roles = { [p1]: r[0], [p2]: r[1] };
        this.turn = r[0] === '⚪' ? p1 : p2;
    }

    head() {
        const u1 = this.p1.split('@')[0], 
              u2 = this.p2 ? this.p2.split('@')[0] : 'Waiting...';
        return `╭──【 𝐂𝐇𝐄𝐂𝐊𝐄𝐑𝐒 】──\n│👤P1: @${u1} (${this.roles[this.p1] || '?'})\n│👤P2: @${u2} ${this.p2 ? `(${this.roles[this.p2]})` : ''}\n├─────────────`;
    }

    board() {
        let out = '│';
        for (let r = 7; r >= 0; r--) {
            out += `\n│${Checkers.ROWS[r]}️⃣`;
            for (let c = 0; c < 8; c++) {
                const v = this.grid[r * 8 + c], dark = (r + c) % 2 === 0;
                out += v === 1 ? '⚫' : v === 2 ? '⚪' : v === 3 ? '👑' : v === 4 ? '🦁' : dark ? '🏿' : '🏻';
            }
        }
        return out + `\n│🔳${Checkers.COLS.map(v => v + '️⃣').join('')}\n│`;
    }

    getMoves(pos, forceJump = false) {
        const v = this.grid[pos], r = Math.floor(pos / 8), c = pos % 8;
        const jumps = [], slides = [];
        const dirs = v === 3 || v === 4 ? [[1,1],[1,-1],[-1,1],[-1,-1]] : (v === 1 ? [[-1,1],[-1,-1]] : [[1,1],[1,-1]]);
        const opp = (v === 1 || v === 3) ? [2, 4] : [1, 3];
        for (const [dr, dc] of dirs) {
            const nR = r + dr, nC = c + dc, jR = r + dr * 2, jC = c + dc * 2;
            if (jR >= 0 && jR < 8 && jC >= 0 && jC < 8) {
                const mid = nR * 8 + nC, end = jR * 8 + jC;
                if (opp.includes(this.grid[mid]) && this.grid[end] === 0) jumps.push({ from: pos, to: end, cap: mid });
            }
            if (!forceJump && nR >= 0 && nR < 8 && nC >= 0 && nC < 8 && this.grid[nR * 8 + nC] === 0) slides.push({ from: pos, to: nR * 8 + nC });
        }
        return { jumps, slides };
    }

    valid(id) {
        const color = this.roles[id] === '⚫' ? [1, 3] : [2, 4], j = [], s = [];
        this.grid.forEach((v, i) => {
            if (!color.includes(v)) return;
            const m = this.getMoves(i);
            j.push(...m.jumps); s.push(...m.slides);
        });
        return j.length ? { type: 'jump', moves: j } : { type: 'slide', moves: s };
    }

    move(id, txt) {
        if (this.state !== 'play' || id !== this.turn) return { error: 'turn' };
        const match = txt.match(/^([1-8])([1-8])([1-8])([1-8])$/);
        if (!match) return { error: 'invalid' };
        const f = (parseInt(match[2]) - 1) * 8 + (parseInt(match[1]) - 1),
              t = (parseInt(match[4]) - 1) * 8 + (parseInt(match[3]) - 1),
              v = this.valid(id),
              m = v.moves.find(x => x.from === f && x.to === t);
        if (!m || (this.lock !== null && f !== this.lock)) return { error: 'invalid' };
        this.grid[t] = this.grid[f]; this.grid[f] = 0;
        if (m.cap !== undefined) this.grid[m.cap] = 0;
        if (this.grid[t] === 1 && Math.floor(t / 8) === 0) this.grid[t] = 3;
        if (this.grid[t] === 2 && Math.floor(t / 8) === 7) this.grid[t] = 4;
        if (m.cap !== undefined && this.getMoves(t, true).jumps.length) {
            this.lock = t; return { double: true };
        }
        this.lock = null; this.turn = this.turn === this.p1 ? this.p2 : this.p1;
        return this.valid(this.turn).moves.length ? { success: true } : { over: true };
    }
}


export class Chess extends GameSession {
    static COLS = ['1', '2', '3', '4', '5', '6', '7', '8'];
    static ROWS = ['1', '2', '3', '4', '5', '6', '7', '8'];
    static VALS = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    static PST = {
        p: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, -20, -20, 10, 10, 5, 5, -5, -10, 0, 0, -10, -5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, 5, 10, 25, 25, 10, 5, 5, 10, 10, 20, 30, 30, 20, 10, 10, 50, 50, 50, 50, 50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0],
        n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 10, 15, 15, 10, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 10, 0, -30, -40, -20, 0, 0, 0, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50]
    };

    constructor(jid, p1, p2 = null, time = 0) {
        super();
        this.type = 'chess', this.jid = jid, this.p1 = p1, this.p2 = p2;
        this.grid = Array(64).fill(null);
        'RNBQKBNRPPPPPPPP'.split('').forEach((v, i) => this.grid[i] = v);
        'pppppppprnbqkbnr'.split('').forEach((v, i) => this.grid[i + 48] = v);
        this.state = p2 ? 'play' : 'wait', this.roles = {}, this.moved = {}, this.caps = { W: [], B: [] }, this.enPassant = null;
        this.timer = time ? { [p1]: time, [p2]: time, last: Date.now() } : null;
        if (p2) this.assign(p1, p2);
        GameSession.db.set(jid, this);
    }

    assign(p1, p2) {
        const isBot = p2 === 'BOT', isW = isBot || crypto.randomBytes(1)[0] % 2 === 0;
        this.roles = { [p1]: isW ? 'W' : 'B', [p2]: isW ? 'B' : 'W' };
        this.turn = isW ? p1 : p2;
        if (this.timer) this.timer.last = Date.now();
    }

    updateClock() {
        if (!this.timer || this.state !== 'play') return false;
        const now = Date.now();
        this.timer[this.turn] -= (now - this.timer.last), this.timer.last = now;
        return this.timer[this.turn] <= 0;
    }

    fmtTime(id) {
        if (!this.timer || !id || id === 'BOT') return '';
        const ms = Math.max(0, this.timer[id]), m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
        return `${m}m${s}s`;
    }

    fmtCaps(color) {
        const c = this.caps[color];
        if (!c.length) return '';
        let res = '';
        for (let i = 0; i < c.length; i++) res += (i > 0 && i % 6 === 0) ? `\n│${c[i]}` : c[i];
        return `│${res}`;
    }

    head() {
        const u1 = this.p1.split('@')[0], u2 = this.p2 === 'BOT' ? 'BOT' : (this.p2 ? this.p2.split('@')[0] : 'Waiting...');
        return `╭──【  𝐂 𝐇 𝐄 𝐒 𝐒  】──\n│👤P1: @${u1} (${this.roles[this.p1] || '?'})\n│${this.p2 === 'BOT' ? '🤖' : '👤'}P2: @${u2} (${this.roles[this.p2] || '?'})\n├─────────────\n│🎮Turn: @${this.turn.split('@')[0]}`;
    }

    board() {
        const syms = { r: '🏯', n: '🐴', b: '🧙🏿', q: '👸🏿', k: '🤴🏿', p: '⚫', R: '🏰', N: '🦄', B: '🧙🏻', Q: '👸🏻', K: '🤴🏻', P: '⚪' };
        const bID = Object.keys(this.roles).find(k => this.roles[k] === 'B'), wID = Object.keys(this.roles).find(k => this.roles[k] === 'W');
        const clock = (id) => (this.timer && id && id !== 'BOT') ? `:${this.fmtTime(id)}` : '';
        const cB = this.fmtCaps('B'), cW = this.fmtCaps('W');
        
        let out = `│⚫caps${clock(bID)}\n${cB ? `${cB}\n` : ''}├─────────────`;
        for (let r = 7; r >= 0; r--) {
            out += `\n│${Chess.ROWS[r]}️⃣`;
            for (let c = 0; c < 8; c++) out += (this.grid[r * 8 + c] ? syms[this.grid[r * 8 + c]] : ((r + c) % 2 === 0 ? '🏿' : '🏻'));
        }
        out += `\n│🔳${Chess.COLS.map(v => v + '️⃣').join('')}\n├─────────────`;
        out += `\n│⚪caps${clock(wID)}\n${cW ? cW : '│'}`;
        
        return out;
    }

    getMoves(pos, grid = this.grid) {
        const p = grid[pos], r = Math.floor(pos / 8), c = pos % 8, m = [];
        if (!p) return m;
        const w = p === p.toUpperCase(), en = (v) => v && (w ? v === v.toLowerCase() : v === v.toUpperCase());
        if (p.toLowerCase() === 'p') {
            const d = w ? 1 : -1;
            if (!grid[pos + d * 8]) {
                m.push(pos + d * 8);
                if ((w ? r === 1 : r === 6) && !grid[pos + d * 16] && !grid[pos + d * 8]) m.push(pos + d * 16);
            }
            for (const dx of [-1, 1]) {
                const nC = c + dx, t = (r + d) * 8 + nC;
                if (nC >= 0 && nC < 8 && (en(grid[t]) || t === this.enPassant)) m.push(t);
            }
        }
        const slide = (ds) => {
            for (const [dr, dc] of ds) {
                let nR = r + dr, nC = c + dc;
                while (nR >= 0 && nR < 8 && nC >= 0 && nC < 8) {
                    const i = nR * 8 + nC;
                    if (!grid[i]) m.push(i); else { if (en(grid[i])) m.push(i); break; }
                    nR += dr, nC += dc;
                }
            }
        };
        if (p.toLowerCase() === 'r') slide([[0, 1], [0, -1], [1, 0], [-1, 0]]);
        if (p.toLowerCase() === 'b') slide([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
        if (p.toLowerCase() === 'q') slide([[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
        const jump = (os) => {
            for (const [dr, dc] of os) {
                const nR = r + dr, nC = c + dc;
                if (nR >= 0 && nR < 8 && nC >= 0 && nC < 8 && (!grid[nR * 8 + nC] || en(grid[nR * 8 + nC]))) m.push(nR * 8 + nC);
            }
        };
        if (p.toLowerCase() === 'n') jump([[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]);
        if (p.toLowerCase() === 'k') {
            jump([[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
            if (!this.moved[pos]) {
                if (!this.moved[pos - 4] && !grid[pos - 1] && !grid[pos - 2] && !grid[pos - 3]) m.push(pos - 2);
                if (!this.moved[pos + 3] && !grid[pos + 1] && !grid[pos + 2]) m.push(pos + 2);
            }
        }
        return m;
    }

    isCheck(col, grid = this.grid) {
        const k = grid.indexOf(col === 'W' ? 'K' : 'k');
        return k !== -1 && grid.some((p, i) => p && (col === 'W' ? p === p.toLowerCase() : p === p.toUpperCase()) && this.getMoves(i, grid).includes(k));
    }

    evalB(g) {
        return g.reduce((a, p, i) => {
            if (!p) return a;
            const t = p.toLowerCase(), w = p === p.toUpperCase();
            return a + (w ? (Chess.VALS[t] + (Chess.PST[t]?.[i] || 0)) : -(Chess.VALS[t] + (Chess.PST[t]?.[63 - i] || 0)));
        }, 0);
    }

    mm(g, d, a, b, mx) {
        const botCol = this.roles['BOT'] || this.roles[this.p2];
        if (d === 0) return this.evalB(g) * (botCol === 'W' ? 1 : -1);
        
        const col = mx ? botCol : (botCol === 'W' ? 'B' : 'W');
        let res = mx ? -Infinity : Infinity;

        for (let i = 0; i < 64; i++) {
            const p = g[i];
            if (!p || (col === 'W' ? p !== p.toUpperCase() : p !== p.toLowerCase())) continue;
            
            for (const t of this.getMoves(i, g)) {
                const n = [...g]; n[t] = p, n[i] = null;
                if (this.isCheck(col, n)) continue;
                
                const sc = this.mm(n, d - 1, a, b, !mx);
                res = mx ? Math.max(res, sc) : Math.min(res, sc);
                mx ? (a = Math.max(a, res)) : (b = Math.min(b, res));
                if (b <= a) break;
            }
        }
        return res === -Infinity || res === Infinity ? (this.isCheck(col, g) ? (mx ? -10000 : 10000) : 0) : res;
    }

    botMove() {
        const col = this.roles['BOT'] || this.roles[this.p2];
        if (!col) return null;

        let best = -Infinity, mv = null;
        const isW = col === 'W';

        for (let i = 0; i < 64; i++) {
            const p = this.grid[i];
            if (!p || (isW ? p !== p.toUpperCase() : p !== p.toLowerCase())) continue;
            
            for (const t of this.getMoves(i)) {
                const n = [...this.grid]; n[t] = p, n[i] = null;
                if (this.isCheck(col, n)) continue;
                
                const sc = this.mm(n, 3, -Infinity, Infinity, false);
                if (sc > best) best = sc, mv = { f: i, t };
            }
        }
        return mv;
    }
}