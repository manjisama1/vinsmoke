import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command, Tracker, config, lang } from '../lib/index.js';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const dbPath = path.join(__dirname, '../db/antiword.json');
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

const normalize = (word) => word.toLowerCase().trim();

const hasDenied = (text, cfg) => {
  if (!text) return false;
  const words = text.toLowerCase().split(/\s+/);
  const allowed = (cfg.allow || []).map(normalize);
  const denied = (cfg.deny || []).map(normalize);
  return words.some(word => {
    const clean = normalize(word);
    return !allowed.includes(clean) && (denied.length ? denied.includes(clean) : false);
  });
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
      await msg.send(lang.plugins.antiword.warning.format(user.split('@')[0], warns, limit), { mentions: [user] });

      if (warns >= limit) {
        const { Manji } = require('../lib');
        const manji = new Manji(msg.client, msg.config);
        await manji.kick(msg.chat, user).catch(() => {});
        await msg.send(lang.plugins.antiword.kickedWarning.format(user.split('@')[0]), { mentions: [user] });
        cfg.warns[user] = 0;
      }
    }

    if (act === 'kick') {
      const { Manji } = require('../lib');
      const manji = new Manji(msg.client, msg.config);
      await manji.kick(msg.chat, user).catch(() => {});
      await msg.send(lang.plugins.antiword.kickedWord.format(user.split('@')[0]), { mentions: [user] });
    }

    data[msg.chat] = cfg;
    db.save(data);
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
    const data = db.load();
    const cfg = data[message.chat] = data[message.chat] || { enabled: false, allow: [], deny: [], action: 'delete', warns: {} };

    if (!cmd) return message.send(lang.plugins.antiword.usage.format(config.PREFIX));

    const actions = {
      on: () => { cfg.enabled = true; return lang.plugins.antiword.enabled; },
      off: () => { cfg.enabled = false; return lang.plugins.antiword.disabled; },
      warn: () => { cfg.action = 'warn'; return lang.plugins.antiword.action.format('warn'); },
      delete: () => { cfg.action = 'delete'; return lang.plugins.antiword.action.format('delete'); },
      kick: () => { cfg.action = 'kick'; return lang.plugins.antiword.action.format('kick'); },
      clear: () => { delete data[message.chat]; return lang.plugins.antiword.cleared; },
      info: () => lang.plugins.antiword.info.format(cfg.enabled, cfg.action, cfg.allow.join(',') || 'null', cfg.deny.join(',') || 'null')
    };

    if (actions[cmd]) {
      await message.send(actions[cmd]());
      db.save(data);
      return;
    }

    if (cmd === 'allow' || cmd === 'deny') {
      const words = args.slice(1).join(' ').split(',').map(w => normalize(w)).filter(Boolean);
      if (!words.length) return message.send(lang.plugins.antiword.wordUsage.format(config.PREFIX, cmd));
      const other = cmd === 'allow' ? 'deny' : 'allow';
      cfg[cmd] = [...new Set([...cfg[cmd], ...words])];
      cfg[other] = cfg[other].filter(word => !words.includes(word));
      await message.send(lang.plugins.antiword.words.format(cmd, cfg[cmd].join(',') || 'null'));
      db.save(data);
      return;
    }

    await message.send(lang.plugins.antiword.invalid);
  } else {
    await message.send(lang.plugins.antiword.notAllowed);
  }
});
