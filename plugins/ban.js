import { Command, banManager, lang } from '../lib/index.js';

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
        const count = banManager.clear(message.chat);
        if (!count) return message.send(lang.plugins.ban.noBans);
        return message.send(lang.plugins.ban.cleared.format(count));
    }

    if (cmd === 'list') {
        const users = banManager.list(message.chat);
        if (!users.length) return message.send(lang.plugins.ban.noBans);

        const mentions = [];
        let list = lang.plugins.ban.listHeader;
        let index = 1;

        for (const banData of users) {
            const tag = `@${manji.jidToNum(banData.user_id)}`;
            mentions.push(banData.user_id);

            if (banData.permanent) {
                list += lang.plugins.ban.listItemPerm.format(index, tag);
                index++;
            } else if (banData.until_time && Date.now() < banData.until_time) {
                const remaining = manji.formatTime(banData.until_time - Date.now());
                list += lang.plugins.ban.listItemTemp.format(index, tag, remaining);
                index++;
            }
        }

        if (index === 1) return message.send(lang.plugins.ban.noBans);
        return message.send(list, { mentions });
    }

    const users = await manji.getUserJid(message, match);
    if (!users.length) return message.send(lang.plugins.ban.noUser);

    const timeMatch = match?.match(/(\d+[smhd])+/gi);
    const duration = timeMatch ? manji.parseTime(timeMatch.join('')) : null;

    const results = [];
    const validUsers = [];

    for (const user of users) {
        const tag = `@${manji.jidToNum(user)}`;

        if (user === manji.getBotJid()) {
            results.push(lang.plugins.ban.cantBanBot.format(tag));
            continue;
        }

        validUsers.push(user);
        const timeText = duration ? manji.formatTime(duration) : null;
        results.push(
            timeText
                ? lang.plugins.ban.bannedTemp.format(tag, timeText)
                : lang.plugins.ban.bannedPerm.format(tag)
        );
    }

    if (validUsers.length) banManager.ban(message.chat, validUsers, message.sender, duration);
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
        const users = banManager.listUnbanned(message.chat);
        if (!users.length) return message.send(lang.plugins.ban.noUnbans);

        const mentions = [];
        let list = lang.plugins.ban.unbanListHeader;
        let index = 1;

        for (const banData of users) {
            const tag = `@${manji.jidToNum(banData.user_id)}`;
            mentions.push(banData.user_id);

            if (banData.unbanned_at && banData.unbanned_by) {
                const unbannedByTag = `@${manji.jidToNum(banData.unbanned_by)}`;
                const unbannedDate = new Date(banData.unbanned_at).toLocaleDateString();
                mentions.push(banData.unbanned_by);
                list += lang.plugins.ban.unbanListItemManual.format(index, tag, unbannedByTag, unbannedDate);
                index++;
            } else if (banData.auto_unbanned_at) {
                const autoUnbannedDate = new Date(banData.auto_unbanned_at).toLocaleDateString();
                list += lang.plugins.ban.unbanListItemAuto.format(index, tag, autoUnbannedDate);
                index++;
            }
        }

        if (index === 1) return message.send(lang.plugins.ban.noUnbans);
        return message.send(list, { mentions: [...new Set(mentions)] });
    }

    const users = await manji.getUserJid(message, match);
    if (!users.length) return message.send(lang.plugins.ban.noUser);

    const unbanResults = banManager.unban(message.chat, users, message.sender);
    const results = unbanResults.map(result => {
        const tag = `@${manji.jidToNum(result.user)}`;
        return result.wasBanned
            ? lang.plugins.ban.unbanned.format(tag)
            : lang.plugins.ban.notBanned.format(tag);
    });

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
        const banData = banManager.getInfo(message.chat, user);

        if (!banData || !banManager.isBanned(message.chat, user)) {
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
        const banData = banManager.getInfo(message.chat, user);

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