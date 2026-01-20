import { Command, lang, Anti } from '../lib/index.js';

const type = 'sm';

Anti.register(type, {
    detect: (msg) => {
        const m = msg.raw?.message?.groupStatusMentionMessage?.message?.protocolMessage;
        return m?.type === 'STATUS_MENTION_MESSAGE' || m?.type === 25;
    },
    onAction: async (msg, res) => {
        const { status, count, limit } = res;
        if (['no_permission', 'error'].includes(status)) return;

        const u = msg.sender.split('@')[0];
        const opt = { mentions: [msg.sender] };

        if (status === 'warned') 
            return await msg.send(lang.plugins.antism.warning.format(u, count, limit), opt);
        
        if (status.startsWith('kicked')) 
            return await msg.send(lang.plugins.antism.kicked.format(u), opt);
    }
});


Command({
    pattern: 'antism ?(.*)',
    desc: lang.plugins.antism.desc,
    type: 'group',
    group: true
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) 
        return await message.send(lang.plugins.antism.botNotAdmin);

    if (!message.fromMe && !await message.admin()) 
        return await message.send(lang.plugins.antism.notAllowed);

    const cmd = match.trim().toLowerCase();
    const prefix = message.prefix;

    if (cmd === 'on') {
        Anti.updateSettings(message.chat, type, 'enabled', 1);
        return await message.send(lang.plugins.antism.enabled);
    }

    if (cmd === 'off') {
        Anti.updateSettings(message.chat, type, 'enabled', 0);
        return await message.send(lang.plugins.antism.disabled);
    }

    if (['kick', 'warn', 'delete'].includes(cmd)) {
        Anti.updateSettings(message.chat, type, 'action', cmd);
        return await message.send(lang.plugins.antism.action.format(cmd.toUpperCase()));
    }

    if (cmd === 'info') {
        const { enabled, action } = Anti.getData(message.chat, type);
        return await message.send(lang.plugins.antism.info.format(enabled ? 'ON' : 'OFF', action.toLowerCase()));
    }

    return await message.send(lang.plugins.antism.usage.format(prefix));
});