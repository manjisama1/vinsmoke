import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command, Tracker, lang } from '../lib/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../db/ban.json');
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

const isBanned = (groupId, userId) => {
  const data = db.load();
  const ban = data[groupId]?.users?.[userId];
  if (!ban?.banned) return false;

  if (ban.permanent || (ban.until && Date.now() < ban.until)) return true;

  if (ban.until && Date.now() >= ban.until) {
    ban.banned = false;
    ban.autoUnbannedAt = Date.now();
    db.save(data);
  }
  return false;
};

const filter = (msg) => {
  if (!msg.isGroup || msg.fromMe) return false;
  return isBanned(msg.chat, msg.sender);
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
    const data = db.load();
    const users = data[message.chat]?.users;
    if (!users || !Object.keys(users).length) return message.send(lang.plugins.ban.noBans);
    const count = Object.keys(users).length;
    delete data[message.chat];
    db.save(data);
    return message.send(lang.plugins.ban.cleared.format(count));
  }

  if (cmd === 'list') {
    const data = db.load();
    const users = data[message.chat]?.users;
    if (!users || !Object.keys(users).length) return message.send(lang.plugins.ban.noBans);

    let list = lang.plugins.ban.listHeader;
    let mentions = [];
    let index = 1;

    for (const [userId, banData] of Object.entries(users)) {
      if (!banData.banned) continue;
      const tag = `@${manji.jidToNum(userId)}`;
      mentions.push(userId);

      if (banData.permanent) {
        list += lang.plugins.ban.listItemPerm.format(index, tag);
      } else if (banData.until && Date.now() < banData.until) {
        const remaining = manji.formatTime(banData.until - Date.now());
        list += lang.plugins.ban.listItemTemp.format(index, tag, remaining);
      } else {
        banData.banned = false;
        banData.autoUnbannedAt = Date.now();
        continue;
      }
      index++;
    }

    if (index === 1) {
      db.save(data);
      return message.send(lang.plugins.ban.noBans);
    }

    db.save(data);
    return message.send(list, { mentions });
  }

  const users = await manji.getUserJid(message, match);
  if (!users.length) return message.send(lang.plugins.ban.noUser);

  const data = db.load();
  if (!data[message.chat]) data[message.chat] = { users: {} };

  const timeMatch = match?.match(/(\d+[smhd])+/gi);
  const duration = timeMatch ? manji.parseTime(timeMatch.join('')) : null;

  const results = [];
  for (const user of users) {
    const tag = `@${manji.jidToNum(user)}`;

    if (user === manji.getBotJid()) {
      results.push(lang.plugins.ban.cantBanBot.format(tag));
      continue;
    }

    const banData = {
      ...data[message.chat].users[user],
      banned: true,
      bannedAt: Date.now(),
      bannedBy: message.sender,
      permanent: !duration
    };

    if (duration) {
      banData.until = Date.now() + duration;
      banData.duration = duration;
    }

    data[message.chat].users[user] = banData;

    const timeText = duration ? manji.formatTime(duration) : null;
    results.push(timeText ?
      lang.plugins.ban.bannedTemp.format(tag, timeText) :
      lang.plugins.ban.bannedPerm.format(tag)
    );
  }

  db.save(data);
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
    const data = db.load();
    const users = data[message.chat]?.users;
    if (!users || !Object.keys(users).length) return message.send(lang.plugins.ban.noUnbans);

    let list = lang.plugins.ban.unbanListHeader;
    let mentions = [];
    let index = 1;

    for (const [userId, banData] of Object.entries(users)) {
      if (banData.banned || (!banData.unbannedAt && !banData.autoUnbannedAt)) continue;
      const tag = `@${manji.jidToNum(userId)}`;
      mentions.push(userId);

      if (banData.unbannedAt && banData.unbannedBy) {
        const unbannedByTag = `@${manji.jidToNum(banData.unbannedBy)}`;
        mentions.push(banData.unbannedBy);
        const unbannedDate = new Date(banData.unbannedAt).toLocaleDateString();
        list += lang.plugins.ban.unbanListItemManual.format(index, tag, unbannedByTag, unbannedDate);
      } else if (banData.autoUnbannedAt) {
        const autoUnbannedDate = new Date(banData.autoUnbannedAt).toLocaleDateString();
        list += lang.plugins.ban.unbanListItemAuto.format(index, tag, autoUnbannedDate);
      }
      index++;
    }

    if (index === 1) return message.send(lang.plugins.ban.noUnbans);
    return message.send(list, { mentions: [...new Set(mentions)] });
  }

  const users = await manji.getUserJid(message, match);
  if (!users.length) return message.send(lang.plugins.ban.noUser);

  const data = db.load();
  if (!data[message.chat]?.users) return message.send(lang.plugins.ban.noBans);

  const results = [];
  for (const user of users) {
    const tag = `@${manji.jidToNum(user)}`;
    const banData = data[message.chat].users[user];

    if (!banData?.banned) {
      results.push(lang.plugins.ban.notBanned.format(tag));
      continue;
    }

    banData.banned = false;
    banData.unbannedAt = Date.now();
    banData.unbannedBy = message.sender;
    results.push(lang.plugins.ban.unbanned.format(tag));
  }

  db.save(data);
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

  const data = db.load();
  const groupBans = data[message.chat];
  if (!groupBans?.users) return message.send(lang.plugins.ban.noBans);

  const results = [];
  const mentions = [];

  for (const user of users) {
    const tag = `@${manji.jidToNum(user)}`;
    const banData = groupBans.users[user];

    if (!banData?.banned) {
      results.push(lang.plugins.ban.notBanned.format(tag));
      continue;
    }

    mentions.push(user, banData.bannedBy);

    const bannedByTag = `@${manji.jidToNum(banData.bannedBy)}`;
    const bannedDate = new Date(banData.bannedAt).toLocaleString();

    let info = lang.plugins.ban.whobanInfo.format(tag, bannedByTag, bannedDate);

    if (banData.permanent) {
      info += lang.plugins.ban.whobanPerm;
    } else if (banData.until && Date.now() < banData.until) {
      const remaining = manji.formatTime(banData.until - Date.now());
      const totalDuration = manji.formatTime(banData.duration);
      info += lang.plugins.ban.whobanTemp.format(remaining, totalDuration);
    } else {
      banData.banned = false;
      banData.autoUnbannedAt = Date.now();
      results.push(lang.plugins.ban.notBanned.format(tag));
      continue;
    }

    results.push(info);
  }

  db.save(data);
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

  const data = db.load();
  const groupBans = data[message.chat];
  if (!groupBans?.users) return message.send(lang.plugins.ban.noBans);

  const results = [];
  const mentions = [];

  for (const user of users) {
    const tag = `@${manji.jidToNum(user)}`;
    const banData = groupBans.users[user];

    if (!banData || (!banData.unbannedAt && !banData.autoUnbannedAt)) {
      results.push(lang.plugins.ban.neverUnbanned.format(tag));
      continue;
    }

    mentions.push(user);
    let info = lang.plugins.ban.whounbanInfo.format(tag);

    if (banData.unbannedAt && banData.unbannedBy) {
      mentions.push(banData.unbannedBy);
      const unbannedByTag = `@${manji.jidToNum(banData.unbannedBy)}`;
      const unbannedDate = new Date(banData.unbannedAt).toLocaleString();
      info += lang.plugins.ban.whounbanManual.format(unbannedByTag, unbannedDate);
    } else if (banData.autoUnbannedAt) {
      const autoUnbannedDate = new Date(banData.autoUnbannedAt).toLocaleString();
      info += lang.plugins.ban.whounbanAuto.format(autoUnbannedDate);
    }

    info += banData.banned ? lang.plugins.ban.whounbanCurrently : lang.plugins.ban.whounbanNot;
    results.push(info);
  }

  await message.send(results.join('\n\n'), { mentions: [...new Set(mentions)] });
});
