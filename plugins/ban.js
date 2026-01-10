import { Command, ban, lang, config } from '../lib/index.js';


const auth = async (m, manji) => m.fromMe || manji.envList('SUDO').includes(m.sender) || m.isSudo || (config.ADMIN_VALUE && await m.admin());


Command({
    pattern: 'ban ?(.*)',
    desc: lang.plugins.ban.desc,
    type: 'group',
    group: true
}, async (message, match, manji) => {
    if (!message.isGroup || !await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.ban.botNotAdmin);
    if (!await auth(message, manji)) return message.send(lang.plugins.ban.notAllowed);
    const args = (match || '').trim().split(/\s+/);
    if (args[0]?.toLowerCase() === 'clear') {
        const count = ban.clear(message.chat);
        return message.send(count ? lang.plugins.ban.cleared.format(count) : lang.plugins.ban.noBans);
    }
    if (args[0]?.toLowerCase() === 'list') {
        const users = ban.list(message.chat);
        if (!users.length) return message.send(lang.plugins.ban.noBans);
        const mentions = [];
        let list = lang.plugins.ban.listHeader;
        users.forEach((r, i) => {
            const tag = `@${manji.jidToNum(r.user_id)}`;
            mentions.push(r.user_id);
            list += r.permanent ? lang.plugins.ban.listItemPerm.format(i + 1, tag) : lang.plugins.ban.listItemTemp.format(i + 1, tag, manji.formatTime(r.until_time - Date.now()));
        });
        return message.send(list, { mentions });
    }
    const uids = await manji.getUserJid(message, match);
    if (!uids.length) return message.send(lang.plugins.ban.noUser);
    const dur = match?.match(/(\d+[smhd])+/gi) ? manji.parseTime(match.match(/(\d+[smhd])+/gi).join('')) : null;
    const res = uids.map(u => {
        const tag = `@${manji.jidToNum(u)}`;
        return u === manji.getBotJid() ? lang.plugins.ban.cantBanBot.format(tag) : (dur ? lang.plugins.ban.bannedTemp.format(tag, manji.formatTime(dur)) : lang.plugins.ban.bannedPerm.format(tag));
    });
    const valid = uids.filter(u => u !== manji.getBotJid());
    if (valid.length) ban.update(message.chat, valid, message.sender, dur, 1);
    await message.send(res.join('\n'), { mentions: uids });
});


Command({
    pattern: 'unban ?(.*)',
    desc: lang.plugins.ban.unbanDesc,
    type: 'group',
    group: true
}, async (message, match, manji) => {
    if (!message.isGroup || !await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.ban.botNotAdmin);
    if (!await auth(message, manji)) return message.send(lang.plugins.ban.notAllowed);
    if (match?.toLowerCase() === 'list') {
        const users = ban.list(message.chat, 0);
        if (!users.length) return message.send(lang.plugins.ban.noUnbans);
        const mentions = [];
        let list = lang.plugins.ban.unbanListHeader;
        users.forEach((r, i) => {
            const tag = `@${manji.jidToNum(r.user_id)}`;
            mentions.push(r.user_id);
            r.unbanned_at ? (mentions.push(r.unbanned_by), list += lang.plugins.ban.unbanListItemManual.format(i + 1, tag, `@${manji.jidToNum(r.unbanned_by)}`, new Date(r.unbanned_at).toLocaleDateString())) : list += lang.plugins.ban.unbanListItemAuto.format(i + 1, tag, new Date(r.auto_unbanned_at).toLocaleDateString());
        });
        return message.send(list, { mentions: [...new Set(mentions)] });
    }
    const uids = await manji.getUserJid(message, match);
    if (!uids.length) return message.send(lang.plugins.ban.noUser);
    const res = ban.update(message.chat, uids, message.sender, null, 0).map(r => {
        const tag = `@${manji.jidToNum(r.uid)}`;
        return r.wasBanned ? lang.plugins.ban.unbanned.format(tag) : lang.plugins.ban.notBanned.format(tag);
    });
    await message.send(res.join('\n'), { mentions: uids });
});


Command({
    pattern: 'whoban ?(.*)',
    desc: lang.plugins.ban.whobanDesc,
    type: 'group',
    group: true
}, async (message, match, manji) => {
    if (!message.isGroup || !await auth(message, manji)) return message.send(lang.plugins.ban.notAllowed);
    const uids = await manji.getUserJid(message, match);
    if (!uids.length) return message.send(lang.plugins.ban.noUser);
    const res = uids.map(u => {
        const r = ban.info(message.chat, u);
        const tag = `@${manji.jidToNum(u)}`;
        if (!r || !ban.check(message.chat, u)) return lang.plugins.ban.notBanned.format(tag);
        let info = lang.plugins.ban.whobanInfo.format(tag, `@${manji.jidToNum(r.banned_by)}`, new Date(r.banned_at).toLocaleString());
        return info + (r.permanent ? lang.plugins.ban.whobanPerm : lang.plugins.ban.whobanTemp.format(manji.formatTime(r.until_time - Date.now()), manji.formatTime(r.duration)));
    });
    await message.send(res.join('\n\n'), { mentions: uids });
});


Command({
    pattern: 'whounban ?(.*)',
    desc: lang.plugins.ban.whounbanDesc,
    type: 'group',
    group: true
}, async (message, match, manji) => {
    if (!message.isGroup || !await auth(message, manji)) return message.send(lang.plugins.ban.notAllowed);
    const uids = await manji.getUserJid(message, match);
    if (!uids.length) return message.send(lang.plugins.ban.noUser);
    const res = uids.map(u => {
        const r = ban.info(message.chat, u);
        const tag = `@${manji.jidToNum(u)}`;
        if (!r || (!r.unbanned_at && !r.auto_unbanned_at)) return lang.plugins.ban.neverUnbanned.format(tag);
        let info = lang.plugins.ban.whounbanInfo.format(tag);
        r.unbanned_at ? info += lang.plugins.ban.whounbanManual.format(`@${manji.jidToNum(r.unbanned_by)}`, new Date(r.unbanned_at).toLocaleString()) : info += lang.plugins.ban.whounbanAuto.format(new Date(r.auto_unbanned_at).toLocaleString());
        return info + (r.banned ? lang.plugins.ban.whounbanCurrently : lang.plugins.ban.whounbanNot);
    });
    await message.send(res.join('\n\n'), { mentions: uids });
});