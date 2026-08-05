import {
    Command,
    sticker,
    cropImage,
    roundedCrop,
    circleCrop,
    tempDir,
    pinterest,
    lang,
    config,
    downLoad,
} from '../lib/index.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let sharp = null;
try {
    ({ default: sharp } = await import('sharp'));
    sharp.cache(false);
    sharp.concurrency(1);
} catch {}

const root   = path.dirname(fileURLToPath(import.meta.url));
const media  = path.join(root, '..', 'media');
const db     = path.join(root, '..', 'lib', 'db', 'sticker.json');
const pinDb  = path.join(media, 'pin.json'); 
const active = new Map();

const maxBytes  = 20 * 1024 * 1024;
const chunkSize = 20;
const itemDelay = 100; 
const chunkCool = 500; 
const memSoftMb = 500;
const memHardMb = 800;

const del = f => {
    try { fs.existsSync(f) && fs.unlinkSync(f); } catch {}
};

const wait   = ms => new Promise(r => setTimeout(r, ms));
const memMb  = () => process.memoryUsage().rss / 1024 / 1024;
const gcHint = () => { try { global.gc?.(); } catch {} };

const isSafeUrl = url => {
    try {
        const u = new URL(url);
        if (!/^https?:$/.test(u.protocol)) return false;

        const h = u.hostname.toLowerCase();
        return h !== 'localhost'
            && h !== '0.0.0.0'
            && !h.endsWith('.local')
            && !/^(0|10|127)\./.test(h)
            && !/^169\.254\./.test(h)
            && !/^172\.(1[6-9]|2\d|3[01])\./.test(h)
            && !/^192\.168\./.test(h)
            && !/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)
            && h !== '::1'
            && !h.startsWith('fc')
            && !h.startsWith('fd')
            && !h.startsWith('fe80');
    } catch {
        return false;
    }
};

const load = () => {
    if (!fs.existsSync(db)) {
        fs.mkdirSync(path.dirname(db), { recursive: true });
        fs.writeFileSync(db, JSON.stringify({
            settings: { ratio: '1:1', placement: 1, type: '0' },
        }));
    }
    return JSON.parse(fs.readFileSync(db, 'utf8')).settings;
};

const initPinDb = () => {
    if (!fs.existsSync(media)) fs.mkdirSync(media, { recursive: true });
    if (!fs.existsSync(pinDb)) {
        fs.writeFileSync(pinDb, JSON.stringify({ type: 's', links: [] }, null, 2));
    }
};

const list = () => {
    initPinDb();
    try {
        const raw = fs.readFileSync(pinDb, 'utf8');
        const p   = raw.trim() ? JSON.parse(raw) : { type: 's', links: [] };
        return ({
            type: p.type || 's',
            links: Array.isArray(p.links) ? [...new Set(p.links)] : [],
        });
    } catch {
        return ({ type: 's', links: [] });
    }
};

const save = d => {
    initPinDb();
    try {
        d.links = [...new Set(d.links)]; 
        fs.writeFileSync(pinDb, JSON.stringify(d, null, 2));
        return true;
    } catch {
        return false;
    }
};

const merge = (urls, type) => {
    const q = list();
    q.type  = type || q.type || 's';
    
    const combined = [...q.links, ...urls];
    q.links = [...new Set(combined)];

    save(q);
    return q;
};

const popOne = targetUrl => {
    const d = list();
    d.links = d.links.filter(u => u !== targetUrl);
    save(d);
};

const getBuf = async (url, attempt = 1) => {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);

    try {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            signal: ctrl.signal,
            maxContentLength: maxBytes,
            maxBodyLength: maxBytes,
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        return res.data;
    } catch {
        if (attempt > 2) return null;
        await wait(attempt * 600);
        return getBuf(url, attempt + 1);
    } finally {
        clearTimeout(timer);
    }
};

const make = async (url, type, i) => {
    const temps = [];
    const { ratio, type: shape } = load();

    try {
        const buf = await getBuf(url);
        if (!buf) return ({ error: true, temps });

        const f = path.join(tempDir, `pin_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}.jpg`);
        fs.writeFileSync(f, buf);
        temps.push(f);

        if (type !== 's') return ({ buffer: buf, temps });

        let cur = ratio && ratio !== '0' ? await cropImage(f, { ratio }) : f;
        if (cur !== f) temps.push(cur);

        cur = shape === 'circle'  ? await circleCrop(cur)
            : shape === 'rounded' ? await roundedCrop(cur, 0.1) 
            : cur;

        if (!temps.includes(cur)) temps.push(cur);
        const stic = await sticker(cur);

        return ({ sticker: stic, temps });
    } catch {
        return ({ error: true, temps });
    }
};

Command({
    pattern: 'pinterest ?(.*)',
    aliases: ['pt'],
    desc: lang.plugins.pinterest.desc,
    type: 'media',
}, async (message, match) => {
    const args   = (match || '').trim().split(/\s+/);
    const cmd    = args[0]?.toLowerCase();
    const pid    = message.chat;
    const isDoc  = message.quoted?.document?.txt;

    const sendOne = async (url, mode, i) => {
        const { sticker: stic, buffer: buf, temps } = await make(url, mode, i);
        const ok = stic ? await message.send({ sticker: stic }).catch(() => null)
            : buf       ? await message.send(buf).catch(() => null)
            : null;

        temps?.forEach(del);
        return !!ok;
    };

    const cooldown = async () => {
        gcHint();
        const rss = memMb();

        if (rss <= memSoftMb) return await wait(chunkCool), false;
        if (rss <= memHardMb) return await wait(chunkCool * 2), false;

        await wait(2000);
        gcHint();
        return memMb() > memHardMb;
    };

    const handle = async (links, mode, isQueue = false) => {
        active.set(pid, { stopped: false });
        let sent = 0;

        for (let i = 0; i < links.length; i += chunkSize) {
            if (active.get(pid)?.stopped) break;
            const batch = links.slice(i, i + chunkSize);

            for (const url of batch) {
                if (active.get(pid)?.stopped) break;

                const ok = await sendOne(url, mode, sent).catch(() => false);
                
                if (ok) {
                    sent++;
                    if (isQueue) popOne(url);
                }

                await wait(itemDelay);
            }

            if (await cooldown()) break;
        }

        const stop = active.get(pid)?.stopped;
        active.delete(pid);
        return ({ sent, stop: !!stop, total: links.length });
    };

    if (!match && isDoc) {
        const fpath = await downLoad(message.raw, 'path') || await downLoad(message.quoted, 'path');
        if (!fpath) return message.send(lang.plugins.pinterest.failed);

        const raw   = fs.readFileSync(fpath, 'utf-8').match(/https?:\/\/[^\s]+/g) || [];
        const found = [...new Set(raw)].filter(isSafeUrl);
        del(fpath);

        if (!found.length) return message.send(lang.plugins.pinterest.no_links);

        const q = merge(found, 's');
        const { sent, stop, total } = await handle(q.links, q.type, true);

        return stop
            ? message.send(lang.plugins.pinterest.stopped.format(sent, total))
            : message.send(lang.plugins.pinterest.file_done.format(sent));
    }

    if (!match) return message.send(lang.plugins.pinterest.usage.format(config.PREFIX));

    if (cmd === 'stop') return active.has(pid)
        ? (active.get(pid).stopped = true)
        : message.send(lang.plugins.pinterest.no_active);

    if (cmd === 'add' && isDoc) {
        const fpath = await downLoad(message.raw, 'path') || await downLoad(message.quoted, 'path');
        if (!fpath) return message.send(lang.plugins.pinterest.failed);

        const raw   = fs.readFileSync(fpath, 'utf-8').match(/https?:\/\/[^\s]+/g) || [];
        const found = [...new Set(raw)].filter(isSafeUrl);
        del(fpath);

        if (!found.length) return message.send(lang.plugins.pinterest.no_links);

        const type = ['i', 's'].includes(args[1]) ? args[1] : 's';
        const q    = merge(found, type);
        return message.send(lang.plugins.pinterest.add_done.format(q.links.length));
    }

    if (cmd === 'add') {
        const input = args.slice(1).join(' ');
        if (!input) return message.send(lang.plugins.pinterest.add_usage.format(config.PREFIX));

        const type    = ['i', 's'].includes(args[1]) ? args[1] : 's';
        const idx     = type === args[1] ? 2 : 1;
        const count   = !isNaN(args[idx]) ? parseInt(args[idx]) : 50;
        const queries = input.split(',').map(q => q.trim()).filter(Boolean);

        let found = [];
        for (const query of queries) {
            const res = await axios.post(config.PIN_API || 'http://localhost:3000/scrape', {
                input: query,
                desiredCount: count,
            }, { timeout: 15000 }).catch(() => null);

            const links = (res?.data?.data || (!query.startsWith('http') ? await pinterest(query) : [])).slice(0, count);
            found.push(...links);
        }

        const q = merge(found, type);
        return message.send(lang.plugins.pinterest.add_done.format(q.links.length));
    }

    if (cmd === 'go') {
        const q = list();
        if (!q.links.length) return message.send(lang.plugins.pinterest.queue_empty);

        const { sent, stop, total } = await handle(q.links, q.type, true);
        return stop
            ? message.send(lang.plugins.pinterest.stopped.format(sent, total))
            : message.send(lang.plugins.pinterest.queue_done.format(sent));
    }

    const mode = ['i', 's'].includes(cmd) ? cmd : null;
    if (!mode) return message.send(lang.plugins.pinterest.invalid_mode);

    const count = !isNaN(args[1]) ? parseInt(args[1]) : (mode === 'i' ? 5 : 50);
    const query = args.slice(!isNaN(args[1]) ? 2 : 1).join(' ');
    if (!query) return message.send(lang.plugins.pinterest.no_query);

    const res = await axios.post(config.PIN_API || 'http://localhost:3000/scrape', {
        input: query,
        desiredCount: count,
    }, { timeout: 15000 }).catch(() => null);

    const links = (res?.data?.data || (!query.startsWith('http') ? await pinterest(query) : [])).slice(0, count);
    if (!links.length) return message.send(lang.plugins.pinterest.no_results);

    const { sent, stop, total } = await handle(links, mode);
    if (stop) await message.send(lang.plugins.pinterest.stopped.format(sent, total));
});

Command({
    pattern: 'ssize ?(.*)',
    desc: lang.plugins.ssize.desc,
    type: 'sticker',
}, async (message, match) => {
    const s  = load();
    const ks = Object.keys(s);

    if (!match?.trim()) {
        const l = ks
            .map((k, i) => `${i + 1}. ${k[0].toUpperCase() + k.slice(1)}: ${s[k]}`)
            .join('\n');
        return message.send(lang.plugins.ssize.current.format(l));
    }

    const ok  = [];
    const bad = [];

    match
        .split(',')
        .map(x => x.trim())
        .filter(Boolean)
        .forEach(u => {
            const [n, v] = u.split('=').map(x => x.trim());
            const k = ks[parseInt(n) - 1];

            if (!v || !k) return bad.push(lang.plugins.ssize.invalid_index.format(u));

            const valid = k === 'ratio'     ? /^(\d+:\d+)$/.test(v) || v === '0'
                : k === 'placement' ? ['0', '1', '2'].includes(v)
                : k === 'type'      ? ['0', 'circle', 'rounded'].includes(v.toLowerCase())
                : false;

            if (!valid) return bad.push(`${k}: ${v} → ${lang.plugins.ssize[`invalid_${k}`]}`);
            s[k] = v.toLowerCase();
            ok.push(`${k}: ${s[k]}`);
        });

    fs.writeFileSync(db, JSON.stringify({ settings: s }, null, 2));
    const res = [
        ok.length  ? lang.plugins.ssize.updated.format(ok.join('\n')) : '',
        bad.length ? lang.plugins.ssize.failed.format(bad.join('\n')) : '',
    ]
        .filter(Boolean)
        .join('\n');

    return message.send(res.trim() || lang.plugins.ssize.no_updates);
});