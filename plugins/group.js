import { Command, lang, config, downLoad } from '../lib/index.js';


Command({
    pattern: 'promote ?(.*)',
    aliases: ['pmt'],
    desc: lang.plugins.promote.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.promote.botNotAdmin);
    if (!message.fromMe && !await message.admin()) return message.send(lang.plugins.promote.notAllowed);

    const users = await manji.getUserJid(message, match);
    if (!users.length) return message.send(lang.plugins.promote.noUser);

    const results = [];
    for (const user of users) {
        const tag = `@${manji.jidToNum(user)}`;
        try {
            const role = await manji.getUserRole(message.chat, user);
            if (role === 'admin' || role === 'superadmin') {
                results.push(lang.plugins.promote.alreadyAdmin.format(tag));
            } else if (role === 'not_member') {
                results.push(lang.plugins.promote.notMember.format(tag));
            } else {
                await manji.promote(message.chat, user);
                results.push(lang.plugins.promote.success.format(tag));
            }
        } catch (e) {
            results.push(lang.plugins.promote.error.format(tag, e.message));
        }
    }

    return message.send(results.join('\n'), { mentions: users });
});


Command({
    pattern: 'demote ?(.*)',
    aliases: ['dmt'],
    desc: lang.plugins.demote.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.demote.botNotAdmin);
    if (!message.fromMe && !await message.admin()) return message.send(lang.plugins.demote.notAllowed);

    const users = await manji.getUserJid(message, match);
    if (!users.length) return message.send(lang.plugins.demote.noUser);

    const botJid = manji.getBotJid();
    const botRole = await manji.getUserRole(message.chat, botJid);
    const results = [];

    for (const user of users) {
        const tag = `@${manji.jidToNum(user)}`;
        try {
            const role = await manji.getUserRole(message.chat, user);
            if (role === 'not_member' || role === 'member') {
                results.push(lang.plugins.demote.notAdmin.format(tag));
            } else if (role === 'superadmin' && botRole !== 'superadmin') {
                results.push(lang.plugins.demote.cantDemoteSuper.format(tag));
            } else if (user === botJid) {
                const admins = await manji.getAdmins(message.chat);
                if (admins.length <= 1) {
                    results.push(lang.plugins.demote.lastAdmin.format(tag));
                    continue;
                }
                await manji.demote(message.chat, user);
                results.push(lang.plugins.demote.success.format(tag));
            } else {
                await manji.demote(message.chat, user);
                results.push(lang.plugins.demote.success.format(tag));
            }
        } catch (e) {
            results.push(lang.plugins.demote.error.format(tag, e.message));
        }
    }

    return message.send(results.join('\n'), { mentions: users });
});


Command({
    pattern: 'kick ?(.*)',
    desc: lang.plugins.kick.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.kick.botNotAdmin);
    if (!message.fromMe && !await message.admin()) return message.send(lang.plugins.kick.notAllowed);

    const users = await manji.getUserJid(message, match);
    if (!users.length) return message.send(lang.plugins.kick.noUser);

    const results = [];
    for (const user of users) {
        const tag = `@${manji.jidToNum(user)}`;
        try {
            if (!await manji.isMember(message.chat, user)) {
                results.push(lang.plugins.kick.notMember.format(tag));
            } else if (await manji.isSuperAdmin(message.chat, user)) {
                results.push(lang.plugins.kick.cantKickSuper.format(tag));
            } else if (await manji.isAdmin(message.chat, user) && !await manji.isBotSuperAdmin(message.chat)) {
                results.push(lang.plugins.kick.cantKickAdmin.format(tag));
            } else if (user === manji.getBotJid()) {
                results.push(lang.plugins.kick.cantKickSelf.format(tag));
            } else {
                await manji.kick(message.chat, user);
                results.push(lang.plugins.kick.success.format(tag));
            }
        } catch (e) {
            results.push(lang.plugins.kick.error.format(tag, e.message));
        }
    }

    return message.send(results.join('\n'), { mentions: users });
});


/*
Command({
    pattern: 'add ?(.*)',
    desc: lang.plugins.add.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.add.botNotAdmin);
    if (!message.fromMe && !await message.admin()) return message.send(lang.plugins.add.notAllowed);

    const users = await manji.getUserJid(message, match);
    if (!users.length) return message.send(lang.plugins.add.noUser);

    const results = [];
    for (const user of users) {
        const tag = `@${manji.jidToNum(user)}`;
        try {
            if (await manji.isMember(message.chat, user)) {
                results.push(lang.plugins.add.alreadyMember.format(tag));
            } else {
                await manji.add(message.chat, user);
                results.push(lang.plugins.add.success.format(tag));
            }
        } catch (e) {
            results.push(lang.plugins.add.error.format(tag, e.message));
        }
    }

    return message.send(results.join('\n'), { mentions: users });
});
*/


Command({
    pattern: 'open ?(.*)',
    aliases: ['unmute'],
    desc: lang.plugins.open.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.open.botNotAdmin);
    if (!message.fromMe && !await message.admin()) return message.send(lang.plugins.open.notAllowed);

    const duration = manji.parseTime(match);

    try {
        await manji.unmute(message.chat);

        if (duration) {
            const timeText = manji.formatTime(duration);
            await message.send(lang.plugins.open.openedFor.format(timeText));
            setTimeout(async () => {
                await manji.mute(message.chat);
                await message.send(lang.plugins.open.closedAfter.format(timeText));
            }, duration);
        } else {
            await message.send(lang.plugins.open.opened);
        }
    } catch {
        await message.send(lang.plugins.open.failed);
    }
});


Command({
    pattern: 'close ?(.*)',
    aliases: ['mute'],
    desc: lang.plugins.close.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.close.botNotAdmin);
    if (!message.fromMe && !await message.admin()) return message.send(lang.plugins.close.notAllowed);

    const duration = manji.parseTime(match);

    try {
        await manji.mute(message.chat);

        if (duration) {
            const timeText = manji.formatTime(duration);
            await message.send(lang.plugins.close.closedFor.format(timeText));
            setTimeout(async () => {
                await manji.unmute(message.chat);
                await message.send(lang.plugins.close.openedAfter.format(timeText));
            }, duration);
        } else {
            await message.send(lang.plugins.close.closed);
        }
    } catch {
        await message.send(lang.plugins.close.failed);
    }
});


Command({
    pattern: 'disappear ?(.*)',
    desc: lang.plugins.disappear.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.disappear.botNotAdmin);
    if (!message.fromMe && !await message.admin()) return message.send(lang.plugins.disappear.notAllowed);

    const args = match ? match.toLowerCase().split(' ') : [];
    const action = args[0];

    if (!action || !['on', 'off'].includes(action)) {
        return message.send(lang.plugins.disappear.usage);
    }

    try {
        const client = manji.client?.sock || manji.client;

        if (action === 'on') {
            const duration = args[1] || '7d';
            const durationMap = { '1d': 86400, '7d': 604800, '90d': 7776000 };
            const seconds = durationMap[duration] || 604800;
            await client.sendMessage(message.chat, { disappearingMessagesInChat: seconds });
            await message.send(lang.plugins.disappear.enabled.format(duration));
        } else {
            await client.sendMessage(message.chat, { disappearingMessagesInChat: false });
            await message.send(lang.plugins.disappear.disabled);
        }
    } catch {
        await message.send(lang.plugins.disappear.failed);
    }
});


Command({
    pattern: 'gsetting ?(.*)',
    desc: lang.plugins.gsetting.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.gsetting.botNotAdmin);
    if (!message.fromMe && !await message.admin()) return message.send(lang.plugins.gsetting.notAllowed);

    const action = match ? match.toLowerCase() : '';
    if (!['admin', 'all'].includes(action)) return message.send(lang.plugins.gsetting.usage);

    try {
        if (action === 'admin') await manji.lock(message.chat);
        else await manji.unlock(message.chat);
        await message.send(lang.plugins.gsetting.updated.format(action));
    } catch {
        await message.send(lang.plugins.gsetting.failed);
    }
});


Command({
    pattern: 'accept ?(.*)',
    desc: lang.plugins.accept.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.accept.botNotAdmin);
    if (!message.fromMe && !await message.admin()) return message.send(lang.plugins.accept.notAllowed);

    try {
        const pending = await manji.getPendingRequests(message.chat);
        if (!pending.length) return message.send(lang.plugins.accept.noPending);

        let users = [];

        if (!match || !match.trim()) {
            users = pending.map(r => typeof r === 'string' ? r : (r.jid || r.id));
        } else {
            const numbers = match.split(/[\s,]+/).map(num => {
                const digits = num.replace(/\D/g, '');
                return digits ? manji.numToJid(digits) : null;
            }).filter(Boolean);

            users = pending
                .filter(r => {
                    const jid = typeof r === 'string' ? r : (r.jid || r.id);
                    return numbers.includes(jid);
                })
                .map(r => typeof r === 'string' ? r : (r.jid || r.id));

            if (!users.length) return message.send(lang.plugins.accept.noMatch);
        }

        await manji.acceptRequests(message.chat, users);
        const results = users.map(user => lang.plugins.accept.success.format(`@${manji.jidToNum(user)}`));
        return message.send(results.join('\n'), { mentions: users });
    } catch {
        await message.send(lang.plugins.accept.failed);
    }
});


Command({
    pattern: 'reject ?(.*)',
    desc: lang.plugins.reject.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.reject.botNotAdmin);
    if (!message.fromMe && !await message.admin()) return message.send(lang.plugins.reject.notAllowed);

    try {
        const pending = await manji.getPendingRequests(message.chat);
        if (!pending.length) return message.send(lang.plugins.reject.noPending);

        let users = [];

        if (!match || !match.trim()) {
            users = pending.map(r => typeof r === 'string' ? r : (r.jid || r.id));
        } else {
            const numbers = match.split(/[\s,]+/).map(num => {
                const digits = num.replace(/\D/g, '');
                return digits ? manji.numToJid(digits) : null;
            }).filter(Boolean);

            users = pending
                .filter(r => {
                    const jid = typeof r === 'string' ? r : (r.jid || r.id);
                    return numbers.includes(jid);
                })
                .map(r => typeof r === 'string' ? r : (r.jid || r.id));

            if (!users.length) return message.send(lang.plugins.reject.noMatch);
        }

        await manji.rejectRequests(message.chat, users);
        const results = users.map(user => lang.plugins.reject.success.format(`@${manji.jidToNum(user)}`));
        return message.send(results.join('\n'), { mentions: users });
    } catch {
        await message.send(lang.plugins.reject.failed);
    }
});


Command({
    pattern: 'requests',
    alliese: ['gset'],
    desc: lang.plugins.requests.desc,
    type: 'group',
    group: true,
}, async (message, _, manji) => {
    if (!message.fromMe && !await message.admin()) return message.send(lang.plugins.requests.notAllowed);

    try {
        const pending = await manji.getPendingRequests(message.chat);
        if (!pending.length) return message.send(lang.plugins.requests.empty);

        let list = lang.plugins.requests.header.format(pending.length);
        pending.forEach((req, i) => {
            const jid = typeof req === 'string' ? req : (req.jid || req.id);
            const num = manji.jidToNum(jid);
            list += `${i + 1}. +${num} (@${num})\n`;
        });

        list += `\n${lang.plugins.requests.usage.format(config.PREFIX)}`;
        const mentions = pending.map(r => typeof r === 'string' ? r : (r.jid || r.id));
        return message.send(list, { mentions });
    } catch {
        await message.send(lang.plugins.requests.failed);
    }
});


Command({
    pattern: 'invite',
    desc: lang.plugins.invite.desc,
    type: 'group',
    group: true,
}, async (message, _, manji) => {
    if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.invite.notAdmin);
    if (!message.fromMe && !await message.admin()) return message.send(lang.plugins.invite.notAllowed);

    try {
        const code = await manji.inviteCode(message.chat);
        if (code) await message.send(lang.plugins.invite.success.format(code));
        else await message.send(lang.plugins.invite.failed);
    } catch {
        await message.send(lang.plugins.invite.notAdmin);
    }
});


Command({
    pattern: 'revoke',
    desc: lang.plugins.revoke.desc,
    type: 'group',
    group: true,
}, async (message, _, manji) => {
    if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.revoke.notAdmin);
    if (!message.fromMe && !await message.admin()) return message.send(lang.plugins.revoke.notAllowed);

    try {
        await manji.revokeInvite(message.chat);
        await message.send(lang.plugins.revoke.success);
    } catch {
        await message.send(lang.plugins.revoke.notAdmin);
    }
});


Command({
    pattern: 'delete',
    aliases: ['del', 'dlt'],
    desc: lang.plugins.delete.desc,
    type: 'group',
}, async (message, _, manji) => {
    if (!message.quoted) return message.send(lang.plugins.delete.noQuoted);

    const canDelete = message.isSudo ||
        (await message.admin()) ||
        message.quoted.sender === message.sender;

    if (!canDelete) return message.send(lang.plugins.delete.notAllowed);

    try {
        await message.delete(message.quoted);
        await message.delete(message.raw);
    } catch {}
});


Command({
    pattern: 'clear',
    desc: lang.plugins.clear.desc,
    type: 'group',
}, async (message, _, manji) => {
    if (!message.fromMe && !await message.admin()) return message.send(lang.plugins.clear.notAllowed);

    try {
        await manji.clearChat(message.chat, message.raw);
        await message.send(lang.plugins.clear.success);
    } catch {
        await message.send(lang.plugins.clear.failed);
    }
});


Command({
    pattern: 'ephemeral ?(.*)',
    desc: lang.plugins.ephemeral.desc,
    type: 'group',
}, async (message, match, manji) => {
    if (!match) return message.send(lang.plugins.ephemeral.usage.format(config.PREFIX));

    const args = match.split(' ');
    let duration = '7d';
    let text = match;

    if (args[0] && ['1d', '7d', '90d'].includes(args[0])) {
        duration = args[0];
        text = args.slice(1).join(' ');
    }

    if (!text.trim()) return message.send(lang.plugins.ephemeral.noText);
    await manji.sendEphemeral(message.chat, { text }, duration);
});


Command({
    pattern: 'join ?(.*)',
    desc: lang.plugins.joinGroup.desc,
    type: 'general',
}, async (message, match, manji) => {
    if (!message.isSudo) return message.send(lang.plugins.joinGroup.sudoOnly);

    let link = match || message.quoted?.text;
    if (!link) return message.send(lang.plugins.joinGroup.noLink);

    const code = link.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/)?.[1];
    if (!code) return message.send(lang.plugins.joinGroup.invalidLink);

    try {
        const info = await manji.gInfo(code);
        await manji.joinGroup(code);
        await message.send(info.joinApprovalMode ? lang.plugins.joinGroup.requestSent : lang.plugins.joinGroup.success);
    } catch {
        await message.send(lang.plugins.joinGroup.failed);
    }
});

//have to use lang properly for settings
Command({
    pattern: 'ginfo ?(.*)',
    desc: lang.plugins.groupInfo.desc,
    type: 'general',
}, async (message, match, manji) => {
    let input = match || message.quoted?.text;
    if (!input) return message.send(lang.plugins.groupInfo.noLink);

    try {
        let info = null;

        if (input.endsWith('@g.us')) {
            try {
                info = await manji.gdata(input);
            } catch {
                return message.send(lang.plugins.groupInfo.notInGroup);
            }
        } else {
            let code = input;
            if (input.includes('chat.whatsapp.com/')) {
                code = input.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/)?.[1];
            }

            if (!code || !/^[a-zA-Z0-9]+$/.test(code)) {
                return message.send(lang.plugins.groupInfo.invalidLink);
            }

            info = await manji.gInfo(code);
        }

        if (info) {
            const participants = info.participants || [];
            const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
            const superAdmins = participants.filter(p => p.admin === 'superadmin');

            const date = new Date((info.creation || info.creationTime) * 1000);
            const formattedDate = `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;

            const settings = [];
            if (info.announce) settings.push('Messages: Admins Only');
            else settings.push('Messages: Everyone');
            if (info.restrict) settings.push('Edit Info: Admins Only');
            else settings.push('Edit Info: Everyone');
            if (info.joinApprovalMode) settings.push('Join: Approval Required');
            else settings.push('Join: Anyone with Link');
            if (info.memberAddMode) settings.push('Add Members: Admins Only');
            else settings.push('Add Members: Everyone');

            const superAdminNums = superAdmins.length > 0
                ? superAdmins.map(a => manji.jidToNum(a.id)).join(', ')
                : 'None';

            const text = lang.plugins.groupInfo.template.format(
                info.subject || 'Unknown',
                info.id || 'Unknown',
                info.size || participants.length || 'Unknown',
                formattedDate,
                info.desc || info.description || lang.plugins.groupInfo.noDesc,
                admins.length,
                superAdminNums,
                info.isCommunity ? 'Yes' : 'No',
                settings.join('\n• ')
            );
            await message.send(text);
        } else {
            await message.send(lang.plugins.groupInfo.failed);
        }
    } catch (e) {
        await message.send(lang.plugins.groupInfo.failed.format(e.message));
    }
});


Command({
    pattern: 'leave',
    aliases: ['left'],
    desc: lang.plugins.leave.desc,
    type: 'group',
    group: true,
}, async (message, _, manji) => {
    if (!message.isSudo) return;
    await manji.leaveGroup(message.chat);
});


Command({
    pattern: 'gpp ?(.*)',
    desc: lang.plugins.gpp.desc,
    type: 'group'
}, async (message, match, manji) => {
    if (!message.isGroup) return message.send(lang.plugins.gpp.groupOnly);
    if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.gpp.notAdmin);

    const arg = (match || '').trim().toLowerCase();
    if (arg === 'remove') {
        await manji.ppUpdate({ jid: message.chat, action: 'remove' });
        return message.send(lang.plugins.gpp.removed);
    }

    const image = message.image || message.quoted?.image;
    if (!image) return message.send(lang.plugins.gpp.noMedia);

    const media = await downLoad(message.raw, 'buffer');
    if (!media) return message.send(lang.plugins.gpp.downloadFail);

    await manji.ppUpdate({ jid: message.chat, action: 'add', media });
    await message.send(lang.plugins.gpp.updated);
});

Command({
    pattern: 'gsubject ?(.*)',
    desc: lang.plugins.gsubject.desc,
    type: 'group'
}, async (message, match, manji) => {
    if (!message.isGroup) return message.send(lang.plugins.gsubject.groupOnly);
    if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.gsubject.notAdmin);
    if (!match) return message.send(lang.plugins.gsubject.noText);
    await manji.groupName(message.chat, match);
    await message.send(lang.plugins.gsubject.updated);
});


Command({
    pattern: 'gdesc ?(.*)',
    desc: lang.plugins.gdesc.desc,
    type: 'group'
}, async (message, match, manji) => {
    if (!message.isGroup) return message.send(lang.plugins.gdesc.groupOnly);
    if (!await manji.isBotAdmin(message.chat)) return message.send(lang.plugins.gdesc.notAdmin);
    if (!match) return message.send(lang.plugins.gdesc.noText);
    await manji.groupDescription(message.chat, match);
    await message.send(lang.plugins.gdesc.updated);
});


Command({
    pattern: 'allgids',
    aliases: ['gjid'],
    desc: lang.plugins.allgids.desc,
    type: 'tools'
}, async (message, _, manji) => {
    const groups = await manji.allGroupData();
    if (!groups || !Object.keys(groups).length) return message.send(lang.plugins.allgids.empty);

    const list = Object.values(groups)
        .map((g, i) => `${i + 1}. ${g.subject || lang.plugins.allgids.unnamed}\n> ${g.id}`)
        .join('\n\n');

    await message.send(list);
});


Command({
    pattern: 'tagall',
    desc: lang.plugins.tagall.desc,
    type: 'group',
    group: true
}, async (message, _, manji) => {
    const data = await manji.gdata(message.chat);
    if (!data.participants.length) return;

    const header = lang.plugins.tagall.header;
    const mentions = [];
    const body = data.participants.map((p, i) => {
        mentions.push(p.id);
        return lang.plugins.tagall.format.format(i + 1, p.id.split('@')[0]);
    }).join('\n');

    const text = header ? `${header}\n${body}` : body;
    await message.send({ text, mentions });
});


Command({
    pattern: 'admins',
    desc: lang.plugins.admins.desc,
    type: 'group',
    group: true
}, async (message, _, manji) => {
    const data = await manji.gdata(message.chat);
    const admins = data.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
    if (!admins.length) return message.send(lang.plugins.admins.empty);

    const header = lang.plugins.admins.header;
    const mentions = [];
    const body = admins.map((p, i) => {
        mentions.push(p.id);
        return lang.plugins.admins.format.format(i + 1, p.id.split('@')[0]);
    }).join('\n');

    const text = header ? `${header}\n${body}` : body;
    await message.send({ text, mentions });
});


Command({
    pattern: 'nonadmins',
    desc: lang.plugins.nonadmins.desc,
    type: 'group',
    group: true
}, async (message, _, manji) => {
    const data = await manji.gdata(message.chat);
    const nonadmins = data.participants.filter(p => !p.admin);
    if (!nonadmins.length) return message.send(lang.plugins.nonadmins.empty);

    const header = lang.plugins.nonadmins.header;
    const mentions = [];
    const body = nonadmins.map((p, i) => {
        mentions.push(p.id);
        return lang.plugins.nonadmins.format.format(i + 1, p.id.split('@')[0]);
    }).join('\n');

    const text = header ? `${header}\n${body}` : body;
    await message.send({ text, mentions });
});


Command({
    pattern: 'tag ?(.*)',
    desc: lang.plugins.tag.desc,
    type: 'group',
    group: true
}, async (message, match, manji) => {
    const data = await manji.gdata(message.chat);
    if (!data.participants.length) return;

    const mentions = data.participants.map(p => p.id);

    if (message.quoted) {
        await message.send({ forward: message.quoted, mentions });
    } else {
        const text = (match || '').trim();
        if (!text) return message.send('', mentions);
        await message.send({ text, mentions });
    }
});