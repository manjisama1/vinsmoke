import { Command, lang, config, Anti } from '../lib/index.js';

const type = 'link';

Anti.register(type, {
    detect: (msg, cfg) => {
        const links = msg.text.match(/(?:https?:\/\/)?(?:www\.)?[\w-]+\.[a-z]{2,}/gi) || [];
        const normalize = (l) => l.toLowerCase().replace(/https?:\/\/|www\./g, '').replace(/\/$/, '');
        return links.some(l => !cfg.allow.map(normalize).includes(normalize(l)));
    },
    onAction: async (msg, res) => {
        const user = msg.sender.split('@')[0];
        const { status, count, limit } = res;
        
        if (status === 'warned') {
            await msg.send(lang.plugins.antilink.warning.format(user, count, limit), { mentions: [msg.sender] });
        } else if (status === 'kicked' || status === 'kicked_warn') {
            await msg.send(lang.plugins.antilink.kickedLink.format(user), { mentions: [msg.sender] });
        }
    }
});

Command({
    pattern: 'antilink ?(.*)',
    desc: lang.plugins.antilink.desc,
    type: 'group',
    group: true
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) {
        return await message.send(lang.plugins.antilink.botNotAdmin);
    }
    
    if (!message.fromMe && !await message.admin()) {
        return await message.send(lang.plugins.antilink.notAllowed);
    }

    const [cmd, ...args] = (match || '').trim().split(/\s+/);
    if (!cmd) {
        return await message.send(lang.plugins.antilink.usage.format(config.PREFIX));
    }

    switch (cmd.toLowerCase()) {
        case 'on':
        case 'off':
            Anti.updateSettings(message.chat, type, 'enabled', cmd === 'on' ? 1 : 0);
            await message.send(
                cmd === 'on' 
                    ? lang.plugins.antilink.enabled 
                    : lang.plugins.antilink.disabled
            );
            break;

        case 'kick':
        case 'warn':
        case 'delete':
            Anti.updateSettings(message.chat, type, 'action', cmd);
            await message.send(lang.plugins.antilink.action.format(cmd));
            break;

        case 'allow':
        case 'deny':
            const links = args.join('').split(',').filter(Boolean);
            if (!links.length) {
                return await message.send(lang.plugins.antilink.linkUsage.format(config.PREFIX, cmd));
            }
            
            Anti.manageFilters(message.chat, type, cmd, links, 'set');
            await message.send(lang.plugins.antilink.links.format(cmd, links.join(', ')));
            break;

        case 'info':
            const info = Anti.getData(message.chat, type);
            const infoText = lang.plugins.antilink.info.format(
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
            await message.send(lang.plugins.antilink.cleared);
            break;

        default:
            await message.send(lang.plugins.antilink.invalid);
            break;
    }
});