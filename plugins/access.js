import { Command, config, lang, settings } from '../lib/index.js';

const p        = () => config.PREFIX || '.';
const chatOf   = (m) => m.isGroup ? m.chat : (m.chatlid || m.chat);
const quotedOf = (m) => m.quoted?.lid || m.quoted?.sender;
const tag      = (ids) => ids.map(s => `@${s.split('@')[0]}`).join(', ');

const parseFlags = (arg) => ({
    isGlobal: /\B-g\b/.test(arg),
    isHere:   /\B-h\b/.test(arg),
    clean:    arg.replace(/\B-[gh]\b/g, '').trim(),
});

const extractCmds = (str) =>
    str
        .replace(/@\d+/g, '')
        .trim()
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter((v, i, a) => v && a.indexOf(v) === i);

const formatList = (rows, emptyMsg) => {
    if (!rows.length) return { text: emptyMsg, mentions: [], groupMentions: [] };

    const grouped       = {};
    const mentions      = [];
    const groupMentions = [];

    for (const { sender, jid, type, command } of rows) {
        const key = `${sender}||${jid}`;
        grouped[key] ??= { sender, jid, cmds: [] };
        grouped[key].cmds.push(`  ${type === 'allow' ? '+' : '-'} \`${command}\``);

        const isUser  = !sender.endsWith('@g.us') && !sender.endsWith('@lid');
        const isGroup = jid !== 'global' && jid.endsWith('@g.us');

        if (isUser && !mentions.includes(sender)) mentions.push(sender);
        if (isGroup && !groupMentions.some(g => g.groupJid === jid))
            groupMentions.push({ groupJid: jid, groupSubject: jid });
    }

    const text = Object.values(grouped).map(({ sender, jid, cmds }) => {
        const who   = sender.endsWith('@g.us') ? `Chat ${sender.split('@')[0]}` : `@${sender.split('@')[0]}`;
        const scope = jid === 'global' ? 'global' : jid.endsWith('@g.us') ? `@${jid}` : jid;
        return `${who} — ${scope}\n${cmds.join('\n')}`;
    }).join('\n\n');

    return { text, mentions, groupMentions };
};

const sendList = (message, rows, emptyMsg) => {
    const { text, mentions, groupMentions } = formatList(rows, emptyMsg);
    return message.send({ text, mentions, contextInfo: { groupMentions } });
};


Command({
    pattern: 'allow ?(.*)',
    desc:    lang.plugins.allow.desc,
    type:    'owner',
    sudo:    true,
}, async (message, match, manji) => {
    const L    = lang.plugins.allow;
    const A    = lang.plugins.access;
    const arg  = match?.trim();
    const chat = chatOf(message);

    if (!arg)           return message.send(L.hint.format(p(), 'allow'));
    if (arg === 'help') return message.send(L.usage.format(p()));

    if (arg === 'list')
        return sendList(message, settings.listByType('allow'), L.empty);

    if (arg === 'list here')
        return sendList(message, settings.listByJid(chat).filter(r => r.type === 'allow'), L.empty);

    if (arg === 'clear here') {
        settings.db.prepare(`DELETE FROM pubaccess WHERE type='allow' AND jid=?`).run(chat);
        return message.send(L.cleared_here);
    }

    if (arg === 'clear' || arg.startsWith('clear ')) {
        const rest    = arg.slice('clear'.length).trim();
        const targets = await manji.getUserLid(message, rest);
        if (!targets.length && quotedOf(message)) targets.push(quotedOf(message));

        if (!targets.length) {
            settings.db.prepare(`DELETE FROM pubaccess WHERE type='allow'`).run();
            return message.send(L.cleared);
        }

        for (const sender of targets) settings.revokeAll(sender);
        return message.send({ text: L.cleared_user.format(tag(targets)), mentions: targets });
    }

    const { isGlobal, isHere, clean } = parseFlags(arg);
    const jid   = isGlobal ? 'global' : chat;
    const scope = isGlobal ? A.scope_global : A.scope_here;
    const cmds  = extractCmds(clean);
    const list  = cmds.length ? cmds : ['*'];

    if (isHere) {
        for (const cmd of list) settings.allow(chat, jid, cmd);
        return message.send(L.success.format(A.target_chat, list.join(', '), scope));
    }

    const targets = await manji.getUserLid(message, clean);
    if (!targets.length && quotedOf(message)) targets.push(quotedOf(message));
    if (!targets.length) return message.send(L.noTarget.format(p()));

    for (const sender of targets)
        for (const cmd of list)
            settings.allow(sender, jid, cmd);

    return message.send({ text: L.success.format(tag(targets), list.join(', '), scope), mentions: targets });
});


Command({
    pattern: 'deny ?(.*)',
    desc:    lang.plugins.deny.desc,
    type:    'owner',
    sudo:    true,
}, async (message, match, manji) => {
    const L    = lang.plugins.deny;
    const A    = lang.plugins.access;
    const arg  = match?.trim();
    const chat = chatOf(message);

    if (!arg)           return message.send(L.hint.format(p(), 'deny'));
    if (arg === 'help') return message.send(L.usage.format(p()));

    if (arg === 'list')
        return sendList(message, settings.listByType('deny'), L.empty);

    if (arg === 'list here')
        return sendList(message, settings.listByJid(chat).filter(r => r.type === 'deny'), L.empty);

    if (arg === 'clear here') {
        settings.db.prepare(`DELETE FROM pubaccess WHERE type='deny' AND jid=?`).run(chat);
        return message.send(L.cleared_here);
    }

    if (arg === 'clear' || arg.startsWith('clear ')) {
        const rest    = arg.slice('clear'.length).trim();
        const targets = await manji.getUserLid(message, rest);
        if (!targets.length && quotedOf(message)) targets.push(quotedOf(message));

        if (!targets.length) {
            settings.db.prepare(`DELETE FROM pubaccess WHERE type='deny'`).run();
            return message.send(L.cleared);
        }

        for (const sender of targets) settings.revokeAll(sender);
        return message.send({ text: L.cleared_user.format(tag(targets)), mentions: targets });
    }

    const { isGlobal, isHere, clean } = parseFlags(arg);
    const jid   = isGlobal ? 'global' : chat;
    const scope = isGlobal ? A.scope_global : A.scope_here;
    const cmds  = extractCmds(clean);
    const list  = cmds.length ? cmds : ['*'];

    if (isHere) {
        for (const cmd of list) settings.deny(chat, jid, cmd);
        return message.send(L.success.format(A.target_chat, list.join(', '), scope));
    }

    const targets = await manji.getUserLid(message, clean);
    if (!targets.length && quotedOf(message)) targets.push(quotedOf(message));
    if (!targets.length) return message.send(L.noTarget.format(p()));

    for (const sender of targets)
        for (const cmd of list)
            settings.deny(sender, jid, cmd);

    return message.send({ text: L.success.format(tag(targets), list.join(', '), scope), mentions: targets });
});