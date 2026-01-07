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
    pattern: 'status',
    desc: lang.plugins.status.desc,
    type: 'general',
    sudo: true
}, async (message, match, manji) => {
    const up = process.uptime();
    const uptime = `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m ${Math.floor(up % 60)}s`;
    
    const osMap = { win32: 'Windows', darwin: 'macOS', linux: 'Linux', android: 'Android' };
    const platform = `${osMap[process.platform] || process.platform} (${process.arch})`;
    
    const mem = process.memoryUsage();
    const [rss, used, total, ext] = [mem.rss, mem.heapUsed, mem.heapTotal, mem.external].map(b => (b / 1e6).toFixed(2));

    const statusText = [
        '╭───────────────',
        '│     *𝐒𝐘𝐒𝐓𝐄𝐌 𝐒𝐓𝐀𝐓𝐔𝐒*',
        '╰───────────────\n',
        '┌─⊷ *BOT:*',
        `│ • *Uptime:* ${uptime}`,
        `│ • *Mode:* ${manji.config.BOT_MODE || 'private'}`,
        `│ • *Prefix:* ${manji.config.PREFIX || '.'}`,
        `│ • *Sudo:* ${manji.envList('SUDO').length} Users`,
        '└───────────────\n',
        '┌─⊷ *RESOURCES*',
        `│ • *RSS:* ${rss} MB`,
        `│ • *Heap:* ${used}/${total} MB`,
        `│ • *External:* ${ext} MB`,
        '└───────────────\n',
        '┌─⊷ *ENGINE*',
        `│ • *OS:* ${platform}`,
        `│ • *Node:* ${process.version}`,
        `│ • *PID:* ${process.pid}`,
        `│ • *Status:* Running`,
        '└───────────────'
    ].join('\n');

    return await message.send(statusText);
});


Command({
    pattern: 'mode ?(.*)',
    desc: lang.plugins.mode.desc,
    type: 'general',
    sudo: true,
}, async (message, match, manji) => {
    if (!match) {
        const currentMode = manji.config.BOT_MODE || 'private';
        return await message.send(lang.plugins.mode.current.format(currentMode));
    }

    const mode = match.toLowerCase();
    if (mode !== 'public' && mode !== 'private') {
        return await message.send(lang.plugins.mode.example.format(config.PREFIX));
    }

    manji.envSet('BOT_MODE', mode);
    await message.send(lang.plugins.mode.status.format(mode));
});