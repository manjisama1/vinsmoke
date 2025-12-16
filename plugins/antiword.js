import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command, Tracker, config, lang } from '../lib/index.js';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const dbPath = path.join(__dirname, '../db/antiword.db');
let tracker = null;

class AntiwordDB {
    constructor() {
        this.db = new Database(dbPath);
        this.setupTables();
        this.prepareStatements();
    }

    setupTables() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS antiword_groups (
                chat_id TEXT PRIMARY KEY,
                enabled INTEGER DEFAULT 0,
                action TEXT DEFAULT 'delete'
            );
            CREATE TABLE IF NOT EXISTS antiword_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                word TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('allow', 'deny')),
                UNIQUE(chat_id, word, type)
            );
            CREATE TABLE IF NOT EXISTS antiword_warns (
                chat_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                warns INTEGER DEFAULT 0,
                PRIMARY KEY(chat_id, user_id)
            );
        `);
    }

    prepareStatements() {
        this.stmts = {
            getGroup: this.db.prepare('SELECT * FROM antiword_groups WHERE chat_id = ?'),
            setGroup: this.db.prepare('INSERT OR REPLACE INTO antiword_groups (chat_id, enabled, action) VALUES (?, ?, ?)'),
            deleteGroup: this.db.prepare('DELETE FROM antiword_groups WHERE chat_id = ?'),
            getWords: this.db.prepare('SELECT word FROM antiword_words WHERE chat_id = ? AND type = ?'),
            setWords: this.db.prepare('INSERT OR REPLACE INTO antiword_words (chat_id, word, type) VALUES (?, ?, ?)'),
            clearWords: this.db.prepare('DELETE FROM antiword_words WHERE chat_id = ? AND type = ?'),
            getWarns: this.db.prepare('SELECT warns FROM antiword_warns WHERE chat_id = ? AND user_id = ?'),
            setWarns: this.db.prepare('INSERT OR REPLACE INTO antiword_warns (chat_id, user_id, warns) VALUES (?, ?, ?)'),
            clearWarns: this.db.prepare('DELETE FROM antiword_warns WHERE chat_id = ?')
        };
    }

    getConfig(chatId) {
        const group = this.stmts.getGroup.get(chatId);
        if (!group) return { enabled: false, action: 'delete', allow: [], deny: [] };
        
        const allow = this.stmts.getWords.all(chatId, 'allow').map(r => r.word);
        const deny = this.stmts.getWords.all(chatId, 'deny').map(r => r.word);
        
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

    setWords(chatId, words, type) {
        this.stmts.clearWords.run(chatId, type);
        for (const word of words) {
            this.stmts.setWords.run(chatId, word, type);
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
        this.stmts.clearWords.run(chatId, 'allow');
        this.stmts.clearWords.run(chatId, 'deny');
        this.stmts.clearWarns.run(chatId);
    }

    close() {
        this.db.close();
    }
}

const db = new AntiwordDB();

const normalize = (word) => word.toLowerCase().trim();

const hasDenied = (text, cfg) => {
  if (!text) return false;
  const words = text.toLowerCase().split(/\s+/);
  const allowed = cfg.allow.map(normalize);
  const denied = cfg.deny.map(normalize);
  return words.some(word => {
    const clean = normalize(word);
    return !allowed.includes(clean) && (denied.length ? denied.includes(clean) : false);
  });
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
      await msg.send(lang.plugins.antiword.warning.format(user.split('@')[0], warns, limit), { mentions: [user] });

      if (warns >= limit) {
        const { Manji } = require('../lib');
        const manji = new Manji(msg.client, msg.config);
        await manji.kick(msg.chat, user).catch(() => {});
        await msg.send(lang.plugins.antiword.kickedWarning.format(user.split('@')[0]), { mentions: [user] });
        db.resetWarns(msg.chat, user);
      }
    }

    if (act === 'kick') {
      const { Manji } = require('../lib');
      const manji = new Manji(msg.client, msg.config);
      await manji.kick(msg.chat, user).catch(() => {});
      await msg.send(lang.plugins.antiword.kickedWord.format(user.split('@')[0]), { mentions: [user] });
    }
  } catch {}
};

const initializeAntiword = () => {
  if (tracker) Tracker.unregister(tracker);
  tracker = Tracker.register(filter, action, { name: 'GlobalAntiword', description: 'Global antiword system' });
  return tracker;
};

export { initializeAntiword };

Command({
  pattern: 'antiword ?(.*)',
  desc: lang.plugins.antiword.desc,
  type: 'group',
  group: true
}, async (message, match, manji) => {
  if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.antiword.botNotAdmin);
  if (message.fromMe || await message.admin()) {
    const args = (match || '').trim().split(/\s+/);
    const cmd = args[0]?.toLowerCase();
    const cfg = db.getConfig(message.chat);

    if (!cmd) return message.send(lang.plugins.antiword.usage.format(config.PREFIX));

    const actions = {
      on: () => { db.setConfig(message.chat, true, cfg.action); return lang.plugins.antiword.enabled; },
      off: () => { db.setConfig(message.chat, false, cfg.action); return lang.plugins.antiword.disabled; },
      warn: () => { db.setConfig(message.chat, cfg.enabled, 'warn'); return lang.plugins.antiword.action.format('warn'); },
      delete: () => { db.setConfig(message.chat, cfg.enabled, 'delete'); return lang.plugins.antiword.action.format('delete'); },
      kick: () => { db.setConfig(message.chat, cfg.enabled, 'kick'); return lang.plugins.antiword.action.format('kick'); },
      clear: () => { db.clearGroup(message.chat); return lang.plugins.antiword.cleared; },
      info: () => lang.plugins.antiword.info.format(cfg.enabled, cfg.action, cfg.allow.join(',') || 'null', cfg.deny.join(',') || 'null')
    };

    if (actions[cmd]) {
      await message.send(actions[cmd]());
      return;
    }

    if (cmd === 'allow' || cmd === 'deny') {
      const words = args.slice(1).join(' ').split(',').map(w => normalize(w)).filter(Boolean);
      if (!words.length) return message.send(lang.plugins.antiword.wordUsage.format(config.PREFIX, cmd));
      
      db.setWords(message.chat, words, cmd);
      const other = cmd === 'allow' ? 'deny' : 'allow';
      const otherWords = db.getConfig(message.chat)[other].filter(word => !words.includes(word));
      db.setWords(message.chat, otherWords, other);
      
      await message.send(lang.plugins.antiword.words.format(cmd, words.join(',') || 'null'));
      return;
    }

    await message.send(lang.plugins.antiword.invalid);
  } else {
    await message.send(lang.plugins.antiword.notAllowed);
  }
});
