import { Command, lang, config } from '../lib/index.js';


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
    pattern: 'menu ?(.*)',
    desc: 'Display command menu',
    type: 'general',
}, async (message, match, manji) => {
    const query = match?.trim();
    const text = manji.menu(
        message.client.pluginManager,
        manji.config, message, query);
    return !text 
        ? await message.reply(
            `No categories matching "${query}"`
        ) 
        : await message.send(text);
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
    pattern: 'mode ?(.*)',
    desc: lang.plugins.mode.desc,
    type: 'general',
    sudo: true,
}, async (message, match, manji) => {
    if (!match) return await message.send(lang.plugins.mode.current.format(config.BOT_MODE || 'private'));
    const mode = match.toLowerCase();
    if (mode !== 'public' && mode !== 'private') return await message.send(lang.plugins.mode.example.format(config.PREFIX));
    await manji.envSet('BOT_MODE', mode);
    await message.send(lang.plugins.mode.status.format(mode));
});