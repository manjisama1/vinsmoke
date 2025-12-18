import { Command, lang, config, Anti } from '../lib/index.js';

const type = 'word';

Anti.register(type, {
    detect: (msg, cfg) => {
        const text = msg.text.toLowerCase();
        const normalize = (w) => w.toLowerCase().trim();
        const allowed = cfg.allow.map(normalize);
        const denied = cfg.deny.map(normalize);

        return denied.some(badWord => {
            const regex = new RegExp(`\\b${badWord}\\b`, 'i');
            return regex.test(text) && !allowed.some(goodWord => text.includes(goodWord));
        });
    },
    onAction: async (msg, res) => {
        const user = msg.sender.split('@')[0];
        const { status, count, limit } = res;
        
        if (status === 'warned') {
            await msg.send(lang.plugins.antiword.warning.format(user, count, limit), { mentions: [msg.sender] });
        } else if (status === 'kicked' || status === 'kicked_warn') {
            await msg.send(lang.plugins.antiword.kickedWord.format(user), { mentions: [msg.sender] });
        }
    }
});

Command({
    pattern: 'antiword ?(.*)',
    desc: lang.plugins.antiword.desc,
    type: 'group',
    group: true
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) {
        return await message.send(lang.plugins.antiword.botNotAdmin);
    }

    if (!message.fromMe && !await message.admin()) {
        return await message.send(lang.plugins.antiword.notAllowed);
    }

    const [cmd, ...args] = (match || '').trim().split(/\s+/);
    if (!cmd) {
        return await message.send(lang.plugins.antiword.usage.format(config.PREFIX));
    }

    switch (cmd.toLowerCase()) {
        case 'on':
        case 'off':
            Anti.updateSettings(message.chat, type, 'enabled', cmd === 'on' ? 1 : 0);
            await message.send(
                cmd === 'on' 
                    ? lang.plugins.antiword.enabled 
                    : lang.plugins.antiword.disabled
            );
            break;

        case 'kick':
        case 'warn':
        case 'delete':
            Anti.updateSettings(message.chat, type, 'action', cmd);
            await message.send(lang.plugins.antiword.action.format(cmd));
            break;

        case 'allow':
        case 'deny':
            const words = args.join(' ').split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
            if (!words.length) {
                return await message.send(lang.plugins.antiword.wordUsage.format(config.PREFIX, cmd));
            }
            
            Anti.manageFilters(message.chat, type, cmd, words, 'set');
            await message.send(lang.plugins.antiword.words.format(cmd, words.join(', ')));
            break;

        case 'info':
            const info = Anti.getData(message.chat, type);
            const infoText = lang.plugins.antiword.info.format(
                info.enabled ? 'ON' : 'OFF',
                info.action,
                info.allow.join(', ') || 'none',
                info.deny.join(', ') || 'none'
            );
            await message.send(infoText);
            break;

        case 'clear':
            Anti.updateSettings(message.chat, type, 'enabled', 0);
            Anti.updateSettings(message.chat, type, 'action', 'delete');
            Anti.manageFilters(message.chat, type, 'allow', [], 'set');
            Anti.manageFilters(message.chat, type, 'deny', [], 'set');
            await message.send(lang.plugins.antiword.cleared);
            break;

        default:
            await message.send(lang.plugins.antiword.invalid);
            break;
    }
});