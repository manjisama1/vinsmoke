/*Under Construction ---


import { Command, manjitube, lang } from '../lib/index.js';

Command({
    pattern: 'yta ?(.*)',
    desc: lang.plugins.yta.desc,
    type: 'media'
}, async (message, match) => {
    const url = match || message.quoted?.text;
    if (!url || !/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/.test(url)) {
        return message.send(lang.plugins.yta.no_url);
    }
    
    const id = manjitube.extractId(url);
    if (!id) return message.send(lang.plugins.yta.no_url);
    
    try {
        const { path, buffer, title } = await manjitube.download(id, 'audio');
        await message.send({ audio: buffer, mimetype: 'audio/mpeg', fileName: `${title}.mp3` });
        manjitube.cleanup(path);
    } catch (e) {
        console.error('[YTA Error]:', e.message);
        return message.send(lang.plugins.yta.fail);
    }
});

Command({
    pattern: 'ytv ?(.*)',
    desc: lang.plugins.ytv.desc,
    type: 'media'
}, async (message, match) => {
    const url = match || message.quoted?.text;
    if (!url || !/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/.test(url)) {
        return message.send(lang.plugins.ytv.no_url);
    }
    
    const id = manjitube.extractId(url);
    if (!id) return message.send(lang.plugins.ytv.no_url);
    
    try {
        const { path, buffer, title } = await manjitube.download(id, 'video');
        await message.send({ video: buffer, caption: title, fileName: `${title}.mp4` });
        manjitube.cleanup(path);
    } catch (e) {
        console.error('[YTV Error]:', e.message);
        return message.send(lang.plugins.ytv.fail);
    }
});
*/