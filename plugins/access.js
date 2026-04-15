import { Command, config, lang, settings } from '../lib/index.js';

const L = lang.plugins;
const p = () => config.PREFIX || '.';

const parseArg = (arg) => {
    const isGlobal = arg.startsWith('-g');
    const rest = isGlobal ? arg.slice(2).trim() : arg;
    return { isGlobal, rest };
};

const extractCmds = (str) =>
    str.replace(/@[\d]+/g, '').trim()
        .split(',').map(s => s.trim()).filter(Boolean);

const formatList = (rows) => {
    if (!rows.length) return L.allow.empty;
    const grouped = {};
    for (const r of rows) {
        if (!grouped[r.sender]) grouped[r.sender] = [];
        grouped[r.sender].push(`  ${r.type === 'allow' ? '✓' : '✗'} \`${r.command}\` — ${r.jid === 'global' ? 'global' : r.jid}`);
    }
    return Object.entries(grouped)
        .map(([s, lines]) => `@${s.split('@')[0]}\n${lines.join('\n')}`)
        .join('\n\n');
};

Command({
    pattern: 'allow ?(.*)',
    desc: L.allow.desc,
    type: 'owner',
    sudo: true,
}, async (message, match, manji) => {
    const arg = match?.trim();
    if (!arg || arg === 'help') return message.send(L.allow.help.format(p()));

    if (arg === 'list') {
        const rows = settings.db.prepare(`SELECT sender,jid,command,type FROM pubaccess WHERE type='allow' ORDER BY sender,jid`).all();
        return message.send(formatList(rows));
    }

    if (arg === 'clear') {
        settings.db.prepare(`DELETE FROM pubaccess WHERE type='allow'`).run();
        return message.send(L.allow.cleared);
    }

    const { isGlobal, rest } = parseArg(arg);
    const jid = isGlobal ? 'global' : (message.isGroup ? message.chat : (message.chatlid || message.chat));
    const targets = await manji.getUserLid(message, rest);
    if (!targets.length) return message.send(L.allow.noUser);

    const list = extractCmds(rest);
    if (!list.length) return message.send(L.allow.noCmd);

    for (const sender of targets)
        for (const cmd of list)
            settings.allow(sender, jid, cmd);

    await message.send({
        text: L.allow.success.format(
            targets.map(s => `@${s.split('@')[0]}`).join(', '),
            list.join(', '),
            isGlobal ? 'globally' : 'in this chat'
        ),
        mentions: targets,
    });
});

Command({
    pattern: 'deny ?(.*)',
    desc: L.deny.desc,
    type: 'owner',
    sudo: true,
}, async (message, match, manji) => {
    const arg = match?.trim();
    if (!arg || arg === 'help') return message.send(L.allow.help.format(p()));

    if (arg === 'list') {
        const rows = settings.db.prepare(`SELECT sender,jid,command,type FROM pubaccess WHERE type='deny' ORDER BY sender,jid`).all();
        return message.send(formatList(rows));
    }

    if (arg === 'clear') {
        settings.db.prepare(`DELETE FROM pubaccess WHERE type='deny'`).run();
        return message.send(L.deny.cleared);
    }

    const { isGlobal, rest } = parseArg(arg);
    const jid = isGlobal ? 'global' : (message.isGroup ? message.chat : (message.chatlid || message.chat));
    const targets = await manji.getUserLid(message, rest);
    if (!targets.length) return message.send(L.deny.noUser);

    const list = extractCmds(rest);
    if (!list.length) return message.send(L.deny.noCmd);

    for (const sender of targets)
        for (const cmd of list)
            settings.deny(sender, jid, cmd);

    await message.send({
        text: L.deny.success.format(
            targets.map(s => `@${s.split('@')[0]}`).join(', '),
            list.join(', '),
            isGlobal ? 'globally' : 'in this chat'
        ),
        mentions: targets,
    });
});
