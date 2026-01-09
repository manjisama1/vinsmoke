import { Command, plug, reloadPlugins, lang } from '../lib/index.js';

const extractUrls = text => text.split(/[\s,\n\r]+/)
    .filter(p => p.includes('gist.github.com') || p.includes('github.com/gist'));

const formatError = ({ error, details }) => {
    const detailsStr = details
        ? (Array.isArray(details) ? details : [details]).map(d => `> ${d}`).join('\n')
        : '';
    return lang.plugins.plugin.validationFailed.format(error, detailsStr).trim();
};

const formatMultiple = results => {
    const success = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    let msg = '';

    if (success.length) {
        const items = success.map((r, i) =>
            lang.plugins.plugin.pluginItem.format(i + 1, r.filename, r.commandDisplay)
        ).join('');
        msg += lang.plugins.plugin.installedMulti.format(success.length, items);
    }

    if (failed.length) {
        const items = failed.map((r, i) => {
            const details = r.details && Array.isArray(r.details)
                ? r.details.map(d => `> ${d}`).join('\n')
                : '';
            return lang.plugins.plugin.failedItem.format(i + 1, r.originalFilename || 'unknown', r.error, details);
        }).join('');
        msg += lang.plugins.plugin.failedMulti.format(failed.length, items);
    }

    return msg.trim();
};


Command({
    pattern: 'plugin ?(.*)',
    aliases: ['plug', 'install'],
    description: lang.plugins.plugin.desc,
    category: 'owner',
    sudo: true
}, async (message, match) => {
    const input = match?.trim() || '';

    if (input && !input.includes('gist.github.com') && !input.includes('github.com/gist')) {
        const info = plug.getPluginByCommand(input);
        return await message.send(info?.gistUrl || lang.plugins.plugin.notFound.format(input));
    }

    const urls = input ? extractUrls(input) :
        message.quoted?.text ? extractUrls(message.quoted.text) : [];

    if (!urls.length) return await message.send(lang.plugins.plugin.replyOrAttach);

    const results = await plug.installPlugins(urls);
    if (results.some(r => r.success)) await reloadPlugins();

    await message.send(results.length === 1
        ? results[0].success
            ? lang.plugins.plugin.installed.format(results[0].filename, results[0].commandDisplay)
            : formatError(results[0])
        : formatMultiple(results)
    );
});


Command({
    pattern: 'plugout ?(.*)',
    aliases: ['unplug', 'uninstall'],
    description: lang.plugins.plugout.desc,
    category: 'owner',
    sudo: true
}, async (message, match) => {
    const input = match?.trim() || '';

    if (input) {
        const names = input.split(/[\s,\n\r]+/).filter(n => n.trim());

        if (names.length === 1) {
            const result = await plug.uninstallPlugin(names[0]);
            if (result.success) await reloadPlugins();
            return await message.send(result.success ? lang.plugins.plugout.removed.format(result.filename) : result.error);
        }

        const results = await plug.uninstallPlugins(names);
        const success = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        if (success.length) await reloadPlugins();

        let msg = '';
        if (success.length) {
            const items = success.map((r, i) => lang.plugins.plugout.item.format(i + 1, r.filename)).join('');
            msg += lang.plugins.plugout.removedMulti.format(success.length, items);
        }
        if (failed.length) {
            if (msg) msg += '\n';
            const items = failed.map((r, i) => lang.plugins.plugout.item.format(i + 1, r.error)).join('');
            msg += lang.plugins.plugout.failedMulti.format(failed.length, items);
        }

        return await message.send(msg.trim());
    }

    await message.send(lang.plugins.plugout.provide);
});