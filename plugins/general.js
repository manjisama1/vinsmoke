import { Command, lang } from '../lib/index.js';


Command({
    pattern: 'menu ?(.*)',
    desc: 'Display command menu',
    type: 'general',
}, async (message, match) => {
    const query = match?.trim();

    const layout = {
        header: `╭───────────────\n│     *{botName}*\n╰───────────────\n`,
        botInfo: {
            title: `┌─⊷ *BOT INFO*`,
            border: `│ • `,
            footer: `└───────────────`,
            fields: [
                { key: 'user', label: 'User' },
                { key: 'totalCommands', label: 'Commands', suffix: ' cmds' },
                { key: 'totalCategories', label: 'Categories', suffix: ' cats' },
                { key: 'version', label: 'Version', suffix: 'v' },
                { key: 'prefix', label: 'Prefix' },
                { key: 'developer', label: 'Developer' },
            ],
        },
        categories: {
            header: `┌─⊷ *{category} COMMANDS* [{count}]`,
            commandLine: `│ • {prefix}{name}{alias}{externalTag}`,
            footer: `└───────────────`,
        },
        readmore: true,
        symbols: {
            aliasSeparator: ' | ',
            externalTag: ' 🔌',
        },
    };

    const res = await message.menu(layout, query);
    return res || message.send(`No categories matching "${query}"`);
});

Command({
    pattern: 'ping',
    aliases: ['p'],
    desc: lang.plugins.ping.desc,
    type: 'general',
}, async (message) => {
    const start = Date.now();
    await message.send(lang.plugins.ping.pingMessage);
    const end = Date.now();
    const response = lang.plugins.ping.pongMessage.format(end - start);
    await message.send(response);
});


Command({
    pattern: 'system',
    desc: lang.plugins.status.desc,
    type: 'general',
    sudo: true
}, async (message, _, manji) => {
    const text = manji.runtime(
        message.client.pluginManager,
        manji.config, message);
    await message.send(text);
});

Command({
    pattern: 'repo ?(.*)',
    desc: 'Get bot repository link',
    type: 'general'
}, async (message) => {
    await message.send(`https://github.com/manjisama1/vinsmoke`);
});