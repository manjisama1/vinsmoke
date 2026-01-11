import { Command, sticker, cropImage, roundedCrop, circleCrop, tempDir, pinterest, lang, config } from '../lib/index.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mediaDir = path.join(__dirname, '..', 'media');
const queueFile = path.join(mediaDir, 'pin.json');
const settingsPath = path.join(__dirname, '..', 'lib', 'db', 'sticker.json');
const activeProcesses = new Map();

const safeDelete = f => fs.existsSync(f) && fs.unlinkSync(f);

const getSet = () => {
    if (!fs.existsSync(settingsPath)) {
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
        fs.writeFileSync(settingsPath, JSON.stringify({ settings: { ratio: '1:1', placement: 1, type: '0' } }));
    }
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8')).settings;
};

const manageDir = () => {
    if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
    if (!fs.existsSync(queueFile)) fs.writeFileSync(queueFile, '');
};

const getQueue = () => {
    manageDir();
    try {
        const d = fs.readFileSync(queueFile, 'utf8');
        const p = d.trim() ? JSON.parse(d) : { type: 's', links: [] };
        return { type: p.type || 's', links: Array.isArray(p.links) ? p.links : (Array.isArray(p) ? p : []) };
    } catch { return { type: 's', links: [] }; }
};

const saveQueue = d => {
    manageDir();
    fs.writeFileSync(queueFile, JSON.stringify(d, null, 2));
};

const popQueue = n => {
    const d = getQueue();
    d.links = d.links.slice(n);
    saveQueue(d);
};

const processMedia = async (url, type, ratio, shape, i) => {
    const temps = [];
    try {
        const buf = (await axios.get(url, { responseType: 'arraybuffer' })).data;
        const f = path.join(tempDir, `pin_${Date.now()}_${i}.jpg`);
        fs.writeFileSync(f, buf);
        temps.push(f);
        if (type !== 's') return { buffer: buf, temps };

        let cur = ratio !== '0' ? await cropImage(f, { ratio }) : f;
        if (cur !== f) temps.push(cur);

        if (shape === 'circle') cur = await circleCrop(cur);
        else if (shape === 'rounded') cur = await roundedCrop(cur, 80);
        if (!temps.includes(cur)) temps.push(cur);

        const stic = await sticker(cur);
        return { sticker: stic, temps };
    } catch (e) { return { error: e, temps }; }
};



Command({
    pattern: 'pinterest ?(.*)',
    aliases: ['pt'],
    desc: lang.plugins.pinterest.desc,
    type: 'media'
}, async (message, match, manji) => {
    const args = (match || '').trim().split(/\s+/);
    const cmd = args[0]?.toLowerCase();
    const pid = message.chat;

    if (!match) return message.send(lang.plugins.pinterest.usage.format(config.PREFIX));

    if (cmd === 'stop') 
        return activeProcesses.has(pid) 
            ? (activeProcesses.get(pid).stopped = true) 
            : message.send(lang.plugins.pinterest.no_active);

    if (cmd === 'add') {
        const input = args.slice(1).join(' ');
        if (!input) return message.send(lang.plugins.pinterest.add_usage.format(config.PREFIX));

        const type = ['i', 's'].includes(args[1]) ? args[1] : 's';
        const count = !isNaN(args[type === args[1] ? 2 : 1]) ? parseInt(args[type === args[1] ? 2 : 1]) : 50;
        const queries = input.split(',').map(q => q.trim()).filter(Boolean);
        const qData = getQueue();
        qData.type = type;

        let added = 0;
        for (const q of queries) {
            const res = await axios.post(config.PIN_API || 'http://localhost:3000/scrape', { input: q, desiredCount: count }).catch(() => null);
            let links = res?.data?.data || (!q.startsWith('http') ? await pinterest(q) : []);
            links = links.slice(0, count);
            qData.links.push(...links);
            added += links.length;
        }
        saveQueue(qData);
        return message.send(lang.plugins.pinterest.add_done.format(added));
    }

    if (cmd === 'go') {
        const qData = getQueue();
        if (!qData.links.length) return message.send(lang.plugins.pinterest.queue_empty);

        activeProcesses.set(pid, { stopped: false });
        const { ratio, type: shape } = getSet();
        let sent = 0;

        try {
            for (const url of qData.links) {
                if (activeProcesses.get(pid)?.stopped) break;
                const { buffer, sticker: stic, temps } = await processMedia(url, qData.type, ratio, shape, sent);
                if (stic) await message.send({ sticker: stic });
                else if (buffer) await message.send(buffer);
                if (stic || buffer) { sent++; popQueue(1); }
                temps?.forEach(safeDelete);
            }
        } finally {
            const stop = activeProcesses.get(pid)?.stopped;
            activeProcesses.delete(pid);
            return stop 
                ? message.send(lang.plugins.pinterest.stopped.format(sent, qData.links.length)) 
                : message.send(lang.plugins.pinterest.queue_done.format(sent));
        }
    }

    const type = ['i', 's'].includes(cmd) ? cmd : null;
    if (!type) return message.send(lang.plugins.pinterest.invalid_mode);

    const count = !isNaN(args[1]) ? parseInt(args[1]) : (type === 'i' ? 5 : 50);
    const query = args.slice(!isNaN(args[1]) ? 2 : 1).join(' ');
    if (!query) return message.send(lang.plugins.pinterest.no_query);

    activeProcesses.set(pid, { stopped: false });
    const res = await axios.post(config.PIN_API || 'http://localhost:3000/scrape', { input: query, desiredCount: count }).catch(() => null);
    let results = (res?.data?.data || (!query.startsWith('http') ? await pinterest(query) : [])).slice(0, count);
    if (!results.length) return message.send(lang.plugins.pinterest.no_results);

    const { ratio, type: shape } = getSet();
    let sent = 0;

    try {
        for (const url of results) {
            if (activeProcesses.get(pid)?.stopped) break;
            const { buffer, sticker: stic, temps } = await processMedia(url, type, ratio, shape, sent);
            if (stic) await message.send({ sticker: stic });
            else if (buffer) await message.send(buffer);
            if (stic || buffer) sent++;
            temps?.forEach(safeDelete);
        }
    } finally {
        const stop = activeProcesses.get(pid)?.stopped;
        activeProcesses.delete(pid);
        if (stop) await message.send(lang.plugins.pinterest.stopped.format(sent, results.length));
    }
});


Command({
    pattern: 'ssize ?(.*)',
    desc: lang.plugins.ssize.desc,
    type: 'sticker'
}, async (message, match) => {
    const settings = getSet();
    const keys = Object.keys(settings);
    
    if (!match?.trim()) {
        const list = keys.map((k, i) => `${i + 1}. ${k[0].toUpperCase() + k.slice(1)}: ${settings[k]}`).join('\n');
        return message.send(lang.plugins.ssize.current.format(list));
    }

    const updates = match.split(',').map(s => s.trim()).filter(Boolean);
    const success = [], failed = [];

    for (const upd of updates) {
        const [num, val] = upd.split('=').map(x => x.trim());
        const key = keys[parseInt(num) - 1];

        if (!val || !key) {
            failed.push(lang.plugins.ssize.invalid_index.format(upd));
            continue;
        }

        const valid = 
            key === 'ratio' ? (/^(\d+:\d+)$/.test(val) || val === '0') :
            key === 'placement' ? ['0', '1', '2'].includes(val) :
            key === 'type' ? ['0', 'circle', 'rounded'].includes(val.toLowerCase()) : false;

        if (!valid) {
            const reason = key === 'ratio' ? lang.plugins.ssize.invalid_ratio : key === 'placement' ? lang.plugins.ssize.invalid_placement : lang.plugins.ssize.invalid_type;
            failed.push(`${key}: ${val} → ${reason}`);
            continue;
        }

        settings[key] = val;
        success.push(`${key}: ${val}`);
    }

    fs.writeFileSync(settingsPath, JSON.stringify({ settings }));
    
    const msg = [
        success.length ? lang.plugins.ssize.updated.format(success.join('\n')) : '',
        failed.length ? lang.plugins.ssize.failed.format(failed.join('\n')) : ''
    ].filter(Boolean).join('\n');

    return message.send(msg.trim() || lang.plugins.ssize.no_updates);
});