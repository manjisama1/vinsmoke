import { Command, downLoad, lang } from '../lib/index.js';

Command({
    pattern: 'promote ?(.*)',
    desc: lang.plugins.promote.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    const users = await manji.getUserJid(message, match);
    if (!users.length) return message.send(lang.plugins.promote.noUser);

    if (!(await manji.isAdmin(message.chat, message.sender)) && !message.isSudo)
        return message.send(lang.plugins.promote.notAllowed);

    if (!(await manji.isBotAdmin(message.chat)))
        return message.send(lang.plugins.promote.botNotAdmin);

    const results = [];
    for (const user of users) {
        const tag = `@${manji.jidToNum(user)}`;
        try {
            const userRole = await manji.getUserRole(message.chat, user);

            if (userRole === 'admin' || userRole === 'superadmin')
                results.push(lang.plugins.promote.alreadyAdmin.format(tag));
            else if (userRole === 'not_member')
                results.push(lang.plugins.promote.notMember.format(tag));
            else {
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
    desc: lang.plugins.demote.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    const users = await manji.getUserJid(message, match);
    if (!users.length) return message.send(lang.plugins.demote.noUser);

    if (!(await manji.isAdmin(message.chat, message.sender)) && !message.isSudo)
        return message.send(lang.plugins.demote.notAllowed);

    if (!(await manji.isBotAdmin(message.chat)))
        return message.send(lang.plugins.demote.botNotAdmin);

    const results = [];
    const botJid = manji.getBotJid();
    const botRole = await manji.getUserRole(message.chat, botJid);


    for (const user of users) {
        const tag = `@${manji.jidToNum(user)}`;
        try {
            const userRole = await manji.getUserRole(message.chat, user);

            if (userRole === 'not_member' || userRole === 'member')
                results.push(lang.plugins.demote.notAdmin.format(tag));
            else if (userRole === 'superadmin' && botRole !== 'superadmin')
                results.push(lang.plugins.demote.cantDemoteSuper.format(tag));
            else if (user === botJid) {
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
    const users = await manji.getUserJid(message, match);
    if (!users.length) return message.send(lang.plugins.kick.noUser);

    if (!(await manji.isAdmin(message.chat, message.sender)) && !message.isSudo) {
        return message.send(lang.plugins.kick.notAllowed);
    }

    if (!(await manji.isBotAdmin(message.chat))) {
        return message.send(lang.plugins.kick.botNotAdmin);
    }

    let results = [];
    for (const user of users) {
        const tag = `@${manji.jidToNum(user)}`;
        try {
            if (!(await manji.isMember(message.chat, user))) {
                results.push(lang.plugins.kick.notMember.format(tag));
            } else if (await manji.isSuperAdmin(message.chat, user)) {
                results.push(lang.plugins.kick.cantKickSuper.format(tag));
            } else if (await manji.isAdmin(message.chat, user) && !(await manji.isBotSuperAdmin(message.chat))) {
                results.push(lang.plugins.kick.cantKickAdmin.format(tag));
            } else if (user === manji.getBotJid()) {
                results.push(lang.plugins.kick.cantKickSelf.format(tag));
            } else {
                await manji.kick(message.chat, user);
                results.push(lang.plugins.kick.success.format(tag));
            }
        } catch (error) {
            results.push(lang.plugins.kick.error.format(tag, error.message));
        }
    }

    return message.send(results.join('\n'), { mentions: users });
});

// This may make you account ban / and i didnt even tested it so use this whith caution.
/*
Command({
    pattern: 'add ?(.*)',
    desc: lang.plugins.add.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    const users = await manji.getUserJid(message, match);
    if (!users.length) return message.send(lang.plugins.add.noUser);

    if (!(await manji.isAdmin(message.chat, message.sender)) && !message.isSudo) {
        return message.send(lang.plugins.add.notAllowed);
    }

    if (!(await manji.isBotAdmin(message.chat))) {
        return message.send(lang.plugins.add.botNotAdmin);
    }

    let results = [];
    for (const user of users) {
        const tag = `@${manji.jidToNum(user)}`;
        try {
            if (await manji.isMember(message.chat, user)) {
                results.push(lang.plugins.add.alreadyMember.format(tag));
            } else {
                await manji.add(message.chat, user);
                results.push(lang.plugins.add.success.format(tag));
            }
        } catch (error) {
            results.push(lang.plugins.add.error.format(tag, error.message));
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
    if (!(await manji.isAdmin(message.chat, message.sender)) && !message.isSudo) {
        return message.send(lang.plugins.open.notAllowed);
    }

    if (!(await manji.isBotAdmin(message.chat))) {
        return message.send(lang.plugins.open.botNotAdmin);
    }

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
    } catch (error) {
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
    if (!(await manji.isAdmin(message.chat, message.sender)) && !message.isSudo) {
        return message.send(lang.plugins.close.notAllowed);
    }

    if (!(await manji.isBotAdmin(message.chat))) {
        return message.send(lang.plugins.close.botNotAdmin);
    }

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
    } catch (error) {
        await message.send(lang.plugins.close.failed);
    }
});
Command({
    pattern: 'disappear ?(.*)',
    desc: lang.plugins.disappear.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    if (!(await manji.isAdmin(message.chat, message.sender)) && !message.isSudo) {
        return message.send(lang.plugins.disappear.notAllowed);
    }

    if (!(await manji.isBotAdmin(message.chat))) {
        return message.send(lang.plugins.disappear.botNotAdmin);
    }

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

            await client.sendMessage(message.chat, {
                disappearingMessagesInChat: seconds
            });
            await message.send(lang.plugins.disappear.enabled.format(duration));
        } else {
            await client.sendMessage(message.chat, {
                disappearingMessagesInChat: false
            });
            await message.send(lang.plugins.disappear.disabled);
        }
    } catch (error) {
        await message.send(lang.plugins.disappear.failed);
    }
});

Command({
    pattern: 'gsetting ?(.*)',
    desc: lang.plugins.gsetting.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    if (!(await manji.isAdmin(message.chat, message.sender)) && !message.isSudo) {
        return message.send(lang.plugins.gsetting.notAllowed);
    }

    if (!(await manji.isBotAdmin(message.chat))) {
        return message.send(lang.plugins.gsetting.botNotAdmin);
    }

    const action = match ? match.toLowerCase() : '';
    if (!['admin', 'all'].includes(action)) {
        return message.send(lang.plugins.gsetting.usage);
    }

    try {
        if (action === 'admin') {
            await manji.lock(message.chat);
        } else {
            await manji.unlock(message.chat);
        }

        await message.send(lang.plugins.gsetting.updated.format(action));
    } catch (error) {
        await message.send(lang.plugins.gsetting.failed);
    }
});


Command({
    pattern: 'accept ?(.*)',
    desc: lang.plugins.accept.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    if (!(await manji.isAdmin(message.chat, message.sender)) && !message.isSudo) {
        return message.send(lang.plugins.accept.notAllowed);
    }

    if (!(await manji.isBotAdmin(message.chat))) {
        return message.send(lang.plugins.accept.botNotAdmin);
    }

    try {
        const pendingRequests = await manji.getPendingRequests(message.chat);

        if (pendingRequests.length === 0) {
            return message.send(lang.plugins.accept.noPending);
        }

        let usersToAccept = [];

        if (!match || !match.trim()) {
            usersToAccept = pendingRequests.map(r => typeof r === 'string' ? r : (r.jid || r.id));
        } else {
            const numbers = match.split(/[\s,]+/).map(num => {
                const digits = num.replace(/\D/g, '');
                return digits ? manji.numToJid(digits) : null;
            }).filter(Boolean);

            usersToAccept = pendingRequests
                .filter(r => {
                    const jid = typeof r === 'string' ? r : (r.jid || r.id);
                    return numbers.includes(jid);
                })
                .map(r => typeof r === 'string' ? r : (r.jid || r.id));

            if (usersToAccept.length === 0) {
                return message.send(lang.plugins.accept.noMatch);
            }
        }

        try {
            await manji.acceptRequests(message.chat, usersToAccept);
            const results = usersToAccept.map(user =>
                lang.plugins.accept.success.format(`@${manji.jidToNum(user)}`)
            );
            return message.send(results.join('\n'), { mentions: usersToAccept });
        } catch (error) {
            console.error('Error accepting requests:', error);
            return message.send(lang.plugins.accept.failed);
        }
    } catch (error) {
        console.error('Error in accept command:', error);
        await message.send(lang.plugins.accept.failed);
    }
});

Command({
    pattern: 'reject ?(.*)',
    desc: lang.plugins.reject.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    if (!(await manji.isAdmin(message.chat, message.sender)) && !message.isSudo) {
        return message.send(lang.plugins.reject.notAllowed);
    }

    if (!(await manji.isBotAdmin(message.chat))) {
        return message.send(lang.plugins.reject.botNotAdmin);
    }

    try {
        const pendingRequests = await manji.getPendingRequests(message.chat);

        if (pendingRequests.length === 0) {
            return message.send(lang.plugins.reject.noPending);
        }

        let usersToReject = [];

        if (!match || !match.trim()) {
            usersToReject = pendingRequests.map(r => typeof r === 'string' ? r : (r.jid || r.id));
        } else {
            const numbers = match.split(/[\s,]+/).map(num => {
                const digits = num.replace(/\D/g, '');
                return digits ? manji.numToJid(digits) : null;
            }).filter(Boolean);

            usersToReject = pendingRequests
                .filter(r => {
                    const jid = typeof r === 'string' ? r : (r.jid || r.id);
                    return numbers.includes(jid);
                })
                .map(r => typeof r === 'string' ? r : (r.jid || r.id));

            if (usersToReject.length === 0) {
                return message.send(lang.plugins.reject.noMatch);
            }
        }

        try {
            await manji.rejectRequests(message.chat, usersToReject);
            const results = usersToReject.map(user =>
                lang.plugins.reject.success.format(`@${manji.jidToNum(user)}`)
            );
            return message.send(results.join('\n'), { mentions: usersToReject });
        } catch (error) {
            console.error('Error rejecting requests:', error);
            return message.send(lang.plugins.reject.failed);
        }
    } catch (error) {
        console.error('Error in reject command:', error);
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
    if (!(await manji.isAdmin(message.chat, message.sender)) && !message.isSudo) {
        return message.send(lang.plugins.requests.notAllowed);
    }

    try {
        const pendingRequests = await manji.getPendingRequests(message.chat);

        if (pendingRequests.length === 0) {
            return message.send(lang.plugins.requests.empty);
        }

        let requestList = lang.plugins.requests.header.format(pendingRequests.length);
        pendingRequests.forEach((request, index) => {
            const jid = typeof request === 'string' ? request : (request.jid || request.id);
            const number = manji.jidToNum(jid);
            requestList += `${index + 1}. +${number} (@${number})\n`;
        });

        requestList += `\n${lang.plugins.requests.usage}`;

        const mentions = pendingRequests.map(r => typeof r === 'string' ? r : (r.jid || r.id));
        return message.send(requestList, { mentions });
    } catch (error) {
        console.error('Error getting requests:', error);
        await message.send(lang.plugins.requests.failed);
    }
});

Command({
    pattern: 'invite',
    desc: lang.plugins.invite.desc,
    type: 'group',
    group: true,
}, async (message, _, manji) => {
    if (!(await manji.isAdmin(message.chat, message.sender)) && !message.isSudo) {
        return message.send(lang.plugins.invite.notAllowed);
    }

    if (!(await manji.isBotAdmin(message.chat))) {
        return message.send(lang.plugins.invite.notAdmin);
    }

    try {
        const code = await manji.inviteCode(message.chat);
        if (code) {
            await message.send(lang.plugins.invite.success.format(code));
        } else {
            await message.send(lang.plugins.invite.failed);
        }
    } catch (error) {
        console.error('Error getting invite code:', error);
        await message.send(lang.plugins.invite.notAdmin);
    }
});

Command({
    pattern: 'revoke',
    desc: lang.plugins.revoke.desc,
    type: 'group',
    group: true,
}, async (message, _, manji) => {
    if (!(await manji.isAdmin(message.chat, message.sender)) && !message.isSudo) {
        return message.send(lang.plugins.revoke.notAllowed);
    }

    if (!(await manji.isBotAdmin(message.chat))) {
        return message.send(lang.plugins.revoke.notAdmin);
    }

    try {
        await manji.revokeInvite(message.chat);
        await message.send(lang.plugins.revoke.success);
    } catch (error) {
        console.error('Error revoking invite:', error);
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
        (await manji.isAdmin(message.chat, message.sender)) ||
        message.quoted.sender === message.sender;

    if (!canDelete) {
        return message.send(lang.plugins.delete.notAllowed);
    }

    try {
        await message.delete(message.quoted);
        await message.delete(message.raw);
    } catch (error) {
        // Silent fail - no error message
    }
});

Command({
    pattern: 'clear',
    desc: lang.plugins.clear.desc,
    type: 'group',
}, async (message, _, manji) => {
    if (!(await manji.isAdmin(message.chat, message.sender)) && !message.isSudo) {
        return message.send(lang.plugins.clear.notAllowed);
    }

    try {
        await manji.clearChat(message.chat, message.raw);
        await message.send(lang.plugins.clear.success);
    } catch (error) {
        await message.send(lang.plugins.clear.failed);
    }
});

Command({
    pattern: 'ephemeral ?(.*)',
    desc: lang.plugins.ephemeral.desc,
    type: 'group',
}, async (message, match, manji) => {
    if (!match) return message.send(lang.plugins.ephemeral.usage);

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
    if (!message.isSudo) {
        return message.send(lang.plugins.joinGroup.sudoOnly);
    }

    let inviteLink = match;
    if (!inviteLink && message.quoted) {
        inviteLink = message.quoted.text;
    }

    if (!inviteLink) return message.send(lang.plugins.joinGroup.noLink);

    const inviteCode = inviteLink.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/)?.[1];
    if (!inviteCode) return message.send(lang.plugins.joinGroup.invalidLink);

    try {
        const groupInfo = await manji.gInfo(inviteCode);

        await manji.joinGroup(inviteCode);

        if (groupInfo.joinApprovalMode) {
            await message.send(lang.plugins.joinGroup.requestSent);
        } else {
            await message.send(lang.plugins.joinGroup.success);
        }
    } catch (error) {
        console.error('Error joining group:', error);
        await message.send(lang.plugins.joinGroup.failed);
    }
});

Command({
    pattern: 'ginfo ?(.*)',
    desc: lang.plugins.groupInfo.desc,
    type: 'general',
}, async (message, match, manji) => {
    let input = match;
    if (!input && message.quoted) {
        input = message.quoted.text;
    }

    if (!input) return message.send(lang.plugins.groupInfo.noLink);

    try {
        let groupInfo = null;

        if (input.endsWith('@g.us')) {
            try {
                groupInfo = await manji.gdata(input);
            } catch (error) {
                return message.send(lang.plugins.groupInfo.notInGroup);
            }
        } else {
            let inviteCode = input;
            if (input.includes('chat.whatsapp.com/')) {
                inviteCode = input.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/)?.[1];
            }

            if (!inviteCode || !/^[a-zA-Z0-9]+$/.test(inviteCode)) {
                return message.send(lang.plugins.groupInfo.invalidLink);
            }

            groupInfo = await manji.gInfo(inviteCode);
        }

        if (groupInfo) {
            const participants = groupInfo.participants || [];
            const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
            const superAdmins = participants.filter(p => p.admin === 'superadmin');

            const creationDate = new Date((groupInfo.creation || groupInfo.creationTime) * 1000);
            const formattedDate = creationDate.toLocaleDateString();
            const formattedTime = creationDate.toLocaleTimeString();

            const settings = [];
            if (groupInfo.announce) settings.push('Messages: Admins Only');
            else settings.push('Messages: Everyone');

            if (groupInfo.restrict) settings.push('Edit Info: Admins Only');
            else settings.push('Edit Info: Everyone');

            if (groupInfo.joinApprovalMode) settings.push('Join: Approval Required');
            else settings.push('Join: Anyone with Link');

            if (groupInfo.memberAddMode) settings.push('Add Members: Admins Only');
            else settings.push('Add Members: Everyone');

            const superAdminNumbers = superAdmins.length > 0
                ? superAdmins.map(admin => manji.jidToNum(admin.id)).join(', ')
                : 'None';

            const info = lang.plugins.groupInfo.template.format(
                groupInfo.subject || 'Unknown',
                groupInfo.id || 'Unknown',
                groupInfo.size || participants.length || 'Unknown',
                `${formattedDate} at ${formattedTime}`,
                groupInfo.desc || groupInfo.description || lang.plugins.groupInfo.noDesc,
                admins.length,
                superAdminNumbers,
                groupInfo.isCommunity ? 'Yes' : 'No',
                settings.join('\n• ')
            );
            await message.send(info);
        } else {
            await message.send(lang.plugins.groupInfo.failed);
        }
    } catch (error) {
        console.error('Error getting group info:', error);
        await message.send(lang.plugins.groupInfo.failed.format(error.message));
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

    const gid = message.chat;
    const botJid = message.botJid;

    if (!await manji.isMember(gid, botJid)) return message.send(lang.plugins.gpp.notMember);
    if (!await manji.isBotAdmin(gid)) return message.send(lang.plugins.gpp.notAdmin);

    const arg = (match || '').trim().toLowerCase();
    if (arg === 'remove') {
        await manji.ppUpdate({ jid: gid, action: 'remove' });
        return message.send(lang.plugins.gpp.removed);
    }

    const image = message.image || message.quoted?.image;
    if (!image) return message.send(lang.plugins.gpp.noMedia);

    const media = await downLoad(message.raw, 'buffer');
    if (!media) return message.send(lang.plugins.gpp.downloadFail);

    await manji.ppUpdate({ jid: gid, action: 'add', media });
    await message.send(lang.plugins.gpp.updated);
});


Command({
    pattern: 'gsubject ?(.*)',
    desc: lang.plugins.gsubject.desc,
    type: 'group'
}, async (message, match, manji) => {
    if (!message.isGroup) return await message.send(lang.plugins.gsubject.groupOnly);
    if (!await manji.isBotAdmin(message.chat)) return await message.send(lang.plugins.gsubject.notAdmin);
    if (!match) return await message.send(lang.plugins.gsubject.noText);
    await manji.groupName(message.chat, match);
    await message.send(lang.plugins.gsubject.updated);
});

Command({
    pattern: 'gdesc ?(.*)',
    desc: lang.plugins.gdesc.desc,
    type: 'group'
}, async (message, match, manji) => {
    if (!message.isGroup) return await message.send(lang.plugins.gdesc.groupOnly);
    if (!await manji.isBotAdmin(message.chat)) return await message.send(lang.plugins.gdesc.notAdmin);
    if (!match) return await message.send(lang.plugins.gdesc.noText);
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
    if (!groups || !Object.keys(groups).length) return await message.send(lang.plugins.allgids.empty);

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
        await message.send({
            forward: message.quoted,
            mentions
        });
    } else {
        const text = (match || '').trim();
        if (!text) return message.send('', mentions);
        await message.send({ text, mentions });
    }
});