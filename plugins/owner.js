import { Command, downLoad, lang, config, cleanupTemp, getCurrentHash, getLatestHash, hasUpdates, getCommits, updateToCommit } from '../lib/index.js';


Command({
    pattern: 'var ?(.*)',
    desc: lang.plugins.var.desc,
    type: 'owner',
    sudo: true,
}, async (message, match, manji) => {
    const prefix = config.PREFIX || '.';
    const args = match?.trim()?.split(' ') || [];
    const action = args[0]?.toLowerCase();

    switch (action) {
        case undefined: {
            return await message.send(lang.plugins.var.usage.format(prefix));
        }

        case 'set': {
            const input = args.slice(1).join(' ');
            if (!input || !input.includes('=')) {
                return await message.send(lang.plugins.var.set.usage.format(prefix));
            }

            const [rawKey, ...valParts] = input.split('=');
            const key = rawKey.trim();
            const value = valParts.join('=').trim();

            if (!key) return await message.send(lang.plugins.var.set.failed.emptyKey);

            const success = manji.envSet(key, value);
            if (success) {
                return await message.send(lang.plugins.var.set.success.format(key.toUpperCase(), value));
            }
            return await message.send(lang.plugins.var.set.failed.generic);
        }

        case 'all': {
            const allVars = manji.envAll();
            const display = manji.envDisplay(allVars, { maskSensitive: !message.isSudo });
            return await message.send(display || lang.plugins.var.all.empty);
        }

        case 'del': {
            const key = args[1]?.toUpperCase();
            if (!key) return await message.send(lang.plugins.var.del.usage.format(prefix));

            const success = manji.envDelete(key);
            if (success) {
                return await message.send(lang.plugins.var.del.success.format(key));
            }
            return await message.send(lang.plugins.var.set.failed.generic);

        }

        case 'add': {
            const input = args.slice(1).join(' ');
            if (!input || !input.includes('=')) {
                return await message.send(lang.plugins.var.add.usage.format(prefix));
            }

            const [rawKey, ...valParts] = input.split('=');
            const key = rawKey.trim();
            const value = valParts.join('=').trim();

            if (!key) return await message.send(lang.plugins.var.set.failed.emptyKey);

            const success = manji.envAdd(key, value);
            if (success) {
                return await message.send(lang.plugins.var.add.success.format(key.toUpperCase()));
            }
            return await message.send(lang.plugins.var.set.failed.generic);
        }

        case 'edit': {
            const input = args.slice(1).join(' ');
            if (!input || !input.includes('=')) {
                return await message.send(lang.plugins.var.edit.usage.format(prefix));
            }

            const [rawKey, ...valParts] = input.split('=');
            const key = rawKey.trim().toUpperCase();
            const value = valParts.join('=').trim();

            if (!key) return await message.send(lang.plugins.var.set.failed.emptyKey);

            const allVars = manji.envAll();
            if (!allVars[key]) {
                return await message.send(lang.plugins.var.edit.notFound.format(key));
            }

            const success = manji.envSet(key, value);
            if (success) {
                return await message.send(lang.plugins.var.edit.success.format(key, value));
            }
            return await message.send(lang.plugins.var.set.failed.generic);
        }

        case 'see': {
            const key = args[1]?.toUpperCase();
            if (!key) return await message.send(lang.plugins.var.see.usage.format(prefix));

            const allVars = manji.envAll();
            if (!allVars[key]) {
                return await message.send(lang.plugins.var.see.notFound.format(key));
            }

            return await message.send(lang.plugins.var.see.value.format(key, allVars[key]));
        }

        case 'help': {
            return await message.send(lang.plugins.var.help.format(prefix));
        }

        default: {
            return await message.send(lang.plugins.var.unknown.format(action));
        }
    }
});


Command({
    pattern: 'setsudo ?(.*)',
    desc: lang.plugins.setsudo.desc,
    type: 'owner',
    sudo: true,
}, async (message, match, manji) => {
    const jid = (message.key.remoteJid);
    if (jid.endsWith("@g.us")) return message.send(lang.plugins.setsudo.pmOnly);
    const jids = [
        message.key.remoteJid,
        message.key.remoteJidAlt
    ].filter(Boolean);

    if (!jids.length) return message.send(lang.plugins.setsudo.noUser);

    const currentSudo = manji.envList('SUDO');
    const addedUsers = [];
    const alreadyExists = [];

    for (let jid of jids) {
        const phone = jid.split(/[:@]/)[0];

        if (currentSudo.includes(phone)) {
            alreadyExists.push(phone);
        } else {
            const success = manji.envAdd('SUDO', phone);
            if (success) addedUsers.push(phone);
        }
    }

    if (addedUsers.length) await message.send(lang.plugins.setsudo.added.format(addedUsers.join(', ')));
    if (alreadyExists.length) await message.send(lang.plugins.setsudo.exists.format(alreadyExists.join(', ')));
});


Command({
    pattern: 'delsudo ?(.*)',
    desc: 'Remove sudo users',
    type: 'owner',
    sudo: true,
}, async (message, match, manji) => {
    const jid = message.key.remoteJid;
    if (jid.endsWith("@g.us")) return message.send(lang.plugins.delsudo.pmOnly);

    const jids = [
        message.key.remoteJid,
        message.key.remoteJidAlt
    ].filter(Boolean);

    if (!jids.length) return message.send(lang.plugins.delsudo.noUser);

    const removed = [];
    const notFound = [];

    for (let jid of jids) {
        const phone = jid.split(/[:@]/)[0];
        const success = manji.envRemove('SUDO', phone);

        if (success) removed.push(phone);
        else notFound.push(phone);
    }

    if (removed.length)
        await message.send(lang.plugins.delsudo.removed.format(removed.join(', ')));
    if (notFound.length)
        await message.send(lang.plugins.delsudo.notFound.format(notFound.join(', ')));
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