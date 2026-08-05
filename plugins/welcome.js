import { Command, lang, config } from '../lib/index.js';
import { wgKey, mediaTag, clearMedia, saveMedia, setConfig, getConfig, delConfig } from '../lib/wg.js';

Command({
    pattern: 'welcome ?(.*)',
    desc:    lang.plugins.welcome.desc,
    type:    'group',
    group:   true,
}, async (message, match, manji) => {
    const L   = lang.plugins.welcome;
    const raw = match?.trim() ?? '';
    const cmd = raw.toLowerCase();
    const gid = message.chat;
    const k   = wgKey(gid, 'welcome');

    if (!await manji.isBotAdmin(gid)) return message.send(L.botNotAdmin);
    if (!message.fromMe && !await message.admin()) return message.send(L.notAllowed);
    if (!raw || cmd === 'help') return message.send(L.usage.format(config.PREFIX));

    if (cmd === 'on') {
        const cur = getConfig(gid, 'welcome') ?? {};
        setConfig(gid, 'welcome', {
            text:      cur.text      ?? 'Welcome &mention',
            mediaType: cur.mediaType ?? null,
            mediaPath: cur.mediaPath ?? null,
            enabled:   true,
        });
        return message.send(L.enabled);
    }

    if (cmd === 'off') {
        const cur = getConfig(gid, 'welcome') ?? {};
        setConfig(gid, 'welcome', { ...cur, enabled: false });
        return message.send(L.disabled);
    }

    if (cmd === 'clear') {
        clearMedia(gid, 'welcome');
        delConfig(gid, 'welcome');
        return message.send(L.cleared);
    }

    if (cmd === 'info') {
        const cur = getConfig(gid, 'welcome');
        if (!cur) return message.send(L.noConfig);
        return message.send(L.info.format(cur.enabled ? 'ON' : 'OFF', cur.text, cur.mediaType ?? 'none'));
    }

    const text = raw.startsWith('set ') ? raw.slice(4).trim() : raw;
    if (!text) return message.send(L.usage.format(config.PREFIX));

    const mv = mediaTag(text);

    if (mv === '&grouppicture') {
        clearMedia(gid, 'welcome');
        setConfig(gid, 'welcome', { text, enabled: true, mediaType: 'grouppicture', mediaPath: null });
        return message.send(L.set.format(text));
    }

    if (mv === '&image' || mv === '&video' || mv === '&audio') {
        const needImg  = mv === '&image';
        const needAud  = mv === '&audio';
        const hasRight = needImg ? !!message.quoted?.image
            : needAud  ? !!message.quoted?.audio
            : !!message.quoted?.video;

        if (!hasRight) return message.send(needImg ? L.replyImage : needAud ? L.replyAudio : L.replyVideo);

        const saved = await saveMedia(message, gid, 'welcome');
        if (!saved) return message.send(L.mediaFail);

        setConfig(gid, 'welcome', { text, enabled: true, ...saved });
        return message.send(L.set.format(text));
    }

    setConfig(gid, 'welcome', { text, enabled: true, mediaType: null, mediaPath: null });
    return message.send(L.set.format(text));
});


Command({
    pattern: 'goodbye ?(.*)',
    desc:    lang.plugins.goodbye.desc,
    type:    'group',
    group:   true,
}, async (message, match, manji) => {
    const L   = lang.plugins.goodbye;
    const raw = match?.trim() ?? '';
    const cmd = raw.toLowerCase();
    const gid = message.chat;

    if (!await manji.isBotAdmin(gid)) return message.send(L.botNotAdmin);
    if (!message.fromMe && !await message.admin()) return message.send(L.notAllowed);
    if (!raw || cmd === 'help') return message.send(L.usage.format(config.PREFIX));

    if (cmd === 'on') {
        const cur = getConfig(gid, 'goodbye') ?? {};
        setConfig(gid, 'goodbye', {
            text:      cur.text      ?? 'Goodbye &mention',
            mediaType: cur.mediaType ?? null,
            mediaPath: cur.mediaPath ?? null,
            enabled:   true,
        });
        return message.send(L.enabled);
    }

    if (cmd === 'off') {
        const cur = getConfig(gid, 'goodbye') ?? {};
        setConfig(gid, 'goodbye', { ...cur, enabled: false });
        return message.send(L.disabled);
    }

    if (cmd === 'clear') {
        clearMedia(gid, 'goodbye');
        delConfig(gid, 'goodbye');
        return message.send(L.cleared);
    }

    if (cmd === 'info') {
        const cur = getConfig(gid, 'goodbye');
        if (!cur) return message.send(L.noConfig);
        return message.send(L.info.format(cur.enabled ? 'ON' : 'OFF', cur.text, cur.mediaType ?? 'none'));
    }

    const text = raw.startsWith('set ') ? raw.slice(4).trim() : raw;
    if (!text) return message.send(L.usage.format(config.PREFIX));

    const mv = mediaTag(text);

    if (mv === '&grouppicture') {
        clearMedia(gid, 'goodbye');
        setConfig(gid, 'goodbye', { text, enabled: true, mediaType: 'grouppicture', mediaPath: null });
        return message.send(L.set.format(text));
    }

    if (mv === '&image' || mv === '&video' || mv === '&audio') {
        const needImg  = mv === '&image';
        const needAud  = mv === '&audio';
        const hasRight = needImg ? !!message.quoted?.image
            : needAud  ? !!message.quoted?.audio
            : !!message.quoted?.video;

        if (!hasRight) return message.send(needImg ? L.replyImage : needAud ? L.replyAudio : L.replyVideo);

        const saved = await saveMedia(message, gid, 'goodbye');
        if (!saved) return message.send(L.mediaFail);

        setConfig(gid, 'goodbye', { text, enabled: true, ...saved });
        return message.send(L.set.format(text));
    }

    setConfig(gid, 'goodbye', { text, enabled: true, mediaType: null, mediaPath: null });
    return message.send(L.set.format(text));
});
