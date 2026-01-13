import { Command, yt, lang } from '../lib/index.js';

Command({
    pattern: 'yta ?(.*)',
    desc: lang.plugins.yta.desc,
    type: 'download',
}, async (message, match) => {
    const input = match || message.quoted?.text;
    if (!input) return await message.send(lang.plugins.yta.no_url);

    try {
        const { path, buffer, title } = await yt.get(input, 'audio');

        await message.send({ 
            audio: buffer, 
            mimetype: 'audio/mp4', 
            fileName: `${title}.m4a` 
        });

        return await yt.cls(path);
    } catch {
        return await message.send(lang.plugins.yta.fail);
    }
});


Command({
    pattern: 'ytv ?(.*)',
    desc: lang.plugins.ytv.desc,
    type: 'download',
}, async (message, match) => {
    const input = match || message.quoted?.text;
    if (!input) return await message.send(lang.plugins.ytv.no_url);

    const q = input.match(/\b(144|240|360|480|720|1080)\b/)?.[0] || '360';
    const query = input.replace(q, '').trim();

    try {
        const { path, buffer, title } = await yt.get(query, 'video', q);

        await message.send({ 
            video: buffer, 
            fileName: `${title}.mp4` 
        });

        return await yt.cls(path);
    } catch {
        return await message.send(lang.plugins.ytv.fail);
    }
});