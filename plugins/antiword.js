import { Command, lang, config, Anti } from '../lib/index.js';

const type = 'word';

Anti.register(type, {
    detect: (message, cfg) => {
        const text    = message.text?.toLowerCase() ?? '';
        const allowed = cfg.allow.map(w => w.toLowerCase().trim());
        const denied  = cfg.deny.map(w => w.toLowerCase().trim());

        return denied.some(bad =>
            new RegExp(`\\b${bad}\\b`, 'i').test(text)
            && !allowed.some(good => text.includes(good))
        );
    },
    onAction: async (message, res) => {
        const { status, count, limit } = res;
        if (['no_permission', 'error'].includes(status)) return;

        const user = message.sender.split('@')[0];
        const opt  = { mentions: [message.sender] };

        if (status === 'warned')
            return message.send(lang.plugins.antiword.warning.format(user, count, limit), opt);

        if (['kicked', 'kicked_warn'].includes(status))
            return message.send(lang.plugins.antiword.kickedWord.format(user), opt);
    }
});


Command({
    pattern: 'antiword ?(.*)',
    desc: lang.plugins.antiword.desc,
    type: 'group',
    group: true
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat))
        return message.send(lang.plugins.antiword.botNotAdmin);

    if (!message.fromMe && !await message.admin())
        return message.send(lang.plugins.antiword.notAllowed);

    const [cmd, ...args] = (match ?? '').trim().split(/\s+/);
    if (!cmd) return message.send(lang.plugins.antiword.usage.format(config.PREFIX));

    const c = cmd.toLowerCase();

    if (c === 'on') {
        Anti.updateSettings(message.chat, type, 'enabled', 1);
        return message.send(lang.plugins.antiword.enabled);
    }

    if (c === 'off') {
        Anti.updateSettings(message.chat, type, 'enabled', 0);
        return message.send(lang.plugins.antiword.disabled);
    }

    if (['kick', 'warn', 'delete'].includes(c)) {
        Anti.updateSettings(message.chat, type, 'action', c);
        return message.send(lang.plugins.antiword.action.format(c));
    }

    if (['allow', 'deny'].includes(c)) {
        const words = args
            .join(' ')
            .split(',')
            .map(w => w.trim().toLowerCase())
            .filter(Boolean);

        if (!words.length) return message.send(lang.plugins.antiword.wordUsage.format(config.PREFIX, c));

        Anti.manageFilters(message.chat, type, c, words, 'set');
        return message.send(lang.plugins.antiword.words.format(c, words.join(', ')));
    }

    if (c === 'info') {
        const i = Anti.getData(message.chat, type);
        return message.send(lang.plugins.antiword.info.format(
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
        return message.send(lang.plugins.antiword.cleared);
    }

    return message.send(lang.plugins.antiword.invalid);
});
