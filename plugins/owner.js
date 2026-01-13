import { Command, downLoad, lang, config, cleanupTemp, getCurrentHash, getLatestHash, hasUpdates, getCommits, updateToCommit } from '../lib/index.js';


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
    desc: 'Add sudo users',
    type: 'owner',
    owner: true
}, async (msg, match, manji) => {
    const targets = [
        ...msg.mention,
        msg.quoted?.lid,
        !msg.isGroup ? msg.key.remoteJid : null,
        !msg.isGroup ? msg.key.remoteJidAlt : null
    ].filter(Boolean);

    if (!targets.length) return await msg.send('_Provide a user via mention, quote, or PM_');

    const current = manji.envList('SUDO');
    const added = [];
    const exists = [];

    [...new Set(targets)].forEach(t => {
        const phone = t.split(/[:@]/)[0];
        current.includes(phone) ? exists.push(phone) : manji.envAdd('SUDO', phone) && added.push(phone);
    });

    if (added.length) await msg.send(`_Added: ${added.join(', ')}_`);
    if (exists.length) await msg.send(`_Already sudo: ${exists.join(', ')}_`);
});


Command({
    pattern: 'delsudo ?(.*)',
    desc: 'Remove sudo users',
    type: 'owner',
    owner: true
}, async (msg, match, manji) => {
    const targets = [
        ...msg.mention,
        msg.quoted?.lid,
        !msg.isGroup ? msg.key.remoteJid : null,
        !msg.isGroup ? msg.key.remoteJidAlt : null
    ].filter(Boolean);

    if (!targets.length) return await msg.send('_Provide a user via mention, quote, or PM_');

    const removed = [];
    const notFound = [];

    [...new Set(targets)].forEach(t => {
        const phone = t.split(/[:@]/)[0];
        manji.envRemove('SUDO', phone) ? removed.push(phone) : notFound.push(phone);
    });

    if (removed.length) await msg.send(`_Removed: ${removed.join(', ')}_`);
    if (notFound.length) await msg.send(`_Not found: ${notFound.join(', ')}_`);
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