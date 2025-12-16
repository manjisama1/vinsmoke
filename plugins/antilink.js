import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command, Tracker, config, lang } from '../lib/index.js';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const dbPath = path.join(__dirname, '../db/antilink.db');
let tracker = null;

class AntilinkDB {
    constructor() {
        this.db = new Database(dbPath);
        this.setupTables();
        this.prepareStatements();
    }

    setupTables() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS antilink_groups (
                chat_id TEXT PRIMARY KEY,
                enabled INTEGER DEFAULT 0,
                action TEXT DEFAULT 'delete'
            );
            CREATE TABLE IF NOT EXISTS antilink_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                link TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('allow', 'deny')),
                UNIQUE(chat_id, link, type)
            );
            CREATE TABLE IF NOT EXISTS antilink_warns (
                chat_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                warns INTEGER DEFAULT 0,
                PRIMARY KEY(chat_id, user_id)
            );
        `);
    }

    prepareStatements() {
        this.stmts = {
            getGroup: this.db.prepare('SELECT * FROM antilink_groups WHERE chat_id = ?'),
            setGroup: this.db.prepare('INSERT OR REPLACE INTO antilink_groups (chat_id, enabled, action) VALUES (?, ?, ?)'),
            deleteGroup: this.db.prepare('DELETE FROM antilink_groups WHERE chat_id = ?'),
            getLinks: this.db.prepare('SELECT link FROM antilink_links WHERE chat_id = ? AND type = ?'),
            setLinks: this.db.prepare('INSERT OR REPLACE INTO antilink_links (chat_id, link, type) VALUES (?, ?, ?)'),
            clearLinks: this.db.prepare('DELETE FROM antilink_links WHERE chat_id = ? AND type = ?'),
            getWarns: this.db.prepare('SELECT warns FROM antilink_warns WHERE chat_id = ? AND user_id = ?'),
            setWarns: this.db.prepare('INSERT OR REPLACE INTO antilink_warns (chat_id, user_id, warns) VALUES (?, ?, ?)'),
            clearWarns: this.db.prepare('DELETE FROM antilink_warns WHERE chat_id = ?')
        };
    }

    getConfig(chatId) {
        const group = this.stmts.getGroup.get(chatId);
        if (!group) return { enabled: false, action: 'delete', allow: [], deny: [] };
        
        const allow = this.stmts.getLinks.all(chatId, 'allow').map(r => r.link);
        const deny = this.stmts.getLinks.all(chatId, 'deny').map(r => r.link);
        
        return {
            enabled: !!group.enabled,
            action: group.action,
            allow,
            deny
        };
    }

    setConfig(chatId, enabled, action) {
        this.stmts.setGroup.run(chatId, enabled ? 1 : 0, action);
    }

    setLinks(chatId, links, type) {
        this.stmts.clearLinks.run(chatId, type);
        for (const link of links) {
            this.stmts.setLinks.run(chatId, link, type);
        }
    }

    getWarns(chatId, userId) {
        const result = this.stmts.getWarns.get(chatId, userId);
        return result ? result.warns : 0;
    }

    addWarn(chatId, userId) {
        const current = this.getWarns(chatId, userId);
        this.stmts.setWarns.run(chatId, userId, current + 1);
        return current + 1;
    }

    resetWarns(chatId, userId) {
        this.stmts.setWarns.run(chatId, userId, 0);
    }

    clearGroup(chatId) {
        this.stmts.deleteGroup.run(chatId);
        this.stmts.clearLinks.run(chatId, 'allow');
        this.stmts.clearLinks.run(chatId, 'deny');
        this.stmts.clearWarns.run(chatId);
    }

    close() {
        this.db.close();
    }
}

const db = new AntilinkDB();

const normalize = (link) => link.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase();

const extractLinks = (text) => {
    if (!text) return [];
    const regex = /(?:https?:\/\/)?(?:www\.)?[\w-]+\.[a-z]{2,}(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?/gi;
    return (text.match(regex) || []).map(normalize);
};

const hasDenied = (text, cfg) => {
    const links = extractLinks(text);
    if (!links.length) return false;
    const allowed = cfg.allow.map(normalize);
    const denied = cfg.deny.map(normalize);
    return links.some(link => !allowed.includes(link) && (denied.length ? denied.includes(link) : true));
};

const filter = async (msg) => {
    if (!msg.isGroup || msg.fromMe || !msg.text) return false;
    const cfg = db.getConfig(msg.chat);
    if (!cfg.enabled) return false;
    if (await msg.admin()) return false;
    return hasDenied(msg.text, cfg);
};

const action = async (msg) => {
    try {
        const cfg = db.getConfig(msg.chat);
        if (!cfg.enabled) return;

        const user = msg.sender;
        const act = cfg.action;

        if (['delete', 'warn', 'kick'].includes(act)) {
            await msg.delete(msg.raw).catch(() => {});
        }

        if (act === 'warn') {
            const warns = db.addWarn(msg.chat, user);
            const limit = parseInt(process.env.WARN_LIMIT || '3', 10);
            await msg.send(lang.plugins.antilink.warning.format(user.split('@')[0], warns, limit), { mentions: [user] });

            if (warns >= limit) {
                const { Manji } = require('../lib');
                const manji = new Manji(msg.client, msg.config);
                await manji.kick(msg.chat, user).catch(() => {});
                await msg.send(lang.plugins.antilink.kickedWarning.format(user.split('@')[0]), { mentions: [user] });
                db.resetWarns(msg.chat, user);
            }
        }

        if (act === 'kick') {
            const { Manji } = require('../lib');
            const manji = new Manji(msg.client, msg.config);
            await manji.kick(msg.chat, user).catch(() => {});
            await msg.send(lang.plugins.antilink.kickedLink.format(user.split('@')[0]), { mentions: [user] });
        }
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
        const cfg = db.getConfig(message.chat);

        if (!cmd) return message.send(lang.plugins.antilink.usage.format(config.PREFIX));

        const actions = {
            on: () => { db.setConfig(message.chat, true, cfg.action); return lang.plugins.antilink.enabled; },
            off: () => { db.setConfig(message.chat, false, cfg.action); return lang.plugins.antilink.disabled; },
            warn: () => { db.setConfig(message.chat, cfg.enabled, 'warn'); return lang.plugins.antilink.action.format('warn'); },
            delete: () => { db.setConfig(message.chat, cfg.enabled, 'delete'); return lang.plugins.antilink.action.format('delete'); },
            kick: () => { db.setConfig(message.chat, cfg.enabled, 'kick'); return lang.plugins.antilink.action.format('kick'); },
            clear: () => { db.clearGroup(message.chat); return lang.plugins.antilink.cleared; },
            info: () => lang.plugins.antilink.info.format(cfg.enabled, cfg.action, cfg.allow.join(',') || 'null', cfg.deny.join(',') || 'null')
        };

        if (actions[cmd]) {
            await message.send(actions[cmd]());
            return;
        }

        if (cmd === 'allow' || cmd === 'deny') {
            const links = args.slice(1).join(' ').split(',').map(l => normalize(l.trim())).filter(Boolean);
            if (!links.length) return message.send(lang.plugins.antilink.linkUsage.format(config.PREFIX, cmd));
            
            db.setLinks(message.chat, links, cmd);
            const other = cmd === 'allow' ? 'deny' : 'allow';
            const otherLinks = db.getConfig(message.chat)[other].filter(link => !links.includes(link));
            db.setLinks(message.chat, otherLinks, other);
            
            await message.send(lang.plugins.antilink.links.format(cmd, links.join(',') || 'null'));
            return;
        }

        await message.send(lang.plugins.antilink.invalid);
    } else {
        await message.send(lang.plugins.antilink.notAllowed);
    }
});
