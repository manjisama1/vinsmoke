import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command, Tracker, lang } from '../lib/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../db/ban.db');
let tracker = null;

class BanDB {
    constructor() {
        this.db = new Database(dbPath);
        this.setupTables();
        this.prepareStatements();
    }

    setupTables() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS bans (
                chat_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                banned INTEGER DEFAULT 0,
                permanent INTEGER DEFAULT 0,
                banned_at INTEGER,
                banned_by TEXT,
                until_time INTEGER,
                duration INTEGER,
                unbanned_at INTEGER,
                unbanned_by TEXT,
                auto_unbanned_at INTEGER,
                PRIMARY KEY(chat_id, user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_bans_chat ON bans(chat_id);
            CREATE INDEX IF NOT EXISTS idx_bans_banned ON bans(banned);
        `);
    }

    prepareStatements() {
        this.stmts = {
            getBan: this.db.prepare('SELECT * FROM bans WHERE chat_id = ? AND user_id = ?'),
            setBan: this.db.prepare(`INSERT OR REPLACE INTO bans 
                (chat_id, user_id, banned, permanent, banned_at, banned_by, until_time, duration) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
            unban: this.db.prepare(`UPDATE bans SET banned = 0, unbanned_at = ?, unbanned_by = ? 
                WHERE chat_id = ? AND user_id = ?`),
            autoUnban: this.db.prepare(`UPDATE bans SET banned = 0, auto_unbanned_at = ? 
                WHERE chat_id = ? AND user_id = ?`),
            getBannedUsers: this.db.prepare('SELECT * FROM bans WHERE chat_id = ? AND banned = 1'),
            getUnbannedUsers: this.db.prepare(`SELECT * FROM bans WHERE chat_id = ? AND banned = 0 
                AND (unbanned_at IS NOT NULL OR auto_unbanned_at IS NOT NULL)`),
            getAllUsers: this.db.prepare('SELECT * FROM bans WHERE chat_id = ?'),
            clearBans: this.db.prepare('DELETE FROM bans WHERE chat_id = ?')
        };
    }

    isBanned(chatId, userId) {
        const ban = this.stmts.getBan.get(chatId, userId);
        if (!ban || !ban.banned) return false;

        if (ban.permanent || (ban.until_time && Date.now() < ban.until_time)) return true;

        if (ban.until_time && Date.now() >= ban.until_time) {
            this.stmts.autoUnban.run(Date.now(), chatId, userId);
            return false;
        }
        return false;
    }

    banUser(chatId, userId, bannedBy, duration = null) {
        const permanent = !duration;
        const untilTime = duration ? Date.now() + duration : null;
        this.stmts.setBan.run(chatId, userId, 1, permanent ? 1 : 0, Date.now(), bannedBy, untilTime, duration);
    }

    unbanUser(chatId, userId, unbannedBy) {
        this.stmts.unban.run(Date.now(), unbannedBy, chatId, userId);
    }

    getBannedUsers(chatId) {
        return this.stmts.getBannedUsers.all(chatId);
    }

    getUnbannedUsers(chatId) {
        return this.stmts.getUnbannedUsers.all(chatId);
    }

    getUserBan(chatId, userId) {
        return this.stmts.getBan.get(chatId, userId);
    }

    clearAllBans(chatId) {
        const result = this.stmts.clearBans.run(chatId);
        return result.changes;
    }

    close() {
        this.db.close();
    }
}

const db = new BanDB();

const filter = (msg) => {
  if (!msg.isGroup || msg.fromMe) return false;
  return db.isBanned(msg.chat, msg.sender);
};

const action = async (msg) => {
  await msg.delete(msg.raw).catch(() => {});
};

const initializeBan = () => {
  if (tracker) Tracker.unregister(tracker);
  tracker = Tracker.register(filter, action, { name: 'GlobalBan', description: 'Global ban system' });
  return tracker;
};

export { initializeBan };

Command({
  pattern: 'ban ?(.*)',
  desc: lang.plugins.ban.desc,
  type: 'group',
  group: true
}, async (message, match, manji) => {
  if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.ban.botNotAdmin);
  if (!message.fromMe && !await message.admin()) return message.send(lang.plugins.ban.notAllowed);

  const args = (match || '').trim().split(/\s+/);
  const cmd = args[0]?.toLowerCase();

  if (cmd === 'clear') {
    const count = db.clearAllBans(message.chat);
    if (!count) return message.send(lang.plugins.ban.noBans);
    return message.send(lang.plugins.ban.cleared.format(count));
  }

  if (cmd === 'list') {
    const users = db.getBannedUsers(message.chat);
    if (!users.length) return message.send(lang.plugins.ban.noBans);

    let list = lang.plugins.ban.listHeader;
    let mentions = [];
    let index = 1;

    for (const banData of users) {
      if (!db.isBanned(message.chat, banData.user_id)) continue;
      const tag = `@${manji.jidToNum(banData.user_id)}`;
      mentions.push(banData.user_id);

      if (banData.permanent) {
        list += lang.plugins.ban.listItemPerm.format(index, tag);
      } else if (banData.until_time && Date.now() < banData.until_time) {
        const remaining = manji.formatTime(banData.until_time - Date.now());
        list += lang.plugins.ban.listItemTemp.format(index, tag, remaining);
      } else {
        continue;
      }
      index++;
    }

    if (index === 1) return message.send(lang.plugins.ban.noBans);
    return message.send(list, { mentions });
  }

  const users = await manji.getUserJid(message, match);
  if (!users.length) return message.send(lang.plugins.ban.noUser);

  const timeMatch = match?.match(/(\d+[smhd])+/gi);
  const duration = timeMatch ? manji.parseTime(timeMatch.join('')) : null;

  const results = [];
  for (const user of users) {
    const tag = `@${manji.jidToNum(user)}`;

    if (user === manji.getBotJid()) {
      results.push(lang.plugins.ban.cantBanBot.format(tag));
      continue;
    }

    db.banUser(message.chat, user, message.sender, duration);

    const timeText = duration ? manji.formatTime(duration) : null;
    results.push(timeText ?
      lang.plugins.ban.bannedTemp.format(tag, timeText) :
      lang.plugins.ban.bannedPerm.format(tag)
    );
  }

  await message.send(results.join('\n'), { mentions: users });
});

Command({
  pattern: 'unban ?(.*)',
  desc: lang.plugins.ban.unbanDesc,
  type: 'group',
  group: true
}, async (message, match, manji) => {
  if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.ban.botNotAdmin);
  if (!message.fromMe && !await message.admin()) return message.send(lang.plugins.ban.notAllowed);

  const args = (match || '').trim().split(/\s+/);
  const cmd = args[0]?.toLowerCase();

  if (cmd === 'list') {
    const users = db.getUnbannedUsers(message.chat);
    if (!users.length) return message.send(lang.plugins.ban.noUnbans);

    let list = lang.plugins.ban.unbanListHeader;
    let mentions = [];
    let index = 1;

    for (const banData of users) {
      const tag = `@${manji.jidToNum(banData.user_id)}`;
      mentions.push(banData.user_id);

      if (banData.unbanned_at && banData.unbanned_by) {
        const unbannedByTag = `@${manji.jidToNum(banData.unbanned_by)}`;
        mentions.push(banData.unbanned_by);
        const unbannedDate = new Date(banData.unbanned_at).toLocaleDateString();
        list += lang.plugins.ban.unbanListItemManual.format(index, tag, unbannedByTag, unbannedDate);
      } else if (banData.auto_unbanned_at) {
        const autoUnbannedDate = new Date(banData.auto_unbanned_at).toLocaleDateString();
        list += lang.plugins.ban.unbanListItemAuto.format(index, tag, autoUnbannedDate);
      }
      index++;
    }

    if (index === 1) return message.send(lang.plugins.ban.noUnbans);
    return message.send(list, { mentions: [...new Set(mentions)] });
  }

  const users = await manji.getUserJid(message, match);
  if (!users.length) return message.send(lang.plugins.ban.noUser);

  const results = [];
  for (const user of users) {
    const tag = `@${manji.jidToNum(user)}`;
    
    if (!db.isBanned(message.chat, user)) {
      results.push(lang.plugins.ban.notBanned.format(tag));
      continue;
    }

    db.unbanUser(message.chat, user, message.sender);
    results.push(lang.plugins.ban.unbanned.format(tag));
  }

  await message.send(results.join('\n'), { mentions: users });
});

Command({
  pattern: 'whoban ?(.*)',
  desc: lang.plugins.ban.whobanDesc,
  type: 'group',
  group: true
}, async (message, match, manji) => {
  const users = await manji.getUserJid(message, match);
  if (!users.length) return message.send(lang.plugins.ban.noUser);

  const results = [];
  const mentions = [];

  for (const user of users) {
    const tag = `@${manji.jidToNum(user)}`;
    const banData = db.getUserBan(message.chat, user);

    if (!banData || !db.isBanned(message.chat, user)) {
      results.push(lang.plugins.ban.notBanned.format(tag));
      continue;
    }

    mentions.push(user, banData.banned_by);

    const bannedByTag = `@${manji.jidToNum(banData.banned_by)}`;
    const bannedDate = new Date(banData.banned_at).toLocaleString();

    let info = lang.plugins.ban.whobanInfo.format(tag, bannedByTag, bannedDate);

    if (banData.permanent) {
      info += lang.plugins.ban.whobanPerm;
    } else if (banData.until_time && Date.now() < banData.until_time) {
      const remaining = manji.formatTime(banData.until_time - Date.now());
      const totalDuration = manji.formatTime(banData.duration);
      info += lang.plugins.ban.whobanTemp.format(remaining, totalDuration);
    } else {
      results.push(lang.plugins.ban.notBanned.format(tag));
      continue;
    }

    results.push(info);
  }

  await message.send(results.join('\n\n'), { mentions: [...new Set(mentions)] });
});

Command({
  pattern: 'whounban ?(.*)',
  desc: lang.plugins.ban.whounbanDesc,
  type: 'group',
  group: true
}, async (message, match, manji) => {
  const users = await manji.getUserJid(message, match);
  if (!users.length) return message.send(lang.plugins.ban.noUser);

  const results = [];
  const mentions = [];

  for (const user of users) {
    const tag = `@${manji.jidToNum(user)}`;
    const banData = db.getUserBan(message.chat, user);

    if (!banData || (!banData.unbanned_at && !banData.auto_unbanned_at)) {
      results.push(lang.plugins.ban.neverUnbanned.format(tag));
      continue;
    }

    mentions.push(user);
    let info = lang.plugins.ban.whounbanInfo.format(tag);

    if (banData.unbanned_at && banData.unbanned_by) {
      mentions.push(banData.unbanned_by);
      const unbannedByTag = `@${manji.jidToNum(banData.unbanned_by)}`;
      const unbannedDate = new Date(banData.unbanned_at).toLocaleString();
      info += lang.plugins.ban.whounbanManual.format(unbannedByTag, unbannedDate);
    } else if (banData.auto_unbanned_at) {
      const autoUnbannedDate = new Date(banData.auto_unbanned_at).toLocaleString();
      info += lang.plugins.ban.whounbanAuto.format(autoUnbannedDate);
    }

    info += banData.banned ? lang.plugins.ban.whounbanCurrently : lang.plugins.ban.whounbanNot;
    results.push(info);
  }

  await message.send(results.join('\n\n'), { mentions: [...new Set(mentions)] });
});
