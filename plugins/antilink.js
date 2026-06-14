import { Command, lang, config, Anti } from '../lib/index.js';

const type = 'link';

const norm = l =>
    l.toLowerCase()
     .replace(/https?:\/\/|www\./g, '')
     .replace(/\/$/, '');

Anti.register(type, {
    detect: (message, cfg) => {
        const links = message.text?.match(/(?:https?:\/\/)?(?:www\.)?[\w-]+\.[a-z]{2,}/gi) ?? [];
        const allowed = cfg.allow.map(norm);
        return links.some(l => !allowed.includes(norm(l)));
    },
    onAction: async (message, res) => {
        const { status, count, limit } = res;
        if (['no_permission', 'error'].includes(status)) return;

        const user = message.sender.split('@')[0];
        const opt  = { mentions: [message.sender] };

        if (status === 'warned')
            return message.send(lang.plugins.antilink.warning.format(user, count, limit), opt);

        if (['kicked', 'kicked_warn'].includes(status))
            return message.send(lang.plugins.antilink.kickedLink.format(user), opt);
    }
});


Command({
    pattern: 'antilink ?(.*)',
    desc: lang.plugins.antilink.desc,
    type: 'group',
    group: true
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat))
        return message.send(lang.plugins.antilink.botNotAdmin);

    if (!message.fromMe && !await message.admin())
        return message.send(lang.plugins.antilink.notAllowed);

    const [cmd, ...args] = (match ?? '').trim().split(/\s+/);
    if (!cmd) return message.send(lang.plugins.antilink.usage.format(config.PREFIX));

    const c = cmd.toLowerCase();

    if (c === 'on') {
        Anti.updateSettings(message.chat, type, 'enabled', 1);
        return message.send(lang.plugins.antilink.enabled);
    }

    if (c === 'off') {
        Anti.updateSettings(message.chat, type, 'enabled', 0);
        return message.send(lang.plugins.antilink.disabled);
    }

    if (['kick', 'warn', 'delete'].includes(c)) {
        Anti.updateSettings(message.chat, type, 'action', c);
        return message.send(lang.plugins.antilink.action.format(c));
    }

    if (['allow', 'deny'].includes(c)) {
        const links = args.join('').split(',').filter(Boolean);
        if (!links.length) return message.send(lang.plugins.antilink.linkUsage.format(config.PREFIX, c));

        Anti.manageFilters(message.chat, type, c, links, 'set');
        return message.send(lang.plugins.antilink.links.format(c, links.join(', ')));
    }

    if (c === 'info') {
        const i = Anti.getData(message.chat, type);
        return message.send(lang.plugins.antilink.info.format(
            i.enabled ? 'ON' : 'OFF',
            i.action,
            i.allow.join(', ') || 'none',
            i.deny.join(', ') || 'none'
        ));
    }

    if (c === 'clear') {
        Anti.updateSettings(message.chat, type, 'enabled', 0);
        Anti.updateSettings(message.chat, type, 'action', 'delete');
        Anti.manageFilters(message.chat, type, 'allow', [], 'set');
        Anti.manageFilters(message.chat, type, 'deny', [], 'set');
        return message.send(lang.plugins.antilink.cleared);
    }

    return message.send(lang.plugins.antilink.invalid);
});
