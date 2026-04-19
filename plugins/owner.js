import { Command, downLoad, lang, config, settings, cleanupTemp, getCurrentHash, getLatestHash, hasUpdates, getCommits, updateToCommit } from '../lib/index.js';

const p = () => config.PREFIX || '.';

const isJid = (s) => s.endsWith('@g.us') || s.endsWith('@s.whatsapp.net') || s.endsWith('@lid');

const parseAD = (arg, mentionLid = null) => {
    const parts = arg.trim().split(/\s+/);
    const to = [], from = [], jidGroups = [];
    let type = 'all', sfMode = null, sfLid = null;

    for (const part of parts) {
        if (part === '-h')  { to.push('here');   continue; }
        if (part === '-o')  { to.push('own');    continue; }
        if (part === '-gm') { type = 'groups';   continue; }
        if (part === '-pm') { type = 'pm';       continue; }
        if (part === '-g')  { type = 'all';      continue; }
        if (part === '-f')  { sfMode = 'only';   sfLid = mentionLid; continue; }
        if (part === '-fi') { sfMode = 'ignore'; sfLid = mentionLid; continue; }
        const jids = part.split(',').map(s => s.trim()).filter(isJid);
        if (jids.length) jidGroups.push(jids);
    }

    if (jidGroups.length === 1) to.push(...jidGroups[0]);
    else if (jidGroups.length >= 2) { to.push(...jidGroups[0]); from.push(...jidGroups[1]); }
    if (!to.length) to.push('own');

    return { to, from, type, sf: sfMode && sfLid ? { mode: sfMode, lid: sfLid } : null };
};

const adView = (cfg) => {
    const toLabel   = (cfg.to ?? ['own']).map(t => t === 'own' ? 'own' : t === 'here' ? 'here' : t).join(', ');
    const fromLabel = cfg.from?.length ? cfg.from.join(', ') : 'global';
    const sfLabel   = cfg.sf ? `${cfg.sf.mode} ${cfg.sf.lid}` : 'none';
    return lang.plugins.autodelete.view.format(
        cfg.on ? 'yes' : 'no', toLabel, cfg.type ?? 'all', fromLabel, sfLabel, cfg.status ? 'on' : 'off'
    );
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
    pattern: 'mode ?(.*)',
    desc: lang.plugins.mode.desc,
    type: 'general',
    sudo: true,
}, async (message, match, manji) => {
    if (!match) return await message.send(lang.plugins.mode.current.format(config.BOT_MODE || 'private'));
    const mode = match.toLowerCase();
    if (mode !== 'public' && mode !== 'private') return await message.send(lang.plugins.mode.example.format(config.PREFIX));
    await manji.envSet('BOT_MODE', mode);
    await message.send(lang.plugins.mode.status.format(mode));
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
    desc: lang.plugins.autodelete.desc,
    type: 'owner',
    sudo: true,
}, async (message, match, manji) => {
    const arg = match?.trim() || '';
    const get = () => settings.get('autodelete', 'config', {});
    const save = (v) => settings.set('autodelete', 'config', v);

    if (!arg || arg === 'status') return message.send(adView(get()));
    if (arg === 'help') return message.send(lang.plugins.autodelete.help.format(p()));

    if (arg === 'on')         { save({ to: ['own'], from: [], type: 'all', sf: null, ...get(), on: true });  return message.send(lang.plugins.autodelete.on); }
    if (arg === 'off')        { save({ ...get(), on: false });     return message.send(lang.plugins.autodelete.off); }
    if (arg === 'status on')  { save({ ...get(), status: true });  return message.send(lang.plugins.autodelete.statusOn); }
    if (arg === 'status off') { save({ ...get(), status: false }); return message.send(lang.plugins.autodelete.statusOff); }

    const VALID = new Set(['-h', '-o', '-gm', '-pm', '-g', '-f', '-fi']);
    const invalid = arg.split(/\s+/).filter(s => s.startsWith('-') && !VALID.has(s));
    if (invalid.length) return message.send(lang.plugins.autodelete.invalidFlags.format(invalid.join(', '), p()));

    const mentionLid = (await manji.getUserLid(message, arg))[0] ?? null;
    const { to, from, type, sf } = parseAD(arg, mentionLid);
    save({ ...get(), on: get().on ?? true, to, from, type, sf });

    const toLabel   = to.map(t => t === 'own' ? 'own' : t === 'here' ? 'here' : t).join(', ');
    const fromLabel = from.length ? from.join(', ') : 'global';
    const reply = sf
        ? lang.plugins.autodelete.updatedSender.format(toLabel, type, fromLabel, `${sf.mode} ${sf.lid}`)
        : lang.plugins.autodelete.updated.format(toLabel, type, fromLabel);
    message.send(reply);
});
