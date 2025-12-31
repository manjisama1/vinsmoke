import { Command, lang, config, Anti } from '../lib/index.js';

const type = 'word';

Anti.register(type, {
    detect: (msg, cfg) => {
        const text = msg.text.toLowerCase();
        const normalize = w => w.toLowerCase().trim();
        const allowed = cfg.allow.map(normalize);
        const denied = cfg.deny.map(normalize);

        return denied.some(bad => {
            const regex = new RegExp(`\\b${bad}\\b`, 'i');
            return regex.test(text) && !allowed.some(good => text.includes(good));
        });
    },
    onAction: async (msg, res) => {
        const { status, count, limit } = res;
        if (['no_permission', 'error'].includes(status)) return;

        const user = msg.sender.split('@')[0];
        const mentions = { mentions: [msg.sender] };

        if (status === 'warned') 
            return await msg.send(lang.plugins.antiword.warning.format(user, count, limit), mentions);
        
        if (['kicked', 'kicked_warn'].includes(status)) 
            return await msg.send(lang.plugins.antiword.kickedWord.format(user), mentions);
    }
});

Command({
    pattern: 'antiword ?(.*)',
    desc: lang.plugins.antiword.desc,
    type: 'group',
    group: true
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) 
        return await message.send(lang.plugins.antiword.botNotAdmin);

    if (!message.fromMe && !await message.admin()) 
        return await message.send(lang.plugins.antiword.notAllowed);

    const [cmd, ...args] = (match || '').trim().split(/\s+/);
    if (!cmd) return await message.send(lang.plugins.antiword.usage.format(config.PREFIX));

    const command = cmd.toLowerCase();

    if (command === 'on') {
        Anti.updateSettings(message.chat, type, 'enabled', 1);
        return await message.send(lang.plugins.antiword.enabled);
    }

    if (command === 'off') {
        Anti.updateSettings(message.chat, type, 'enabled', 0);
        return await message.send(lang.plugins.antiword.disabled);
    }

    if (['kick', 'warn', 'delete'].includes(command)) {
        Anti.updateSettings(message.chat, type, 'action', command);
        return await message.send(lang.plugins.antiword.action.format(command));
    }

    if (['allow', 'deny'].includes(command)) {
        const words = args.join(' ').split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
        if (!words.length) 
            return await message.send(lang.plugins.antiword.wordUsage.format(config.PREFIX, command));
        
        Anti.manageFilters(message.chat, type, command, words, 'set');
        return await message.send(lang.plugins.antiword.words.format(command, words.join(', ')));
    }

    if (command === 'info') {
        const i = Anti.getData(message.chat, type);
        return await message.send(lang.plugins.antiword.info.format(
            i.enabled ? 'ON' : 'OFF', i.action,
            i.allow.join(', ') || 'none', i.deny.join(', ') || 'none'
        ));
    }

    if (command === 'clear') {
        Anti.updateSettings(message.chat, type, 'enabled', 0);
        Anti.updateSettings(message.chat, type, 'action', 'delete');
        Anti.manageFilters(message.chat, type, 'allow', [], 'set');
        Anti.manageFilters(message.chat, type, 'deny', [], 'set');
        return await message.send(lang.plugins.antiword.cleared);
    }

    await message.send(lang.plugins.antiword.invalid);
});