import {
    wait,
    Command,
    lang,
    cleanup,
    spotifyDl,
    instaDl,
    downLoad,
    webpToImage,
    webpToMp4,
    cropVideo,
    cropImage,
    resizeMedia,
    mediaRotate,
    imageMeta,
    videoMeta,
    videoToAudio,
    editAudioMeta
} from "../lib/index.js"

import fs from 'fs';
import axios from 'axios';

const safeDelete = (files) => {
    const targets = Array.isArray(files) ? files : [files];
    targets.forEach(file => {
        if (file && fs.existsSync(file)) fs.unlinkSync(file);
    });
};

Command({
    pattern: 'spotify ?(.*)',
    aliases: ['sp', 'song'],
    desc: lang.plugins.spotify.desc,
    type: 'download',
}, async (message, match) => {
    const url =
        match?.trim() ||
        message.quoted?.text?.match(/https?:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+/)?.[0];

    if (!url) return message.send(lang.plugins.spotify.usage);
    if (!/https?:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+/.test(url))
        return message.send(lang.plugins.spotify.invalid_url);

    const downloading = await message.send(lang.plugins.spotify.downloading);

    try {
        const song = await spotifyDl(url);
        if (!song?.url) throw new Error('No download URL');

        const audio = Buffer.from(
            (await axios.get(song.url, { responseType: 'arraybuffer', timeout: 60000 })).data
        );

        await message.send({
            audio,
            mimetype: 'audio/mpeg',
            fileName: `${song.title} - ${song.artist}.mp3`,
            caption: `${song.title}\n${song.artist}`,
            contextInfo: {
                externalAdReply: {
                    title: song.title,
                    body: song.artist,
                },
            },
        });
    } catch (err) {
        console.error('Spotify error:', err);
        await message.send(lang.plugins.spotify.failed);
    } finally {
        downloading?.delete?.().catch(() => {});
    }
});


Command({
    pattern: 'instagram ?(.*)',
    aliases: ['ig', 'insta'],
    desc: lang.plugins.instagram.desc,
    type: 'download',
}, async (message, match) => {
    const url = match?.trim() || message.quoted?.text?.match(/https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[a-zA-Z0-9_-]+/)?.[0];
    
    if (!url) return message.send(lang.plugins.instagram.usage);
    if (!/https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[a-zA-Z0-9_-]+/.test(url)) {
        return message.send(lang.plugins.instagram.invalid_url);
    }

    try {
        const videoUrl = await instaDl(url);
        if (!videoUrl) throw new Error('No video URL');

        const video = Buffer.from((await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 60000 })).data);
        await message.send({ video, mimetype: 'video/mp4' });
    } catch {
        await message.send(lang.plugins.instagram.failed);
    }
});


Command({
    pattern: 'view',
    aliases: ['vv'],
    desc: lang.plugins.view.desc,
    type: 'media'
}, async (message) => {
    const { quoted } = message;
    if (!quoted?.viewOnce) return message.send(lang.plugins.view.reply_vv);
    const clean = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        delete obj.viewOnce;
        Object.values(obj).forEach(clean);
    };
    clean(quoted);
    await message.send({ forward: quoted });
});


Command({
    pattern: 'save',
    aliases: ['sv', '.'],
    desc: lang.plugins.save.desc,
    type: 'media',
    react: false,
    sudo: true
}, async (message) => {
    const { quoted, botJid } = message;
    if (!quoted) return message.send(lang.plugins.save.reply_required);
    const clean = (o) => {
        if (!o || typeof o !== 'object') return;
        delete o.viewOnce;
        Object.values(o).forEach(clean);
    };
    clean(quoted);
    await message.send({ forward: quoted }, {}, botJid);
});


Command({
    pattern: 'forward',
    aliases: ['frd', 'frwd'],
    desc: lang.plugins.forward.desc,
    type: 'tools'
}, async (message, match) => {
    const { quoted } = message;
    if (!quoted) return message.send(lang.plugins.forward.reply_required);
    const clean = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        delete obj.viewOnce;
        Object.values(obj).forEach(clean);
    };
    clean(quoted);
    const jids = match ? match.split(',').map(v => v.trim()) : [message.jid];
    for (const jid of jids) {
        if (jids.length > 1) await wait(2000);
        await message.send({ forward: quoted }, {}, jid);
    }
});


Command({
    pattern: 'toimg',
    desc: lang.plugins.toimg.desc,
    type: 'media'
}, async (message) => {
    const { quoted } = message;
    if (!quoted?.sticker || quoted.animated) return message.send(lang.plugins.toimg.reply_required);

    try {
        const buff = await downLoad(quoted, 'buffer');
        if (!buff) return message.send(lang.plugins.toimg.download_failed);
        const img = await webpToImage(buff, 'png', true);
        await message.send({ image: img });
    } catch {
        message.send(lang.plugins.toimg.conversion_failed);
    }
});


Command({
    pattern: 'tomp4',
    desc: lang.plugins.tomp4.desc,
    type: 'media'
}, async (message) => {
    const sticker = message.quoted?.sticker;
    if (!sticker || !sticker.animated) return message.send(lang.plugins.tomp4.reply_required);

    const stickerPath = await downLoad(message.quoted, 'path');
    if (!stickerPath) return message.send(lang.plugins.tomp4.download_failed);

    try {
        const mp4Path = await webpToMp4(stickerPath);
        await message.send({ video: fs.readFileSync(mp4Path) });
        safeDelete(mp4Path);
    } catch {
        message.send(lang.plugins.tomp4.conversion_failed);
    } finally {
        safeDelete(stickerPath);
    }
});


Command({
    pattern: 'crop ?(.*)',
    desc: lang.plugins.crop.desc,
    type: 'media'
}, async (message, match) => {
    const isVid = !!(message.video || message.quoted?.video);
    const isImg = !!(message.image || message.quoted?.image);
    if (!isVid && !isImg) return message.send(lang.plugins.crop.reply_required);

    const input = (match || '').trim();
    const data = await downLoad(message.quoted || message, 'path');

    if (!input) {
        const meta = isVid ? await videoMeta(data) : await imageMeta(data);
        safeDelete(data);
        return message.send(`*Dimensions:* ${meta?.width || 0}x${meta?.height || 0}`);
    }

    const options = { returnPath: true };
    const [dim, coords] = input.includes('-') ? input.split('-') : [input, null];
    const [x, y] = coords ? coords.split(',').map(Number) : [null, null];

    dim.includes(':') ? (options.ratio = dim) : ([options.width, options.height] = dim.split('x').map(Number));
    if (x !== null) Object.assign(options, { x, y });

    try {
        const result = isVid ? await cropVideo(data, options) : await cropImage(data, options);
        if (!result) return message.send(lang.plugins.crop.failed);

        await message.send(isVid ? { video: { url: result } } : { image: { url: result } });
        safeDelete(result);
    } catch {
        message.send(lang.plugins.crop.failed);
    } finally {
        safeDelete(data);
    }
});


Command({
    pattern: 'resize ?(.*)',
    desc: lang.plugins.resize.desc,
    type: 'media'    
}, async (message, match) => {
    const isVid = !!(message.video || message.quoted?.video);
    const isImg = !!(message.image || message.quoted?.image);
    if (!isVid && !isImg) return message.send(lang.plugins.resize.reply_required);

    const input = (match || '').trim();
    if (!input) return message.send(lang.plugins.resize.usage);

    const [size, fitMode = 'contain'] = input.split(/\s+/);
    const resizedPath = await resizeMedia(message.quoted || message, size, { fit: fitMode });
    
    if (!resizedPath) return message.send(lang.plugins.resize.failed);

    try {
        await message.send(isVid ? { video: { url: resizedPath } } : { image: { url: resizedPath } });
    } finally {
        safeDelete(resizedPath);
    }
});


Command({
    pattern: 'rotate ?(.*)',
    desc: lang.plugins.rotate.desc,
    type: 'media'  
}, async (message, match) => {
    const isVid = !!(message.video || message.quoted?.video);
    const isImg = !!(message.image || message.quoted?.image);

    if (!isVid && !isImg) return message.send(lang.plugins.rotate.reply_required);
    
    const angle = match?.trim();
    if (!angle) return message.send(lang.plugins.rotate.usage);

    const rotated = await mediaRotate(message.quoted || message, angle);
    if (!rotated) return message.send(lang.plugins.rotate.failed);

    try {
        await message.send(isVid ? { video: { url: rotated } } : { image: { url: rotated } });
    } finally {
        safeDelete(rotated);
    }
});


Command({
    pattern: 'tomp3 ?(.*)',
    aliases: ['toaudio', 'mp3'],
    desc: lang.plugins.tomp3.desc,
    type: 'media'
}, async (message, match) => {
    const isVid = !!(message.video || message.quoted?.video);
    const isAud = !!(message.audio || message.quoted?.audio);
    if (!isVid && !isAud) return message.send(lang.plugins.tomp3.noMedia);

    try {
        const title = match?.trim() || undefined;
        const target = message.quoted || message;
        
        const audio = isVid 
            ? await videoToAudio(target, { format: 'mp3', quality: '128k', title })
            : await editAudioMeta(target, title);

        if (!audio) return message.send(lang.plugins.tomp3.failed);

        const fileName = title ? `${title.replace(/[^\w\s.-]/g, '_')}.mp3` : `audio_${Date.now()}.mp3`;

        await message.send({
            audio: Buffer.isBuffer(audio) ? audio : { url: audio },
            mimetype: 'audio/mpeg',
            fileName
        });

        if (typeof audio === 'string') safeDelete(audio);
    } catch {
        message.send(lang.plugins.tomp3.failed);
    }
});