import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command, Tracker, config, lang } from '../lib/index.js';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const prefix = config.PREFIX || '.';
const dbPath = path.join(__dirname, '../db/antiword.json');
let globalAntiwordTracker = null;

const loadDB = () => {
  try {
    if (!fs.existsSync(dbPath)) return {};
    return JSON.parse(fs.readFileSync(dbPath, 'utf8') || '{}');
  } catch (e) {
    console.error('Antiword loadDB error', e);
    return {};
  }
};

const saveDB = (db) => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('Antiword saveDB error', e);
  }
};

const normalizeWord = (word) => word.toLowerCase().trim();

const hasDeniedWord = (text, group) => {
  if (!text) return false;
  const words = text.toLowerCase().split(/\s+/);
  const allowed = (group.allow || []).map(normalizeWord);
  const denied = (group.deny || []).map(normalizeWord);
  return words.some(word => {
    const cleanWord = normalizeWord(word);
    return !allowed.includes(cleanWord) && (denied.length ? denied.includes(cleanWord) : false);
  });
};

const antiwordFilter = (message) => {
  const db = loadDB();
  const cfg = db[message.chat];
  return message.isGroup && !message.fromMe && !!message.text && cfg?.enabled && hasDeniedWord(message.text, cfg);
};

const antiwordAction = async (message) => {
  try {
    const db = loadDB();
    const cfg = db[message.chat];
    if (!cfg) return;
    const user = message.sender;
    const action = cfg.action || 'delete';
    if (['delete', 'warn', 'kick'].includes(action)) {
      try { await message.delete(message.raw); } catch (e) { console.error('Antiword delete failed', e); }
    }
    if (action === 'warn') {
      cfg.warns = cfg.warns || {};
      cfg.warns[user] = (cfg.warns[user] || 0) + 1;
      const warns = cfg.warns[user];
      const limit = parseInt(process.env.WARN_LIMIT || '3', 10);
      await message.send(lang.plugins.antiword.warning.format(user.split('@')[0], warns, limit), { mentions: [user] });
      if (warns >= limit) {
        try {
          const { Manji } = require('../lib');
          const manji = new Manji(message.client, message.config);
          await manji.kick(message.chat, user);
          await message.send(lang.plugins.antiword.kickedWarning.format(user.split('@')[0]), { mentions: [user] });
          cfg.warns[user] = 0;
        } catch (e) { console.error('Antiword kick on warn failed', e); }
      }
    }
    if (action === 'kick') {
      try {
        const { Manji } = require('../lib');
        const manji = new Manji(message.client, message.config);
        await manji.kick(message.chat, user);
        await message.send(lang.plugins.antiword.kickedWord.format(user.split('@')[0]), { mentions: [user] });
      } catch (e) { console.error('Antiword kick failed', e); }
    }
    db[message.chat] = cfg;
    saveDB(db);
  } catch (e) {
    console.error('Antiword action error', e);
  }
};

const initializeAntiword = () => {
  if (globalAntiwordTracker) Tracker.unregister(globalAntiwordTracker);
  globalAntiwordTracker = Tracker.register(antiwordFilter, antiwordAction, { name: 'GlobalAntiword', description: 'Global antiword system for all groups' });
  return globalAntiwordTracker;
};

export { initializeAntiword };

Command({
  pattern: 'antiword ?(.*)',
  desc: lang.plugins.antiword.desc,
  type: 'group',
  group: true
}, async (message, match) => {
  const chat = message.chat;
  const args = (match || '').trim().split(/\s+/);
  const cmd = args[0]?.toLowerCase();
  const db = loadDB();
  if (!db[chat]) db[chat] = { enabled: false, allow: [], deny: [], action: 'delete', warns: {} };
  const group = db[chat];
  if (!cmd) return message.send(lang.plugins.antiword.usage.format(prefix));
  switch (cmd) {
    case 'on':
      group.enabled = true;
      await message.send(lang.plugins.antiword.enabled);
      break;
    case 'off':
      group.enabled = false;
      await message.send(lang.plugins.antiword.disabled);
      break;
    case 'warn':
    case 'delete':
    case 'kick':
      group.action = cmd;
      await message.send(lang.plugins.antiword.action.format(cmd));
      break;
    case 'allow':
    case 'deny': {
      const words = args.slice(1).join(' ').split(',').map(w => normalizeWord(w)).filter(Boolean);
      if (!words.length) return message.send(lang.plugins.antiword.wordUsage.format(prefix, cmd));
      const otherList = cmd === 'allow' ? 'deny' : 'allow';
      group[cmd] = [...new Set([...group[cmd], ...words])];
      group[otherList] = group[otherList].filter(word => !words.includes(word));
      await message.send(lang.plugins.antiword.words.format(cmd, group[cmd].join(',') || 'null'));
      break;
    }
    case 'clear':
      delete db[chat];
      await message.send(lang.plugins.antiword.cleared);
      break;
    case 'info':
      await message.send(lang.plugins.antiword.info.format(group.enabled, group.action, group.allow.join(',') || 'null', group.deny.join(',') || 'null'));
      break;
    default:
      await message.send(lang.plugins.antiword.invalid);
  }
  saveDB(db);
});