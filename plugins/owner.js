import { Command, downLoad, lang, config, settings, cleanupTemp, getCurrentHash, getLatestHash, hasUpdates, getCommits, updateToCommit } from '../lib/index.js';

const p = () => config.PREFIX || '.';

const AD_NS = 'autodelete';
const AD_KEY = 'config';

const AD_HELP = `*Auto Delete Help*

*Destination (where to forward):*
-h = here (same chat as deleted message)
-o = own (bot's DM)
<jid> = specific chat JID

*Filter (which messages):*
-gm = groups only
-pm = private/DM only
-g = all (default)

*Source filter (only from these chats):*
Provide JIDs after filter flag, comma-separated

*Examples:*
${p()}autodelete -h
${p()}autodelete -o
${p()}autodelete -h -pm
${p()}autodelete -h -gm
${p()}autodelete -o -pm
${p()}autodelete 120363@g.us
${p()}autodelete -o 120363@g.us
${p()}autodelete -h -o -gm
${p()}autodelete -h -gm 120363@g.us,994403@s.whatsapp.net
${p()}autodelete 120363@g.us -pm 994403@s.whatsapp.net
${p()}autodelete on / off

*Flags:* -h=here  -o=own  -gm=groups  -pm=private  -g=all`;

const isValidJid = (j) =>
    j.endsWith('@g.us') || j.endsWith('@s.whatsapp.net') || j.endsWith('@lid');

const parseAD = (arg) => {
    const parts = arg.trim().split(/\s+/);
    const targets = [];
    let filter = 'all';
    const sources = [];

    for (const part of parts) {
        if (part === '-h')  { targets.push('here'); continue; }
        if (part === '-o')  { targets.push('own');  continue; }
        if (part === '-gm') { filter = 'groups';    continue; }
        if (part === '-pm') { filter = 'pm';        continue; }
        if (part === '-g')  { filter = 'all';       continue; }
        part.split(',').map(s => s.trim()).filter(isValidJid).forEach(j => sources.push(j));
    }

    if (!targets.length) targets.push('own');
    return { targets, filter, sources };
};

Command({
    pattern: 'var ?(.*)',
    desc: lang.plugins.var.desc,
    type: 'owner',
    sudo: true,
}, async (msg, match, manji) => {
    const prefix = config.PREFIX || '.';
    const args = match?.trim()?.split(' ') || [];
    const action = args[0]?.toLowerCase();
    if (!action) return await msg.send(lang.plugins.var.usage.format(prefix));

    const input = args.slice(1).join(' ');
    const isMutation = ['set', 'add', 'edit'].includes(action);

    if (isMutation) {
        let key, val;
        if (msg.quoted) {
            key = input.trim().toUpperCase();
            val = msg.quoted.text;
        } else {
            if (!input.includes('=')) return await msg.send(lang.plugins.var[action].usage.format(prefix));
            const parts = input.split('=');
            key = parts[0].trim().toUpperCase();
            val = parts.slice(1).join('=').trim();
        }

        if (!key) return await msg.send(lang.plugins.var.set.failed.emptyKey);

        const current = manji.envAll();
        if (action === 'edit' && !current[key]) return await msg.send(lang.plugins.var.edit.notFound.format(key));

        const success = action === 'add' ? manji.envAdd(key, val) : manji.envSet(key, val);
        return await msg.send(success ? lang.plugins.var[action].success.format(key, val) : lang.plugins.var.set.failed.generic);
    }

    switch (action) {
        case 'all':
            const all = manji.envAll();
            return await msg.send(manji.envDisplay(all, { maskSensitive: !msg.isSudo }) || lang.plugins.var.all.empty);

        case 'del':
            const delKey = args[1]?.toUpperCase();
            if (!delKey) return await msg.send(lang.plugins.var.del.usage.format(prefix));
            return await msg.send(manji.envDelete(delKey) ? lang.plugins.var.del.success.format(delKey) : lang.plugins.var.set.failed.generic);

        case 'see':
            const seeKey = args[1]?.toUpperCase();
            if (!seeKey) return await msg.send(lang.plugins.var.see.usage.format(prefix));
            const vars = manji.envAll();
            return await msg.send(vars[seeKey] ? lang.plugins.var.see.value.format(seeKey, vars[seeKey]) : lang.plugins.var.see.notFound.format(seeKey));

        case 'help':
            return await msg.send(lang.plugins.var.help.format(prefix));

        default:
            return await msg.send(lang.plugins.var.unknown.format(action));
    }
});


Command({
    pattern: 'setsudo ?(.*)',
    desc: lang.plugins.setsudo.desc,
    type: 'owner',
    owner: true
}, async (message, _, manji) => {
    const targets = [
        ...message.mention,
        message.quoted?.lid,
        !message.isGroup ? message.key.remoteJid : null
    ].filter(Boolean);

    if (!targets.length) return await message.send(lang.plugins.setsudo.provide);

    const current = manji.envList('SUDO');
    const added = [];
    const exists = [];

    [...new Set(targets)].forEach(t => {
        const id = t.split(/[:@]/)[0];
        current.includes(id)
        ? exists.push(id)
        : manji.envAdd('SUDO', id) && added.push(id);
    });

    const response = [
        added.length && lang.plugins.setsudo.added.format(added.map(v => `@${v}`).join(', ')),
        exists.length && lang.plugins.setsudo.exists.format(exists.map(v => `@${v}`).join(', '))
    ]
        .filter(Boolean)
        .join('\n');

    await message.send(response, {
        mentions: targets
    });
});


Command({
    pattern: 'delsudo ?(.*)',
    desc: lang.plugins.delsudo.desc,
    type: 'owner',
    owner: true
}, async (message, _, manji) => {
    const targets = [
        ...message.mention,
        message.quoted?.lid,
        !message.isGroup ? message.key.remoteJid : null
    ].filter(Boolean);

    if (!targets.length) return await message.send(lang.plugins.delsudo.provide);

    const removed = [];
    const notFound = [];

    [...new Set(targets)].forEach(t => {
        const id = t.split(/[:@]/)[0];
        manji.envRemove('SUDO', id)
        ? removed.push(id)
        : notFound.push(id);
    });

    const response = [
        removed.length && lang.plugins.delsudo.removed.format(removed.map(v => `@${v}`).join(', ')),
        notFound.length && lang.plugins.delsudo.not_found.format(notFound.map(v => `@${v}`).join(', '))
    ]
        .filter(Boolean)
        .join('\n');

    await message.send(response, {
        mentions: targets
    });
});


Command({
    pattern: 'username ?(.*)',
    desc: lang.plugins.username.desc,
    type: 'owner',
    sudo: true
}, async (message, match, manji) => {
    const name = match?.trim();
    if (!name) return message.send(lang.plugins.username.noName);
    await manji.userName(name);
    await message.send(lang.plugins.username.updated.format(name));
});


Command({
    pattern: 'userbio ?(.*)',
    desc: lang.plugins.userbio.desc,
    type: 'owner',
    sudo: true
}, async (message, match, manji) => {
    const bio = match?.trim();
    if (!bio) return message.send(lang.plugins.userbio.noBio);
    await manji.userBio(bio);
    await message.send(lang.plugins.userbio.updated.format(bio));
});


Command({
    pattern: 'pp ?(.*)',
    desc: lang.plugins.pp.desc,
    type: 'owner',
    sudo: true
}, async (message, match, manji) => {
    const jid = message.botJid;
    const arg = (match || '').trim().toLowerCase();

    if (arg === 'remove') {
        await manji.ppUpdate({ jid, action: 'remove' });
        return message.send(lang.plugins.pp.removed);
    }

    const image = message.image || message.quoted?.image;
    if (!image) return message.send(lang.plugins.pp.noMedia);

    const media = await downLoad(message.raw, 'buffer');
    if (!media) return message.send(lang.plugins.pp.downloadFail);

    await manji.ppUpdate({ jid, action: 'add', media });
    await message.send(lang.plugins.pp.updated);
});


Command({
    pattern: 'reboot',
    desc: lang.plugins.desc,
    type: 'owner',
    sudo: true
}, async (message, _, manji) => {
    await manji.wait(2000);
    await cleanupTemp();
    await message.react('');
    await message.send(lang.plugins.reboot.reboot,);
    const { exec } = await import('child_process');
    exec("npm restart", (error) => {
        if (error) {
            process.exit(0);
        }
    });
});


Command({
    pattern: 'update ?(.*)',
    desc: lang.plugins.update.desc,
    type: 'owner',
    sudo: true
}, async (message, match) => {
    try {
        const current = await getCurrentHash();

        if (!match) {
            const hasUpdate = await hasUpdates();
            if (!hasUpdate) return await message.send(lang.plugins.update.upToDate.format(current));

            const latest = await getLatestHash();
            return await message.send(lang.plugins.update.available.format(current, latest));
        }

        if (match.startsWith('list')) {
            const count = parseInt(match.split(' ')[1]) || 15;
            const commits = await getCommits(count);
            const list = commits.map(c => `> ${c.date} - \`${c.hash}\` : ${c.message}`).join('\n');
            return await message.send(lang.plugins.update.commits.format(list));
        }

        const target = match === 'now' ? 'origin/main' : match;
        await message.send(lang.plugins.update.updatingTo.format(target));

        await updateToCommit(target);

        await message.send(lang.plugins.update.updated);
        process.exit(0);
    } catch (error) {
        await message.send(lang.plugins.update.failed.format(error.message));
    }
});


Command({
    pattern: 'autodelete ?(.*)',
    desc: 'Configure auto-delete forwarding',
    type: 'owner',
    sudo: true,
}, async (message, match) => {
    const arg = match?.trim() || '';

    if (!arg) {
        const cfg = settings.get(AD_NS, AD_KEY, { enabled: false });
        const circle = cfg.enabled ? '🟢' : '🔴';
        const targets = (cfg.targets ?? ['own'])
            .map(t => t === 'own' ? 'own (bot DM)' : t === 'here' ? `here (${message.chat})` : t)
            .join(', ');
        const filter = cfg.filter ?? 'all';
        const sources = cfg.sources?.length ? cfg.sources.join(', ') : 'all chats';
        return message.send(
            `${circle} Auto Delete: ${cfg.enabled ? 'ON' : 'OFF'}\n`
            + `Forward to: ${targets}\n`
            + `Filter: ${filter}\n`
            + `Sources: ${sources}`
        );
    }

    if (arg === 'help') return message.send(AD_HELP);
    if (arg === 'on')  {
        const cur = settings.get(AD_NS, AD_KEY, {});
        settings.set(AD_NS, AD_KEY, { targets: ['own'], filter: 'all', sources: [], ...cur, enabled: true });
        return message.send('🟢 Auto delete enabled.');
    }
    if (arg === 'off') {
        const cur = settings.get(AD_NS, AD_KEY, {});
        settings.set(AD_NS, AD_KEY, { ...cur, enabled: false });
        return message.send('🔴 Auto delete disabled.');
    }

    const VALID_FLAGS = new Set(['-h', '-o', '-gm', '-pm', '-g']);
    const parts = arg.trim().split(/\s+/);
    const invalid = parts.filter(p => p.startsWith('-') && !VALID_FLAGS.has(p));
    if (invalid.length) return message.send(`Invalid flag(s): ${invalid.join(', ')}\nUse \`autodelete help\` to see options.`);

    const { targets, filter, sources } = parseAD(arg);
    const cur = settings.get(AD_NS, AD_KEY, {});
    settings.set(AD_NS, AD_KEY, { ...cur, enabled: cur.enabled ?? true, targets, filter, sources });

    const targetLabels = targets.map(t =>
        t === 'own' ? 'own (bot DM)'
        : t === 'here' ? `here (${message.chat})`
        : t
    ).join(', ');
    const srcLabel = sources.length ? sources.join(', ') : 'all chats';
    message.send(
        `✅ Auto delete updated\n`
        + `Forward to: ${targetLabels}\n`
        + `Filter: ${filter}\n`
        + `Sources: ${srcLabel}`
    );
});
