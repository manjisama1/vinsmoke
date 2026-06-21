import { Command, config, lang, settings } from '../lib/index.js';

const p = () => config.PREFIX || '.';

const parseArg = (arg) => {
    const isGlobal = arg.includes('-g');
    const isHere   = arg.includes('-h');
    const clean    = arg.replace(/-g|-h/g, '').trim();
    return { isGlobal, isHere, clean };
};

const extractCmds = (str) =>
    str
        .replace(/@\d+/g, '')
        .trim()
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter((v, i, a) => v && a.indexOf(v) === i);

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

const applyAccess = async (message, match, manji, type) => {
    const L = lang.plugins[type];
    const arg = match?.trim();
    if (!arg || arg === 'help') return message.send(L.usage.format(p()));

    if (arg === 'list') {
        const rows = settings.db
            .prepare(`SELECT sender,jid,command,type FROM pubaccess WHERE type=? ORDER BY sender,jid`)
            .all(type);
        const { text, mentions, groupMentions } = formatList(rows, L.empty);
        return message.send({ text, mentions, contextInfo: { groupMentions } });
    }

    if (arg === 'clear') {
        settings.db.prepare(`DELETE FROM pubaccess WHERE type=?`).run(type);
        return message.send(L.cleared);
    }

    const { isGlobal, isHere, clean } = parseArg(arg);
    const chatJid = message.isGroup ? message.chat : (message.chatlid || message.chat);
    const jid     = isGlobal ? 'global' : chatJid;

    if (isHere) {
        const rawList = extractCmds(clean);
        const list = rawList.length ? rawList : ['*'];

        for (const cmd of list)
            type === 'allow'
                ? settings.allow(chatJid, jid, cmd)
                : settings.deny(chatJid, jid, cmd);

        const label   = isGlobal ? 'globally' : 'for this chat';
        const display = list.join(', ');
        return message.send(L.success.format(chatJid, display, label));
    }

    const targets = await manji.getUserLid(message, clean);
    if (!targets.length) return message.send(L.noTarget.format(p()));

    const rawList  = extractCmds(clean);
    const list     = rawList.length ? rawList : ['*'];

    for (const sender of targets)
        for (const cmd of list)
            type === 'allow'
                ? settings.allow(sender, jid, cmd)
                : settings.deny(sender, jid, cmd);

    const scope   = isGlobal ? 'globally' : 'in this chat';
    const label   = targets.map(s => `@${s.split('@')[0]}`).join(', ');
    const display = list.join(', ');

    await message.send({
        text: L.success.format(label, display, scope),
        mentions: targets,
    });
};


Command({
    pattern: 'allow ?(.*)',
    desc: lang.plugins.allow.desc,
    type: 'owner',
    sudo: true,
}, (message, match, manji) => applyAccess(message, match, manji, 'allow'));


Command({
    pattern: 'deny ?(.*)',
    desc: lang.plugins.deny.desc,
    type: 'owner',
    sudo: true,
}, (message, match, manji) => applyAccess(message, match, manji, 'deny'));
