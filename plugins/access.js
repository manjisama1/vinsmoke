import { Command, config, lang, settings } from '../lib/index.js';

const p = () => config.PREFIX || '.';

const parseArg = (arg) => {
    const isGlobal = arg.includes('-g');
    const isHere   = arg.includes('-h');
    const rest     = arg.replace(/-g|-h/g, '').trim();
    return { isGlobal, isHere, rest };
};

const extractCmds = (str) =>
    str.replace(/@\d+/g, '').trim()
        .split(',').map(s => s.trim()).filter(Boolean);

const formatList = (rows, emptyMsg) => {
    if (!rows.length) return { text: emptyMsg, mentions: [], groupMentions: [] };

    const grouped = {};
    const mentions = [];
    const groupMentions = [];

    for (const r of rows) {
        grouped[r.sender] ??= { cmds: [], jids: new Set() };
        grouped[r.sender].cmds.push(`  ${r.type === 'allow' ? '✓' : '✗'} \`${r.command}\``);
        grouped[r.sender].jids.add(r.jid === 'global' ? 'global' : r.jid);

        if (!mentions.includes(r.sender) && !r.sender.endsWith('@g.us'))
            mentions.push(r.sender);

        if (r.jid !== 'global' && r.jid.endsWith('@g.us') && !groupMentions.find(g => g.groupJid === r.jid))
            groupMentions.push({ groupJid: r.jid, groupSubject: r.jid });
    }

    const lines = Object.entries(grouped).map(([sender, { cmds, jids }]) => {
        const tag = `@${sender.split('@')[0]}`;
        const scope = [...jids].map(j => j.endsWith('@g.us') ? `@${j}` : j).join(', ');
        return `${tag} — ${scope}\n${cmds.join('\n')}`;
    });

    return { text: lines.join('\n\n'), mentions, groupMentions };
};

Command({
    pattern: 'allow ?(.*)',
    desc: lang.plugins.allow.desc,
    type: 'owner',
    sudo: true,
}, async (message, match, manji) => {
    const arg = match?.trim();
    if (!arg || arg === 'help') return message.send(lang.plugins.allow.usage.format(p()));

    if (arg === 'list') {
        const rows = settings.db.prepare(`SELECT sender,jid,command,type FROM pubaccess WHERE type='allow' ORDER BY sender,jid`).all();
        const { text, mentions, groupMentions } = formatList(rows, lang.plugins.allow.empty);
        return message.send({ text, mentions, contextInfo: { groupMentions } });
    }

    if (arg === 'clear') {
        settings.db.prepare(`DELETE FROM pubaccess WHERE type='allow'`).run();
        return message.send(lang.plugins.allow.cleared);
    }

    const { isGlobal, isHere, rest } = parseArg(arg);
    const chatJid = message.isGroup ? message.chat : (message.chatlid || message.chat);
    const jid     = isGlobal ? 'global' : chatJid;
    const targets = isHere ? [chatJid] : await manji.getUserLid(message, rest);

    if (!targets.length) return message.send(lang.plugins.allow.noTarget.format(p()));

    const list = isHere ? ['*'] : extractCmds(rest);
    if (!list.length) return message.send(lang.plugins.allow.noCmd);

    for (const sender of targets)
        for (const cmd of list)
            settings.allow(sender, jid, cmd);

    const scope = isGlobal ? 'globally' : isHere ? 'for this chat' : 'in this chat';
    const label = isHere ? chatJid : targets.map(s => `@${s.split('@')[0]}`).join(', ');

    await message.send({
        text: lang.plugins.allow.success.format(label, list.join(', '), scope),
        mentions: isHere ? [] : targets,
    });
});

Command({
    pattern: 'deny ?(.*)',
    desc: lang.plugins.deny.desc,
    type: 'owner',
    sudo: true,
}, async (message, match, manji) => {
    const arg = match?.trim();
    if (!arg || arg === 'help') return message.send(lang.plugins.deny.usage.format(p()));

    if (arg === 'list') {
        const rows = settings.db.prepare(`SELECT sender,jid,command,type FROM pubaccess WHERE type='deny' ORDER BY sender,jid`).all();
        const { text, mentions, groupMentions } = formatList(rows, lang.plugins.deny.empty);
        return message.send({ text, mentions, contextInfo: { groupMentions } });
    }

    if (arg === 'clear') {
        settings.db.prepare(`DELETE FROM pubaccess WHERE type='deny'`).run();
        return message.send(lang.plugins.deny.cleared);
    }

    const { isGlobal, isHere, rest } = parseArg(arg);
    const chatJid = message.isGroup ? message.chat : (message.chatlid || message.chat);
    const jid     = isGlobal ? 'global' : chatJid;
    const targets = isHere ? [chatJid] : await manji.getUserLid(message, rest);

    if (!targets.length) return message.send(lang.plugins.deny.noTarget.format(p()));

    const list = isHere ? ['*'] : extractCmds(rest);
    if (!list.length) return message.send(lang.plugins.deny.noCmd);

    for (const sender of targets)
        for (const cmd of list)
            settings.deny(sender, jid, cmd);

    const scope = isGlobal ? 'globally' : isHere ? 'for this chat' : 'in this chat';
    const label = isHere ? chatJid : targets.map(s => `@${s.split('@')[0]}`).join(', ');

    await message.send({
        text: lang.plugins.deny.success.format(label, list.join(', '), scope),
        mentions: isHere ? [] : targets,
    });
});
