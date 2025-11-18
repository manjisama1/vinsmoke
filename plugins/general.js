import { Command, lang } from '../lib/index.js';



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
    pattern: 'menu',
    desc: lang.plugins.menu.desc,
    type: 'general',
}, async (message, match, manji) => {
    const menuText = manji.menu(
        message.client.pluginManager,
        manji.config,
        message
    );

    await message.send(menuText);
});

Command({
    pattern: 'status',
    desc: lang.plugins.status.desc,
    type: 'general',
}, async (message, match, manji) => {
    const uptime = process.uptime();
    const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
    const mode = manji.config.BOT_MODE || 'private';
    const prefix = manji.config.PREFIX || '.';
    const sudoUsers = manji.envList('SUDO').length;

    const memUsage = process.memoryUsage();
    const rss = (memUsage.rss / 1024 / 1024).toFixed(2);
    const heapUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotal = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
    const external = (memUsage.external / 1024 / 1024).toFixed(2);

    const platformNames = {
        win32: 'Windows',
        darwin: 'macOS',
        linux: 'Linux',
        android: 'Android',
        freebsd: 'FreeBSD',
        openbsd: 'OpenBSD',
        sunos: 'SunOS',
        aix: 'AIX'
    };
    const platform = platformNames[process.platform] || process.platform;
    const nodeVersion = process.version;
    const pid = process.pid;
    const connection = 'Connected';

    const statusText = lang.plugins.status.template.format(
        uptimeStr, mode, prefix, sudoUsers,
        rss, heapUsed, heapTotal, external,
        platform, nodeVersion, pid, connection
    );

    await message.send(statusText);
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
        return await message.send(lang.plugins.mode.example);
    }

    manji.envSet('BOT_MODE', mode);
    await message.send(lang.plugins.mode.status.format(mode));
});
