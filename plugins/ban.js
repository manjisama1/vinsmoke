import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command, Tracker, lang } from '../lib/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../db/ban.json');
let globalBanTracker = null;

const loadDB = () => {
  try {
    if (!fs.existsSync(dbPath)) return {};
    return JSON.parse(fs.readFileSync(dbPath, 'utf8') || '{}');
  } catch (e) {
    console.error('Ban loadDB error', e);
    return {};
  }
};

const saveDB = (db) => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('Ban saveDB error', e);
  }
};

const isUserBanned = (groupId, userId) => {
  const db = loadDB();
  const ban = db[groupId]?.users?.[userId];
  if (!ban?.banned) return false;
  
  if (ban.permanent || (ban.until && Date.now() < ban.until)) return true;
  
  if (ban.until && Date.now() >= ban.until) {
    ban.banned = false;
    ban.autoUnbannedAt = Date.now();
    saveDB(db);
  }
  return false;
};

const banFilter = (message) => message.isGroup && !message.fromMe && isUserBanned(message.chat, message.sender);

const banAction = async (message) => {
  try {
    await message.delete(message.raw);
  } catch (e) {
    console.error('Ban delete failed', e);
  }
};

const initializeBan = () => {
  if (globalBanTracker) Tracker.unregister(globalBanTracker);
  globalBanTracker = Tracker.register(banFilter, banAction, { name: 'GlobalBan', description: 'Global ban system for all groups' });
  return globalBanTracker;
};

const checkPermissions = async (message, manji) => {
  if (!(await manji.isBotAdmin(message.chat))) {
    await message.send(lang.plugins.ban.botNotAdmin);
    return false;
  }
  if (!(await manji.isAdmin(message.chat, message.sender)) && !message.isSudo) {
    await message.send(lang.plugins.ban.notAllowed);
    return false;
  }
  return true;
};

const handleClear = async (message) => {
  const db = loadDB();
  const users = db[message.chat]?.users;
  if (!users || !Object.keys(users).length) {
    return message.send(lang.plugins.ban.noBans);
  }
  const userCount = Object.keys(users).length;
  delete db[message.chat];
  saveDB(db);
  return message.send(lang.plugins.ban.cleared.format(userCount));
};

const handleBanList = async (message, manji) => {
  const db = loadDB();
  const users = db[message.chat]?.users;
  if (!users || !Object.keys(users).length) {
    return message.send(lang.plugins.ban.noBans);
  }
  
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
    saveDB(db);
    return message.send(lang.plugins.ban.noBans);
  }
  
  saveDB(db);
  return message.send(list, { mentions });
};

const handleUnbanList = async (message, manji) => {
  const db = loadDB();
  const users = db[message.chat]?.users;
  if (!users || !Object.keys(users).length) {
    return message.send(lang.plugins.ban.noUnbans);
  }
  
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
};

export { initializeBan };

Command({
  pattern: 'ban ?(.*)',
  desc: lang.plugins.ban.desc,
  type: 'group',
  group: true
}, async (message, match, manji) => {
  if (!(await checkPermissions(message, manji))) return;
  
  const args = (match || '').trim().split(/\s+/);
  const cmd = args[0]?.toLowerCase();
  
  if (cmd === 'clear') return handleClear(message);
  if (cmd === 'list') return handleBanList(message, manji);
  
  const users = manji.getUserJid(message, match);
  if (!users.length) return message.send(lang.plugins.ban.noUser);
  
  const db = loadDB();
  if (!db[message.chat]) db[message.chat] = { users: {} };
  
  const timeMatch = match?.match(/(\d+[smhd])+/gi);
  const duration = timeMatch ? manji.parseTime(timeMatch.join('')) : null;
  
  const results = [];
  for (const user of users) {
    const tag = `@${manji.jidToNum(user)}`;
    
    if (user === manji.getBotJid()) {
      results.push(lang.plugins.ban.cantBanBot.format(tag));
      continue;
    }
    
    if (await manji.isAdmin(message.chat, user) && !message.isSudo) {
      results.push(lang.plugins.ban.cantBanAdmin.format(tag));
      continue;
    }
    
    const banData = {
      ...db[message.chat].users[user],
      banned: true,
      bannedAt: Date.now(),
      bannedBy: message.sender,
      permanent: !duration
    };
    
    if (duration) {
      banData.until = Date.now() + duration;
      banData.duration = duration;
    }
    
    db[message.chat].users[user] = banData;
    
    const timeText = duration ? manji.formatTime(duration) : null;
    results.push(timeText ? 
      lang.plugins.ban.bannedTemp.format(tag, timeText) : 
      lang.plugins.ban.bannedPerm.format(tag)
    );
  }
  
  saveDB(db);
  await message.send(results.join('\n'), { mentions: users });
});

Command({
  pattern: 'unban ?(.*)',
  desc: lang.plugins.ban.unbanDesc,
  type: 'group',
  group: true
}, async (message, match, manji) => {
  if (!(await checkPermissions(message, manji))) return;
  
  const args = (match || '').trim().split(/\s+/);
  const cmd = args[0]?.toLowerCase();
  
  if (cmd === 'clear') return handleClear(message);
  if (cmd === 'list') return handleUnbanList(message, manji);
  
  const users = manji.getUserJid(message, match);
  if (!users.length) return message.send(lang.plugins.ban.noUser);
  
  const db = loadDB();
  if (!db[message.chat]?.users) return message.send(lang.plugins.ban.noBans);
  
  const results = [];
  for (const user of users) {
    const tag = `@${manji.jidToNum(user)}`;
    const banData = db[message.chat].users[user];
    
    if (!banData?.banned) {
      results.push(lang.plugins.ban.notBanned.format(tag));
      continue;
    }
    
    banData.banned = false;
    banData.unbannedAt = Date.now();
    banData.unbannedBy = message.sender;
    results.push(lang.plugins.ban.unbanned.format(tag));
  }
  
  saveDB(db);
  await message.send(results.join('\n'), { mentions: users });
});

Command({
  pattern: 'whoban ?(.*)',
  desc: lang.plugins.ban.whobanDesc,
  type: 'group',
  group: true
}, async (message, match, manji) => {
  const users = manji.getUserJid(message, match);
  if (!users.length) return message.send(lang.plugins.ban.noUser);
  
  const db = loadDB();
  const groupBans = db[message.chat];
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
  
  saveDB(db);
  await message.send(results.join('\n\n'), { mentions: [...new Set(mentions)] });
});

Command({
  pattern: 'whounban ?(.*)',
  desc: lang.plugins.ban.whounbanDesc,
  type: 'group',
  group: true
}, async (message, match, manji) => {
  const users = manji.getUserJid(message, match);
  if (!users.length) return message.send(lang.plugins.ban.noUser);
  
  const db = loadDB();
  const groupBans = db[message.chat];
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