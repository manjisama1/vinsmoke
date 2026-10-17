import {
    Command,
    tempDir,
    pinWorker,
    pinterest,
    lang,
    config,
    downLoad,
} from '../lib/index.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const media = path.join(root, '..', 'media');
const db = path.join(root, '..', 'lib', 'db', 'sticker.json');
const pinDb = path.join(media, 'pin.json');
const logFile = path.join(media, 'pin-debug.log');
const active = new Map();

const BATCH_SIZE = 15;
const BATCH_COOL = 300;

const del = f => { try { fs.existsSync(f) && fs.unlinkSync(f); } catch {} };
const wait = ms => new Promise(r => setTimeout(r, ms));

const isSafeUrl = url => {
    try {
        const u = new URL(url);
        if (!/^https?:$/.test(u.protocol)) return false;
        const h = u.hostname.toLowerCase();
        return !['localhost', '0.0.0.0', '::1'].includes(h)
            && !h.endsWith('.local')
            && !/^(0|10|127)\./.test(h)
            && !/^169\.254\./.test(h)
            && !/^172\.(1[6-9]|2\d|3[01])\./.test(h)
            && !/^192\.168\./.test(h)
            && !/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)
            && !/^f[cd]/.test(h)
            && !h.startsWith('fe80');
    } catch {
        return false;
    }
};

const ensureMedia = () => fs.existsSync(media) || fs.mkdirSync(media, { recursive: true });

const loadSize = () => {
    if (!fs.existsSync(db)) {
        fs.mkdirSync(path.dirname(db), { recursive: true });
        fs.writeFileSync(db, JSON.stringify({ settings: { ratio: '1:1', placement: 1, type: '0' } }));
    }
    return JSON.parse(fs.readFileSync(db, 'utf8')).settings;
};

const loadQueue = () => {
    ensureMedia();
    if (!fs.existsSync(pinDb)) fs.writeFileSync(pinDb, JSON.stringify({ type: 's', links: [] }, null, 2));
    try {
        const p = JSON.parse(fs.readFileSync(pinDb, 'utf8') || '{}');
        return { type: p.type || 's', links: [...new Set(p.links || [])] };
    } catch {
        return { type: 's', links: [] };
    }
};

const saveQueue = q => {
    ensureMedia();
    q.links = [...new Set(q.links)];
    fs.writeFileSync(pinDb, JSON.stringify(q, null, 2));
};

const addToQueue = (urls, type) => {
    const q = loadQueue();
    q.type = type || q.type;
    q.links = [...new Set([...q.links, ...urls])];
    saveQueue(q);
    return q;
};

const removeFromQueue = url => {
    const q = loadQueue();
    q.links = q.links.filter(u => u !== url);
    saveQueue(q);
};

const logRun = data => { try { fs.appendFileSync(logFile, `${new Date().toISOString()} ${JSON.stringify(data)}\n`); } catch {} };

const extractDocLinks = async message => {
    const file = await downLoad(message.raw, 'path') || await downLoad(message.quoted, 'path');
    if (!file) return null;
    const raw = fs.readFileSync(file, 'utf-8').match(/https?:\/\/[^\s]+/g) || [];
    del(file);
    return [...new Set(raw)].filter(isSafeUrl);
};

const fetchLinks = async (query, count) => {
    const res = await axios.post(config.PIN_API || 'http://localhost:3000/scrape', { input: query, desiredCount: count }, { timeout: 15000 }).catch(() => null);
    const links = res?.data?.data || (query.startsWith('http') ? [] : await pinterest(query));
    return links.slice(0, count);
};

const runQueue = async (message, pid) => {
    const state = { stopped: false, child: fork(pinWorker) };
    active.set(pid, state);
    let sent = 0, seen = 0;

    state.child.on('message', async msg => {
        if (msg?.type !== 'item' || !msg.ok) return;
        const buf = fs.readFileSync(msg.path);
        const ok = await message.send(msg.kind === 'sticker' ? { sticker: buf } : buf).catch(() => null);
        del(msg.path);
        if (ok) { sent++; removeFromQueue(msg.url); }
    });

    const nextBatch = () => new Promise(resolve => {
        const onMsg = msg => {
            if (msg?.type !== 'batchDone') return;
            state.child.off('message', onMsg);
            resolve(msg);
        };
        state.child.on('message', onMsg);
    });

    while (!state.stopped) {
        const q = loadQueue();
        const batch = q.links.slice(0, BATCH_SIZE);
        if (!batch.length) break;

        state.child.send({ type: 'batch', links: batch, mode: q.type, tempDir });
        const result = await nextBatch();
        seen += batch.length;

        const left = loadQueue().links;
        batch.forEach(url => left.includes(url) && removeFromQueue(url));

        logRun({ seen, batch: batch.length, sent: result.sent, mem: result.mem });

        if (state.stopped) break;
        await wait(BATCH_COOL);
    }

    state.child.send({ type: 'exit' });
    const stopped = state.stopped;
    active.delete(pid);
    return { sent, seen, stopped };
};

Command({
    pattern: 'pinterest ?(.*)',
    aliases: ['pt'],
    desc: lang.plugins.pinterest.desc,
    type: 'media',
}, async (message, match) => {
    const args = (match || '').trim().split(/\s+/);
    const cmd = args[0]?.toLowerCase();
    const pid = message.chat;
    const isDoc = message.quoted?.document?.txt;

    if (!match && isDoc) {
        const found = await extractDocLinks(message);
        if (found === null) return message.send(lang.plugins.pinterest.failed);
        if (!found.length) return message.send(lang.plugins.pinterest.no_links);

        addToQueue(found, 's');
        const { sent, seen, stopped } = await runQueue(message, pid);
        return stopped
            ? message.send(lang.plugins.pinterest.stopped.format(sent, seen))
            : message.send(lang.plugins.pinterest.file_done.format(sent));
    }

    if (!match) return message.send(lang.plugins.pinterest.usage.format(config.PREFIX));

    if (cmd === 'stop') {
        const a = active.get(pid);
        if (!a) return message.send(lang.plugins.pinterest.no_active);
        a.stopped = true;
        a.child?.kill('SIGTERM');
        return;
    }

    if (cmd === 'add' && isDoc) {
        const found = await extractDocLinks(message);
        if (found === null) return message.send(lang.plugins.pinterest.failed);
        if (!found.length) return message.send(lang.plugins.pinterest.no_links);

        const type = ['i', 's'].includes(args[1]) ? args[1] : 's';
        const q = addToQueue(found, type);
        return message.send(lang.plugins.pinterest.add_done.format(q.links.length));
    }

    if (cmd === 'add') {
        const input = args.slice(1).join(' ');
        if (!input) return message.send(lang.plugins.pinterest.add_usage.format(config.PREFIX));

        const type = ['i', 's'].includes(args[1]) ? args[1] : 's';
        const idx = type === args[1] ? 2 : 1;
        const count = !isNaN(args[idx]) ? parseInt(args[idx]) : 50;
        const queries = input.split(',').map(q => q.trim()).filter(Boolean);

        const found = [];
        for (const query of queries) found.push(...await fetchLinks(query, count));

        const q = addToQueue(found, type);
        return message.send(lang.plugins.pinterest.add_done.format(q.links.length));
    }

    if (cmd === 'go') {
        if (!loadQueue().links.length) return message.send(lang.plugins.pinterest.queue_empty);
        const { sent, seen, stopped } = await runQueue(message, pid);
        return stopped
            ? message.send(lang.plugins.pinterest.stopped.format(sent, seen))
            : message.send(lang.plugins.pinterest.queue_done.format(sent));
    }

    const mode = ['i', 's'].includes(cmd) ? cmd : null;
    if (!mode) return message.send(lang.plugins.pinterest.invalid_mode);

    const count = !isNaN(args[1]) ? parseInt(args[1]) : (mode === 'i' ? 5 : 50);
    const query = args.slice(!isNaN(args[1]) ? 2 : 1).join(' ');
    if (!query) return message.send(lang.plugins.pinterest.no_query);

    const links = await fetchLinks(query, count);
    if (!links.length) return message.send(lang.plugins.pinterest.no_results);

    addToQueue(links, mode);
    const { sent, seen, stopped } = await runQueue(message, pid);
    if (stopped) await message.send(lang.plugins.pinterest.stopped.format(sent, seen));
});

Command({
    pattern: 'ssize ?(.*)',
    desc: lang.plugins.ssize.desc,
    type: 'sticker',
}, async (message, match) => {
    const s = loadSize();
    const ks = Object.keys(s);

    if (!match?.trim()) {
        const l = ks.map((k, i) => `${i + 1}. ${k[0].toUpperCase() + k.slice(1)}: ${s[k]}`).join('\n');
        return message.send(lang.plugins.ssize.current.format(l));
    }

    const ok = [];
    const bad = [];

    match.split(',').map(x => x.trim()).filter(Boolean).forEach(u => {
        const [n, v] = u.split('=').map(x => x.trim());
        const k = ks[parseInt(n) - 1];

        if (!v || !k) return bad.push(lang.plugins.ssize.invalid_index.format(u));

        const valid = k === 'ratio' ? /^(\d+:\d+)$/.test(v) || v === '0'
            : k === 'placement' ? ['0', '1', '2'].includes(v)
            : k === 'type' ? ['0', 'circle', 'rounded'].includes(v.toLowerCase())
            : false;

        if (!valid) return bad.push(`${k}: ${v} → ${lang.plugins.ssize[`invalid_${k}`]}`);
        s[k] = v.toLowerCase();
        ok.push(`${k}: ${s[k]}`);
    });

    fs.writeFileSync(db, JSON.stringify({ settings: s }, null, 2));
    const res = [
        ok.length ? lang.plugins.ssize.updated.format(ok.join('\n')) : '',
        bad.length ? lang.plugins.ssize.failed.format(bad.join('\n')) : '',
    ].filter(Boolean).join('\n');

    return message.send(res.trim() || lang.plugins.ssize.no_updates);
});