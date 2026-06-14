import { Command, lang, Anti } from '../lib/index.js';

const type = 'sm';

Anti.register(type, {
    detect: (message) => {
        const m = message.raw?.message?.groupStatusMentionMessage?.message?.protocolMessage;
        return m?.type === 'STATUS_MENTION_MESSAGE' || m?.type === 25;
    },
    onAction: async (message, res) => {
        const { status, count, limit } = res;
        if (['no_permission', 'error'].includes(status)) return;

        const user = message.sender.split('@')[0];
        const opt  = { mentions: [message.sender] };

        if (status === 'warned')
            return message.send(lang.plugins.antism.warning.format(user, count, limit), opt);

        if (status.startsWith('kicked'))
            return message.send(lang.plugins.antism.kicked.format(user), opt);
    }
});


Command({
    pattern: 'antism ?(.*)',
    desc: lang.plugins.antism.desc,
    type: 'group',
    group: true
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat))
        return message.send(lang.plugins.antism.botNotAdmin);

    if (!message.fromMe && !await message.admin())
        return message.send(lang.plugins.antism.notAllowed);

    const cmd = match.trim().toLowerCase();

    if (cmd === 'on') {
        Anti.updateSettings(message.chat, type, 'enabled', 1);
        return message.send(lang.plugins.antism.enabled);
    }

    if (cmd === 'off') {
        Anti.updateSettings(message.chat, type, 'enabled', 0);
        return message.send(lang.plugins.antism.disabled);
    }

    if (['kick', 'warn', 'delete'].includes(cmd)) {
        Anti.updateSettings(message.chat, type, 'action', cmd);
        return message.send(lang.plugins.antism.action.format(cmd.toUpperCase()));
    }

    if (cmd === 'info') {
        const { enabled, action } = Anti.getData(message.chat, type);
        return message.send(lang.plugins.antism.info.format(enabled ? 'ON' : 'OFF', action.toLowerCase()));
    }

    return message.send(lang.plugins.antism.usage.format(message.prefix));
});
