import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command, Tracker, config, lang } from '../lib/index.js';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const dbPath = path.join(__dirname, '../db/antilink.json');
let tracker = null;

const db = {
    load: () => {
        try {
            return fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf8')) : {};
        } catch { return {}; }
    },
    save: (data) => {
        try { fs.writeFileSync(dbPath, JSON.stringify(data, null, 2)); } catch {}
    }
};

const normalize = (link) => link.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase();

const extractLinks = (text) => {
    if (!text) return [];
    const regex = /(?:https?:\/\/)?(?:www\.)?[\w-]+\.[a-z]{2,}(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?/gi;
    return (text.match(regex) || []).map(normalize);
};

const hasDenied = (text, cfg) => {
    const links = extractLinks(text);
    if (!links.length) return false;
    const allowed = (cfg.allow || []).map(normalize);
    const denied = (cfg.deny || []).map(normalize);
    return links.some(link => !allowed.includes(link) && (denied.length ? denied.includes(link) : true));
};

const filter = async (msg) => {
    if (!msg.isGroup || msg.fromMe || !msg.text) return false;
    const cfg = db.load()[msg.chat];
    if (!cfg?.enabled) return false;
    if (await msg.admin()) return false;
    return hasDenied(msg.text, cfg);
};

const action = async (msg) => {
    try {
        const data = db.load();
        const cfg = data[msg.chat];
        if (!cfg) return;

        const user = msg.sender;
        const act = cfg.action || 'delete';

        if (['delete', 'warn', 'kick'].includes(act)) {
            await msg.delete(msg.raw).catch(() => {});
        }

        if (act === 'warn') {
            cfg.warns = cfg.warns || {};
            cfg.warns[user] = (cfg.warns[user] || 0) + 1;
            const warns = cfg.warns[user];
            const limit = parseInt(process.env.WARN_LIMIT || '3', 10);
            await msg.send(lang.plugins.antilink.warning.format(user.split('@')[0], warns, limit), { mentions: [user] });

            if (warns >= limit) {
                const { Manji } = require('../lib');
                const manji = new Manji(msg.client, msg.config);
                await manji.kick(msg.chat, user).catch(() => {});
                await msg.send(lang.plugins.antilink.kickedWarning.format(user.split('@')[0]), { mentions: [user] });
                cfg.warns[user] = 0;
            }
        }

        if (act === 'kick') {
            const { Manji } = require('../lib');
            const manji = new Manji(msg.client, msg.config);
            await manji.kick(msg.chat, user).catch(() => {});
            await msg.send(lang.plugins.antilink.kickedLink.format(user.split('@')[0]), { mentions: [user] });
        }

        data[msg.chat] = cfg;
        db.save(data);
    } catch {}
};

const initializeAntilink = () => {
    if (tracker) Tracker.unregister(tracker);
    tracker = Tracker.register(filter, action, { name: 'GlobalAntilink', description: 'Global antilink system' });
    return tracker;
};

export { initializeAntilink };

Command({
    pattern: 'antilink ?(.*)',
    desc: lang.plugins.antilink.desc,
    type: 'group',
    group: true
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.antilink.botNotAdmin);
    if (message.fromMe || await message.admin()) {
        const args = (match || '').trim().split(/\s+/);
        const cmd = args[0]?.toLowerCase();
        const data = db.load();
        const cfg = data[message.chat] = data[message.chat] || { enabled: false, allow: [], deny: [], action: 'delete', warns: {} };

        if (!cmd) return message.send(lang.plugins.antilink.usage.format(config.PREFIX));

        const actions = {
            on: () => { cfg.enabled = true; return lang.plugins.antilink.enabled; },
            off: () => { cfg.enabled = false; return lang.plugins.antilink.disabled; },
            warn: () => { cfg.action = 'warn'; return lang.plugins.antilink.action.format('warn'); },
            delete: () => { cfg.action = 'delete'; return lang.plugins.antilink.action.format('delete'); },
            kick: () => { cfg.action = 'kick'; return lang.plugins.antilink.action.format('kick'); },
            clear: () => { delete data[message.chat]; return lang.plugins.antilink.cleared; },
            info: () => lang.plugins.antilink.info.format(cfg.enabled, cfg.action, cfg.allow.join(',') || 'null', cfg.deny.join(',') || 'null')
        };

        if (actions[cmd]) {
            await message.send(actions[cmd]());
            db.save(data);
            return;
        }

        if (cmd === 'allow' || cmd === 'deny') {
            const links = args.slice(1).join(' ').split(',').map(l => normalize(l.trim())).filter(Boolean);
            if (!links.length) return message.send(lang.plugins.antilink.linkUsage.format(config.PREFIX, cmd));
            const other = cmd === 'allow' ? 'deny' : 'allow';
            cfg[cmd] = links;
            cfg[other] = cfg[other].filter(link => !links.includes(link));
            await message.send(lang.plugins.antilink.links.format(cmd, cfg[cmd].join(',') || 'null'));
            db.save(data);
            return;
        }

        await message.send(lang.plugins.antilink.invalid);
    } else {
        await message.send(lang.plugins.antilink.notAllowed);
    }
});
