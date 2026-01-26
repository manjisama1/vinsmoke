import { Command, plug, reloadPlugins, lang } from '../lib/index.js';

const parseUrls = text => text?.split(/[\s,\n\r]+/).filter(v => v.includes('gist.github.com') || v.includes('github.com/gist')) || [];
const parseNames = text => text?.split(/[\s,]+/).filter(v => v.trim()) || [];

const getFailureStr = ({ error, details }) => {
    const dStr = details ? (Array.isArray(details) ? details : [details]).map(d => `> ${d}`).join('\n') : '';
    return lang.plugins.plugin.validationFailed.format(error, dStr).trim();
};

const formatResults = results => {
    const ok = results.filter(r => r.success), err = results.filter(r => !r.success);
    let out = '';
    if (ok.length) out += lang.plugins.plugin.installedMulti.format(ok.length, ok.map((r, i) => lang.plugins.plugin.pluginItem.format(i + 1, r.filename, r.commandDisplay)).join(''));
    if (err.length) out += (out ? '\n' : '') + lang.plugins.plugin.failedMulti.format(err.length, err.map((r, i) => lang.plugins.plugin.failedItem.format(i + 1, r.originalFilename || '?', r.error, r.details?.map(d => `> ${d}`).join('\n') || '')).join(''));
    return out.trim();
};

Command({
    pattern: 'plugin ?(.*)',
    aliases: ['plug', 'install'],
    description: lang.plugins.plugin.desc,
    category: 'owner',
    sudo: true
}, async (message, match) => {
    const input = match?.trim() || '', urls = parseUrls(input || message.quoted?.text);
    if (!urls.length && input && !input.includes('github.com')) {
        const info = plug.getPluginByCommand(input);
        return await message.send(info?.gistUrl || lang.plugins.plugin.notFound.format(input));
    }
    if (!urls.length) return await message.send(lang.plugins.plugin.replyOrAttach);

    const res = await plug.installPlugins(urls);
    if (res.some(r => r.success)) await reloadPlugins();

    return await message.send(res.length === 1 ? (res[0].success ? lang.plugins.plugin.installed.format(res[0].filename, res[0].commandDisplay) : getFailureStr(res[0])) : formatResults(res));
});

Command({
    pattern: 'plugout ?(.*)',
    aliases: ['unplug', 'uninstall', 'remove'],
    description: lang.plugins.plugout.desc,
    category: 'owner',
    sudo: true
}, async (message, match) => {
    const names = parseNames(match?.trim());
    if (!names.length) return await message.send(lang.plugins.plugout.provide);

    const res = await plug.uninstallPlugins(names);
    const ok = res.filter(r => r.success), err = res.filter(r => !r.success);
    if (ok.length) await reloadPlugins();

    if (res.length === 1) return await message.send(res[0].success ? lang.plugins.plugout.removed.format(res[0].filename) : res[0].error);

    let out = '';
    if (ok.length) out += lang.plugins.plugout.removedMulti.format(ok.length, ok.map((r, i) => lang.plugins.plugout.item.format(i + 1, r.filename)).join(''));
    if (err.length) out += (out ? '\n' : '') + lang.plugins.plugout.failedMulti.format(err.length, err.map((r, i) => lang.plugins.plugout.item.format(i + 1, r.error)).join(''));
    return await message.send(out.trim());
});