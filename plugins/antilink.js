import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command, Tracker, config, lang } from '../lib/index.js';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const prefix = config.PREFIX || '.';
const dbPath = path.join(__dirname, '../db/antilink.json');
let globalAntilinkTracker = null;

const loadDB = () => {
    try {
        if (!fs.existsSync(dbPath)) return {};
        return JSON.parse(fs.readFileSync(dbPath, 'utf8') || '{}');
    } catch (e) {
        console.error('Antilink loadDB error', e);
        return {};
    }
};

const saveDB = (db) => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error('Antilink saveDB error', e);
    }
};

const getLinks = (text) => {
    if (!text) return [];
    const urlRegex = /(?:https?:\/\/)?(?:www\.)?[\w-]+\.[a-z]{2,}(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?/gi;
    return (text.match(urlRegex) || []).map(l => l.toLowerCase());
};

const normalizeLink = (link) => link.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase();

const hasDeniedLink = (text, group) => {
    const links = getLinks(text).map(normalizeLink);
    if (!links.length) return false;
    const allowed = (group.allow || []).map(normalizeLink);
    const denied = (group.deny || []).map(normalizeLink);
    return links.some(link => !allowed.includes(link) && (denied.length ? denied.includes(link) : true));
};

const antilinkFilter = (message) => {
    const db = loadDB();
    const cfg = db[message.chat];
    return message.isGroup && !message.fromMe && !!message.text && cfg?.enabled && hasDeniedLink(message.text, cfg);
};

const antilinkAction = async (message) => {
    try {
        const db = loadDB();
        const cfg = db[message.chat];
        if (!cfg) return;
        const user = message.sender;
        const action = cfg.action || 'delete';
        if (['delete', 'warn', 'kick'].includes(action)) {
            try { await message.delete(message.raw); } catch (e) { console.error('Antilink delete failed', e); }
        }
        if (action === 'warn') {
            cfg.warns = cfg.warns || {};
            cfg.warns[user] = (cfg.warns[user] || 0) + 1;
            const warns = cfg.warns[user];
            const limit = parseInt(process.env.WARN_LIMIT || '3', 10);
            await message.send(lang.plugins.antilink.warning.format(user.split('@')[0], warns, limit), { mentions: [user] });
            if (warns >= limit) {
                try {
                    const { Manji } = require('../lib');
                    const manji = new Manji(message.client, message.config);
                    await manji.kick(message.chat, user);
                    await message.send(lang.plugins.antilink.kickedWarning.format(user.split('@')[0]), { mentions: [user] });
                    cfg.warns[user] = 0;
                } catch (e) { console.error('Antilink kick on warn failed', e); }
            }
        }
        if (action === 'kick') {
            try {
                const { Manji } = require('../lib');
                const manji = new Manji(message.client, message.config);
                await manji.kick(message.chat, user);
                await message.send(lang.plugins.antilink.kickedLink.format(user.split('@')[0]), { mentions: [user] });
            } catch (e) { console.error('Antilink kick failed', e); }
        }
        db[message.chat] = cfg;
        saveDB(db);
    } catch (e) {
        console.error('Antilink action error', e);
    }
};

const initializeAntilink = () => {
    if (globalAntilinkTracker) Tracker.unregister(globalAntilinkTracker);
    globalAntilinkTracker = Tracker.register(antilinkFilter, antilinkAction, { name: 'GlobalAntilink', description: 'Global antilink system for all groups' });
    return globalAntilinkTracker;
};

export { initializeAntilink };

Command({
    pattern: 'antilink ?(.*)',
    desc: lang.plugins.antilink.desc,
    type: 'group',
    group: true
}, async (message, match) => {
    const chat = message.chat;
    const args = (match || '').trim().split(/\s+/);
    const cmd = args[0]?.toLowerCase();
    const db = loadDB();
    if (!db[chat]) db[chat] = { enabled: false, allow: [], deny: [], action: 'delete', warns: {} };
    const group = db[chat];
    if (!cmd) return message.send(lang.plugins.antilink.usage.format(prefix));
    switch (cmd) {
        case 'on':
            group.enabled = true;
            await message.send(lang.plugins.antilink.enabled);
            break;
        case 'off':
            group.enabled = false;
            await message.send(lang.plugins.antilink.disabled);
            break;
        case 'warn':
        case 'delete':
        case 'kick':
            group.action = cmd;
            await message.send(lang.plugins.antilink.action.format(cmd));
            break;
        case 'allow':
        case 'deny': {
            const links = args.slice(1).join(' ').split(',').map(l => normalizeLink(l.trim())).filter(Boolean);
            if (!links.length) return message.send(lang.plugins.antilink.linkUsage.format(prefix, cmd));
            const otherList = cmd === 'allow' ? 'deny' : 'allow';
            group[cmd] = links;
            group[otherList] = group[otherList].filter(link => !links.includes(link));
            await message.send(lang.plugins.antilink.links.format(cmd, group[cmd].join(',') || 'null'));
            break;
        }
        case 'clear':
            delete db[chat];
            await message.send(lang.plugins.antilink.cleared);
            break;
        case 'info':
            await message.send(lang.plugins.antilink.info.format(group.enabled, group.action, group.allow.join(',') || 'null', group.deny.join(',') || 'null'));
            break;
        default:
            await message.send(lang.plugins.antilink.invalid);
    }
    saveDB(db);
});
