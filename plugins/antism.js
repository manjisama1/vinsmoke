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

        const user = msg.sender.split('@')[0];
        const mentions = { mentions: [msg.sender] };

        if (status === 'warned') 
            return await msg.send(`@${user} Hidden mentions not allowed! [${count}/${limit}]`, mentions);
        
        if (status.startsWith('kicked')) 
            return await msg.send(`@${user} Kicked for hidden mentions.`, mentions);
    }
});

Command({
    pattern: 'antism ?(.*)',
    desc: 'Toggle anti-status mention',
    type: 'group',
    group: true
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) 
        return await message.send(lang.plugins.antilink.botNotAdmin);

    if (!message.fromMe && !await message.admin()) 
        return await message.send(lang.plugins.antilink.notAllowed);

    const cmd = match.trim().toLowerCase();
    if (!cmd) return await message.send('Usage: antism on/off/kick/warn/delete');

    if (cmd === 'on') {
        Anti.updateSettings(message.chat, type, 'enabled', 1);
        return await message.send('AntiSM: ON');
    }

    if (cmd === 'off') {
        Anti.updateSettings(message.chat, type, 'enabled', 0);
        return await message.send('AntiSM: OFF');
    }

    if (['kick', 'warn', 'delete'].includes(cmd)) {
        Anti.updateSettings(message.chat, type, 'action', cmd);
        return await message.send(`AntiSM Action: ${cmd.toUpperCase()}`);
    }

    if (cmd === 'info') {
        const { enabled, action } = Anti.getData(message.chat, type);
        return await message.send(`AntiSM: ${enabled ? 'ON' : 'OFF'}\nAction: ${action.toUpperCase()}`);
    }

    await message.send('Invalid command');
});