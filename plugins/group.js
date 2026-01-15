import { Command, lang, config, downLoad } from '../lib/index.js';


Command({
    pattern: 'promote ?(.*)',
    aliases: ['pmt'],
    desc: lang.plugins.promote.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    const isBotAdmin = await manji.isBotAdmin(message.chat);
    if (!isBotAdmin) return await message.send(lang.plugins.promote.botNotAdmin);

    const isSudo = message.fromMe || manji.envList('SUDO').includes(message.sender) || message.isSudo;
    const isAdmin = await message.admin();
    const canExecute = isSudo || (config.ADMIN_VALUE && isAdmin);
    
    if (!canExecute) return await message.send(lang.plugins.promote.notAllowed);

    const users = await manji.getUserJid(message, match);
    if (!users.length) return await message.send(lang.plugins.promote.noUser);

    const results = await Promise.all(users.map(async (user) => {
        const tag = `@${manji.jidToNum(user)}`;
        try {
            const role = await manji.getUserRole(message.chat, user);
            
            return (role === 'admin' || role === 'superadmin') 
                ? lang.plugins.promote.alreadyAdmin.format(tag) 
                : (role === 'not_member') 
                    ? lang.plugins.promote.notMember.format(tag) 
                    : (await manji.promote(message.chat, user), lang.plugins.promote.success.format(tag));
        } catch (e) {
            return lang.plugins.promote.error.format(tag, e.message);
        }
    }));

    await message.send(results.join('\n'), { mentions: users });
});


Command({
    pattern: 'demote ?(.*)',
    aliases: ['dmt'],
    desc: lang.plugins.demote.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    const isBotAdmin = await manji.isBotAdmin(message.chat);
    if (!isBotAdmin) return await message.send(lang.plugins.demote.botNotAdmin);

    const isSudo = message.fromMe || manji.envList('SUDO').includes(message.sender) || message.isSudo;
    const isAdmin = await message.admin();
    const canExecute = isSudo || (config.ADMIN_VALUE && isAdmin);

    if (!canExecute) return await message.send(lang.plugins.demote.notAllowed);

    const users = await manji.getUserJid(message, match);
    if (!users.length) return await message.send(lang.plugins.demote.noUser);

    const botJid = manji.getBotJid();
    const botRole = await manji.getUserRole(message.chat, botJid);

    const results = await Promise.all(users.map(async (user) => {
        const tag = `@${manji.jidToNum(user)}`;
        try {
            const role = await manji.getUserRole(message.chat, user);

            if (role === 'not_member' || role === 'member') return lang.plugins.demote.notAdmin.format(tag);
            if (role === 'superadmin' && botRole !== 'superadmin') return lang.plugins.demote.cantDemoteSuper.format(tag);
            
            if (user === botJid) {
                const admins = await manji.getAdmins(message.chat);
                if (admins.length <= 1) return lang.plugins.demote.lastAdmin.format(tag);
            }

            await manji.demote(message.chat, user);
            return lang.plugins.demote.success.format(tag);
        } catch (e) {
            return lang.plugins.demote.error.format(tag, e.message);
        }
    }));

    await message.send(results.join('\n'), { mentions: users });
});


Command({
    pattern: 'kick ?(.*)',
    desc: lang.plugins.kick.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    const isBotAdmin = await manji.isBotAdmin(message.chat);
    if (!isBotAdmin) return await message.send(lang.plugins.kick.botNotAdmin);

    const isSudo = message.fromMe || manji.envList('SUDO').includes(message.sender) || message.isSudo;
    const isAdmin = await message.admin();
    const canExecute = isSudo || (config.ADMIN_VALUE && isAdmin);

    if (!canExecute) return await message.send(lang.plugins.kick.notAllowed);

    const users = await manji.getUserJid(message, match);
    if (!users.length) return await message.send(lang.plugins.kick.noUser);

    const botJid = manji.getBotJid();
    const isBotSuper = await manji.isBotSuperAdmin(message.chat);

    const results = await Promise.all(users.map(async (user) => {
        const tag = `@${manji.jidToNum(user)}`;
        try {
            if (user === botJid) return lang.plugins.kick.cantKickSelf.format(tag);
            if (!await manji.isMember(message.chat, user)) return lang.plugins.kick.notMember.format(tag);
            
            const role = await manji.getUserRole(message.chat, user);
            if (role === 'superadmin') return lang.plugins.kick.cantKickSuper.format(tag);
            if (role === 'admin' && !isBotSuper) return lang.plugins.kick.cantKickAdmin.format(tag);

            await manji.kick(message.chat, user);
            return lang.plugins.kick.success.format(tag);
        } catch (e) {
            return lang.plugins.kick.error.format(tag, e.message);
        }
    }));

    await message.send(results.join('\n'), { mentions: users });
});


/*
Command({
    pattern: 'add ?(.*)',
    desc: lang.plugins.add.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    const isBotAdmin = await manji.isBotAdmin(message.chat);
    if (!isBotAdmin) return await message.send(lang.plugins.add.botNotAdmin);

    const isSudo = message.fromMe || manji.envList('SUDO').includes(message.sender) || message.isSudo;
    const isAdmin = await message.admin();
    const canExecute = isSudo || (config.ADMIN_VALUE && isAdmin);

    if (!canExecute) return await message.send(lang.plugins.add.notAllowed);

    const users = await manji.getUserJid(message, match);
    if (!users.length) return await message.send(lang.plugins.add.noUser);

    const results = await Promise.all(users.map(async (user) => {
        const tag = `@${manji.jidToNum(user)}`;
        try {
            if (await manji.isMember(message.chat, user)) return lang.plugins.add.alreadyMember.format(tag);

            const res = await manji.add(message.chat, user);
            const status = res[user];

            return status === 200 
                ? lang.plugins.add.success.format(tag)
                : status === 403 
                    ? (await manji.sendInvite(message.chat, user), lang.plugins.add.inviteSent.format(tag))
                    : lang.plugins.add.error.format(tag, `Status: ${status}`);
        } catch (e) {
            return lang.plugins.add.error.format(tag, e.message);
        }
    }));

    await message.send(results.join('\n'), { mentions: users });
});
*/

Command({
    pattern: 'open ?(.*)',
    aliases: ['unmute'],
    desc: lang.plugins.open.desc,
    type: 'group',
    group: true,
}, async (message, match, manji) => {
    const isBotAdmin = await manji.isBotAdmin(message.chat);
    if (!isBotAdmin) return await message.send(lang.plugins.open.botNotAdmin);

    const isSudo = message.fromMe || manji.envList('SUDO').includes(message.sender) || message.isSudo;
    const isAdmin = await message.admin();
    const canExecute = isSudo || (config.ADMIN_VALUE && isAdmin);

    if (!canExecute) return await message.send(lang.plugins.open.notAllowed);

    const duration = manji.parseTime(match);
    const timeText = duration ? manji.formatTime(duration) : null;

    try {
        await manji.unmute(message.chat);
        if (!duration) return await message.send(lang.plugins.open.opened);

        await message.send(lang.plugins.open.openedFor.format(timeText));
        setTimeout(async () => {
            await manji.mute(message.chat);
            await message.send(lang.plugins.open.closedAfter.format(timeText));
        }, duration);
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
    const isBotAdmin = await manji.isBotAdmin(message.chat);
    if (!isBotAdmin) return await message.send(lang.plugins.close.botNotAdmin);

    const isSudo = message.fromMe || manji.envList('SUDO').includes(message.sender) || message.isSudo;
    const isAdmin = await message.admin();
    const canExecute = isSudo || (config.ADMIN_VALUE && isAdmin);

    if (!canExecute) return await message.send(lang.plugins.close.notAllowed);

    const duration = manji.parseTime(match);
    const timeText = duration ? manji.formatTime(duration) : null;

    try {
        await manji.mute(message.chat);
        if (!duration) return await message.send(lang.plugins.close.closed);

        await message.send(lang.plugins.close.closedFor.format(timeText));
        setTimeout(async () => {
            await manji.unmute(message.chat);
            await message.send(lang.plugins.close.openedAfter.format(timeText));
        }, duration);
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
    const isBotAdmin = await manji.isBotAdmin(message.chat);
    if (!isBotAdmin) return await message.send(lang.plugins.disappear.botNotAdmin);

    const isSudo = message.fromMe || manji.envList('SUDO').includes(message.sender) || message.isSudo;
    const isAdmin = await message.admin();
    const canExecute = isSudo || (config.ADMIN_VALUE && isAdmin);

    if (!canExecute) return await message.send(lang.plugins.disappear.notAllowed);

    const args = match?.toLowerCase().split(' ') || [];
    const action = args[0];

    if (!action || !['on', 'off'].includes(action)) return await message.send(lang.plugins.disappear.usage);

    try {
        const client = manji.client?.sock || manji.client;
        const isOn = action === 'on';
        const duration = args[1] || '7d';
        const map = { '1d': 86400, '7d': 604800, '90d': 7776000 };

        await client.sendMessage(message.chat, { disappearingMessagesInChat: isOn ? (map[duration] || 604800) : false });
        await message.send(isOn ? lang.plugins.disappear.enabled.format(duration) : lang.plugins.disappear.disabled);
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
    const isBotAdmin = await manji.isBotAdmin(message.chat);
    if (!isBotAdmin) return await message.send(lang.plugins.gsetting.botNotAdmin);

    const isSudo = message.fromMe || manji.envList('SUDO').includes(message.sender) || message.isSudo;
    const isAdmin = await message.admin();
    const canExecute = isSudo || (config.ADMIN_VALUE && isAdmin);

    if (!canExecute) return await message.send(lang.plugins.gsetting.notAllowed);

    const action = match?.toLowerCase();
    if (!['admin', 'all'].includes(action)) return await message.send(lang.plugins.gsetting.usage);

    try {
        action === 'admin' ? await manji.lock(message.chat) : await manji.unlock(message.chat);
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
    const isBotAdmin = await manji.isBotAdmin(message.chat);
    if (!isBotAdmin) return await message.send(lang.plugins.accept.botNotAdmin);

    const isSudo = message.fromMe || manji.envList('SUDO').includes(message.sender) || message.isSudo;
    const isAdmin = await message.admin();
    const canExecute = isSudo || (config.ADMIN_VALUE && isAdmin);

    if (!canExecute) return await message.send(lang.plugins.accept.notAllowed);

    try {
        const pending = await manji.getPendingRequests(message.chat);
        if (!pending.length) return await message.send(lang.plugins.accept.noPending);

        const numbers = match?.split(/[\s,]+/).map(n => n.replace(/\D/g, '')).filter(Boolean).map(d => manji.numToJid(d)) || [];
        
        const users = !numbers.length 
            ? pending.map(r => r.jid || r.id || r) 
            : pending.map(r => r.jid || r.id || r).filter(jid => numbers.includes(jid));

        if (!users.length) return await message.send(lang.plugins.accept.noMatch);

        await manji.acceptRequests(message.chat, users);
        const results = users.map(u => lang.plugins.accept.success.format(`@${manji.jidToNum(u)}`));
        await message.send(results.join('\n'), { mentions: users });
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
    const isBotAdmin = await manji.isBotAdmin(message.chat);
    if (!isBotAdmin) return await message.send(lang.plugins.reject.botNotAdmin);

    const isSudo = message.fromMe || manji.envList('SUDO').includes(message.sender) || message.isSudo;
    const isAdmin = await message.admin();
    const canExecute = isSudo || (config.ADMIN_VALUE && isAdmin);

    if (!canExecute) return await message.send(lang.plugins.reject.notAllowed);

    try {
        const pending = await manji.getPendingRequests(message.chat);
        if (!pending.length) return await message.send(lang.plugins.reject.noPending);

        const numbers = match?.split(/[\s,]+/).map(n => n.replace(/\D/g, '')).filter(Boolean).map(d => manji.numToJid(d)) || [];
        
        const users = !numbers.length 
            ? pending.map(r => r.jid || r.id || r) 
            : pending.map(r => r.jid || r.id || r).filter(jid => numbers.includes(jid));

        if (!users.length) return await message.send(lang.plugins.reject.noMatch);

        await manji.rejectRequests(message.chat, users);
        const results = users.map(u => lang.plugins.reject.success.format(`@${manji.jidToNum(u)}`));
        await message.send(results.join('\n'), { mentions: users });
    } catch {
        await message.send(lang.plugins.reject.failed);
    }
});


Command({
    pattern: 'requests',
    aliases: ['gset'],
    desc: lang.plugins.requests.desc,
    type: 'group',
    group: true,
}, async (message, _, manji) => {
    const isSudo = message.fromMe || manji.envList('SUDO').includes(message.sender) || message.isSudo;
    const isAdmin = await message.admin();
    const canExecute = isSudo || (config.ADMIN_VALUE && isAdmin);

    if (!canExecute) return await message.send(lang.plugins.requests.notAllowed);

    try {
        const pending = await manji.getPendingRequests(message.chat);
        if (!pending.length) return await message.send(lang.plugins.requests.empty);

        const mentions = pending.map(r => r.jid || r.id || r);
        const list = [
            lang.plugins.requests.header.format(pending.length),
            ...mentions.map((jid, i) => `${i + 1}. +${manji.jidToNum(jid)} (@${manji.jidToNum(jid)})`),
            `\n${lang.plugins.requests.usage.format(config.PREFIX)}`
        ].join('\n');

        await message.send(list, { mentions });
    } catch {
        await message.send(lang.plugins.requests.failed);
    }
});


Command({
    pattern: 'invite',
    aliases: ['inv'],
    desc: lang.plugins.invite.desc,
    type: 'group',
    group: true,
}, async (message, _, manji) => {
    const isBotAdmin = await manji.isBotAdmin(message.chat);
    if (!isBotAdmin) return await message.send(lang.plugins.invite.notAdmin);

    const isSudo = message.fromMe || manji.envList('SUDO').includes(message.sender) || message.isSudo ;
    const isAdmin = await message.admin();
    const canExecute = isSudo || (config.ADMIN_VALUE && isAdmin);

    if (!canExecute) return await message.send(lang.plugins.invite.notAllowed);

    try {
        const code = await manji.inviteCode(message.chat);
        code ? await message.send(lang.plugins.invite.success.format(code)) : await message.send(lang.plugins.invite.failed);
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
    const isBotAdmin = await manji.isBotAdmin(message.chat);
    if (!isBotAdmin) return await message.send(lang.plugins.revoke.notAdmin);

    const isSudo = message.fromMe || manji.envList('SUDO').includes(message.sender) || message.isSudo;
    const isAdmin = await message.admin();
    const canExecute = isSudo || (config.ADMIN_VALUE && isAdmin);

    if (!canExecute) return await message.send(lang.plugins.revoke.notAllowed);

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
    if (!message.quoted) return await message.send(lang.plugins.delete.noQuoted);
    const canDelete = message.isSudo 
        || (await message.admin() && config.ADMIN_VALUE) 
        || manji.envList('SUDO').includes(message.sender);
    if (!canDelete) return await message.send(lang.plugins.delete.notAllowed);
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
    if (!message.fromMe) return await message.send(lang.plugins.clear.notAllowed);
    try {
        await message.delete(message.raw);
        await manji.clearChat(message.chat, message.raw);
    } catch {
        await message.send(lang.plugins.clear.failed);
    }
});


Command({
    pattern: 'ephemeral ?(.*)',
    desc: lang.plugins.ephemeral.desc,
    type: 'group',
}, async (message, match, manji) => {
    if (!match) return await message.send(lang.plugins.ephemeral.usage.format(config.PREFIX));

    const isSudo = message.fromMe 
        || manji.envList('SUDO').includes(message.sender) 
        || message.isSudo;
    const isAdmin = message.isGroup 
        ? await message.admin() 
        : false;
    const canExecute = isSudo 
        || (message.isGroup && config.ADMIN_VALUE && isAdmin);
    if (!canExecute) return await message.send(lang.plugins.ephemeral.notAllowed);
    const args = match.split(' ');
    const map = { '1d': 86400, '7d': 604800, '90d': 7776000 };
    const duration = map[args[0]] ? args[0] : '7d';
    const seconds = map[duration];
    const text = map[args[0]] ? args.slice(1).join(' ') : match;
    if (!text.trim()) return await message.send(lang.plugins.ephemeral.noText);
    await message.send(text.trim(), { 
        ephemeralExpiration: seconds 
    });
});

Command({
    pattern: 'join ?(.*)',
    desc: lang.plugins.joinGroup.desc,
    type: 'owner',
}, async (message, match, manji) => {
    const isSudo = message.fromMe 
        || manji.envList('SUDO').includes(message.sender) 
        || message.isSudo;
    if (!isSudo) return await message.send(lang.plugins.joinGroup.sudoOnly);
    const link = match || message.quoted?.text;
    if (!link) return await message.send(lang.plugins.joinGroup.noLink);
    const code = link.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/)?.[1];
    if (!code) return await message.send(lang.plugins.joinGroup.invalidLink);
    try {
        const info = await manji.gInfo(code);
        await manji.joinGroup(code);
        await message.send(info.joinApprovalMode 
            ? lang.plugins.joinGroup.requestSent 
            : lang.plugins.joinGroup.success);
    } catch {
        await message.send(lang.plugins.joinGroup.failed);
    }
});

//have to use lang here
Command({
    pattern: 'ginfo ?(.*)',
    desc: 'Shows group information via link or JID',
    type: 'owner',
}, async (message, match, manji) => {
    const isSudo = message.fromMe 
        || manji.envList('SUDO').includes(message.sender) 
        || message.isSudo;
    if (!isSudo) return await message.send('_Sudo only command_');
    const input = match || message.quoted?.text;
    if (!input) return await message.send('_Provide a link or JID_');
    try {
        let info = null;
        if (input.endsWith('@g.us')) {
            try { info = await manji.gdata(input); } 
            catch { return await message.send('_Not in group_'); }
        } else {
            const code = input.includes('chat.whatsapp.com/') 
                ? input.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/)?.[1] 
                : input;
            if (!code || !/^[a-zA-Z0-9]+$/.test(code)) return await message.send('_Invalid link_');
            info = await manji.gInfo(code);
        }
        if (!info) return await message.send('_Failed to fetch info_');
        const participants = info.participants || [];
        const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
        const superAdmins = participants.filter(p => p.admin === 'superadmin');
        const date = new Date((info.creation || info.creationTime) * 1000);
        const settings = [
            `Messages: ${info.announce ? 'Admins' : 'Everyone'}`,
            `Edit Info: ${info.restrict ? 'Admins' : 'Everyone'}`,
            `Join: ${info.joinApprovalMode ? 'Approval' : 'Anyone'}`,
            `Add Members: ${info.memberAddMode ? 'Admins' : 'Everyone'}`
        ];
        const text = `*Group Info*\n\n` +
            `*Name:* ${info.subject || 'Unknown'}\n` +
            `*JID:* ${info.id || 'Unknown'}\n` +
            `*Members:* ${info.size || participants.length}\n` +
            `*Created:* ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}\n` +
            `*Admins:* ${admins.length}\n` +
            `*SuperAdmins:* ${superAdmins.length ? superAdmins.map(a => manji.jidToNum(a.id)).join(', ') : 'None'}\n` +
            `*Community:* ${info.isCommunity ? 'Yes' : 'No'}\n\n` +
            `*Settings:*\n• ${settings.join('\n• ')}\n\n` +
            `*Description:*\n${info.desc || info.description || 'No description'}`;
        await message.send(text);
    } catch (e) {
        await message.send(`_Error: ${e.message}_`);
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
    if (!message.isGroup) return await message.send(lang.plugins.gpp.groupOnly);
    if (!await manji.isBotAdmin(message.chat)) return await message.send(lang.plugins.gpp.notAdmin);
    const isSudo = message.fromMe 
        || manji.envList('SUDO').includes(message.sender) 
        || message.isSudo;
    const isAdmin = await message.admin();
    if (!isSudo && !(config.ADMIN_VALUE && isAdmin)) return await message.send(lang.plugins.gpp.notAllowed);
    const arg = (match || '').trim().toLowerCase();
    if (arg === 'remove') {
        await manji.ppUpdate({ jid: message.chat, action: 'remove' });
        return await message.send(lang.plugins.gpp.removed);
    }
    const image = message.image 
        || message.quoted?.image;
    if (!image) return await message.send(lang.plugins.gpp.noMedia);
    const media = await downLoad(message.raw, 'buffer');
    if (!media) return await message.send(lang.plugins.gpp.downloadFail);
    await manji.ppUpdate({ jid: message.chat, action: 'add', media });
    await message.send(lang.plugins.gpp.updated);
});


Command({
    pattern: 'gsubject ?(.*)',
    desc: lang.plugins.gsubject.desc,
    type: 'group'
}, async (message, match, manji) => {
    if (!message.isGroup) return await message.send(lang.plugins.gsubject.groupOnly);
    if (!await manji.isBotAdmin(message.chat)) return await message.send(lang.plugins.gsubject.notAdmin);
    const isSudo = message.fromMe 
        || manji.envList('SUDO').includes(message.sender) 
        || message.isSudo;
    const isAdmin = await message.admin();
    if (!isSudo && !(config.ADMIN_VALUE && isAdmin)) return await message.send(lang.plugins.gsubject.notAllowed);
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
    const isSudo = message.fromMe 
        || manji.envList('SUDO').includes(message.sender) 
        || message.isSudo;
    const isAdmin = await message.admin();
    if (!isSudo && !(config.ADMIN_VALUE && isAdmin)) return await message.send(lang.plugins.gdesc.notAllowed);
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
    const isSudo = message.fromMe 
        || manji.envList('SUDO').includes(message.sender) 
        || message.isSudo;
    if (!isSudo) return await message.send(lang.plugins.delete.notAllowed);
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
    if (!message.isGroup) return await message.send(lang.plugins.tagall.groupOnly);
    const isSudo = message.fromMe 
        || manji.envList('SUDO').includes(message.sender) 
        || message.isSudo;
    const isAdmin = await message.admin();
    if (!isSudo && !(config.ADMIN_VALUE && isAdmin)) return await message.send(lang.plugins.tagall.notAllowed);
    const data = await manji.gdata(message.chat);
    if (!data.participants.length) return;
    const mentions = [];
    const body = data.participants.map((p, i) => {
        mentions.push(p.id);
        return lang.plugins.tagall.format.format(i + 1, p.id.split('@')[0]);
    }).join('\n');
    const text = lang.plugins.tagall.header 
        ? `${lang.plugins.tagall.header}\n${body}` 
        : body;
    await message.send({ text, mentions });
});


Command({
    pattern: 'admins',
    desc: lang.plugins.admins.desc,
    type: 'group',
    group: true
}, async (message, _, manji) => {
    if (!message.isGroup) return await message.send(lang.plugins.admins.groupOnly);
    const data = await manji.gdata(message.chat);
    const admins = data.participants.filter(p => p.admin === 'admin' 
        || p.admin === 'superadmin');
    if (!admins.length) return await message.send(lang.plugins.admins.empty);
    const mentions = [];
    const body = admins.map((p, i) => {
        mentions.push(p.id);
        return lang.plugins.admins.format.format(i + 1, p.id.split('@')[0]);
    }).join('\n');
    const text = lang.plugins.admins.header 
        ? `${lang.plugins.admins.header}\n${body}` 
        : body;
    await message.send({ text, mentions });
});


Command({
    pattern: 'nonadmins',
    desc: lang.plugins.nonadmins.desc,
    type: 'group',
    group: true
}, async (message, _, manji) => {
    if (!message.isGroup) return await message.send(lang.plugins.nonadmins.groupOnly);
    const isSudo = message.fromMe 
        || manji.envList('SUDO').includes(message.sender) 
        || message.isSudo;
    const isAdmin = await message.admin();
    if (!isSudo && !(config.ADMIN_VALUE && isAdmin)) return await message.send(lang.plugins.nonadmins.notAllowed);
    const data = await manji.gdata(message.chat);
    const nonadmins = data.participants.filter(p => !p.admin);
    if (!nonadmins.length) return await message.send(lang.plugins.nonadmins.empty);
    const mentions = [];
    const body = nonadmins.map((p, i) => {
        mentions.push(p.id);
        return lang.plugins.nonadmins.format.format(i + 1, p.id.split('@')[0]);
    }).join('\n');
    const text = lang.plugins.nonadmins.header 
        ? `${lang.plugins.nonadmins.header}\n${body}` 
        : body;
    await message.send({ text, mentions });
});


Command({
    pattern: 'tag ?(.*)',
    desc: lang.plugins.tag.desc,
    type: 'group',
    group: true
}, async (message, match, manji) => {
    if (!message.isGroup) return await message.send(lang.plugins.tag.groupOnly);
    const isSudo = message.fromMe 
        || manji.envList('SUDO').includes(message.sender) 
        || message.isSudo;
    const isAdmin = await message.admin();
    if (!isSudo && !(config.ADMIN_VALUE && isAdmin)) return await message.send(lang.plugins.tag.notAllowed);
    const data = await manji.gdata(message.chat);
    const mentions = data.participants.map(p => p.id);
    if (message.quoted) return await message.send({ forward: message.quoted, mentions });
    const text = (match || '').trim();
    await message.send({ text: text || '', mentions });
});