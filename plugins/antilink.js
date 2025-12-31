import { Command, lang, config, Anti } from '../lib/index.js';

const type = 'link';

Anti.register(type, {
    detect: (msg, cfg) => {
        const links = msg.text.match(/(?:https?:\/\/)?(?:www\.)?[\w-]+\.[a-z]{2,}/gi) || [];
        const normalize = l => l.toLowerCase().replace(/https?:\/\/|www\./g, '').replace(/\/$/, '');
        return links.some(l => !cfg.allow.map(normalize).includes(normalize(l)));
    },
    onAction: async (msg, res) => {
        const { status, count, limit } = res;
        if (['no_permission', 'error'].includes(status)) return;

        const user = msg.sender.split('@')[0];
        const mentions = { mentions: [msg.sender] };

        if (status === 'warned') 
            return await msg.send(lang.plugins.antilink.warning.format(user, count, limit), mentions);
        
        if (['kicked', 'kicked_warn'].includes(status)) 
            return await msg.send(lang.plugins.antilink.kickedLink.format(user), mentions);
    }
});

Command({
    pattern: 'antilink ?(.*)',
    desc: lang.plugins.antilink.desc,
    type: 'group',
    group: true
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) 
        return await message.send(lang.plugins.antilink.botNotAdmin);

    if (!message.fromMe && !await message.admin()) 
        return await message.send(lang.plugins.antilink.notAllowed);

    const [cmd, ...args] = (match || '').trim().split(/\s+/);
    if (!cmd) return await message.send(lang.plugins.antilink.usage.format(config.PREFIX));

    const command = cmd.toLowerCase();

    if (command === 'on') {
        Anti.updateSettings(message.chat, type, 'enabled', 1);
        return await message.send(lang.plugins.antilink.enabled);
    }

    if (command === 'off') {
        Anti.updateSettings(message.chat, type, 'enabled', 0);
        return await message.send(lang.plugins.antilink.disabled);
    }

    if (['kick', 'warn', 'delete'].includes(command)) {
        Anti.updateSettings(message.chat, type, 'action', command);
        return await message.send(lang.plugins.antilink.action.format(command));
    }

    if (['allow', 'deny'].includes(command)) {
        const links = args.join('').split(',').filter(Boolean);
        if (!links.length) 
            return await message.send(lang.plugins.antilink.linkUsage.format(config.PREFIX, command));
        
        Anti.manageFilters(message.chat, type, command, links, 'set');
        return await message.send(lang.plugins.antilink.links.format(command, links.join(', ')));
    }

    if (command === 'info') {
        const info = Anti.getData(message.chat, type);
        return await message.send(lang.plugins.antilink.info.format(
            info.enabled ? 'ON' : 'OFF',
            info.action,
            info.allow.join(', ') || 'none',
            info.deny.join(', ') || 'none'
        ));
    }

    if (command === 'clear') {
        Anti.updateSettings(message.chat, type, 'enabled', 0);
        Anti.updateSettings(message.chat, type, 'action', 'delete');
        Anti.manageFilters(message.chat, type, 'allow', [], 'set');
        Anti.manageFilters(message.chat, type, 'deny', [], 'set');
        return await message.send(lang.plugins.antilink.cleared);
    }

    await message.send(lang.plugins.antilink.invalid);
});