import {
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
  videoMeta,
  videoToAudio,
  editAudioMeta
} from "../lib/index.js"

import fs from 'fs';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';


Command({
    pattern: 'spotify ?(.*)',
    aliases: ['sp', 'song'],
    desc: lang.plugins.spotify.desc,
    type: 'media',
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
    type: 'media',
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
    if (!message.quoted?.viewOnce)
        return message.send(lang.plugins.view.reply_vv);

    const quoted = message.quoted;

    (function clean(obj) {
        if (obj && typeof obj === 'object') {
            delete obj.viewOnce;
            for (const val of Object.values(obj)) clean(val);
        }
    })(quoted);

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
    if (!message.quoted) return message.send(lang.plugins.save.reply_required);

    const quoted = message.quoted;

    (function clean(obj) {
        if (obj && typeof obj === 'object') {
            delete obj.viewOnce;
            for (const val of Object.values(obj)) clean(val);
        }
    })(quoted);

    await message.send({ forward: quoted }, {}, message.botJid);
});


Command({
    pattern: 'toimg',
    desc: lang.plugins.toimg.desc,
    type: 'media'
}, async (message) => {
    try {
        if (!message.quoted?.sticker || message.quoted.sticker.animated) return message.send(lang.plugins.toimg.reply_required);

        const buffer = await downLoad(message.quoted, 'buffer');
        if (!buffer) return message.send(lang.plugins.toimg.download_failed);
        const imagePath = await webpToImage(buffer, 'png');
        const imageBuffer = fs.readFileSync(imagePath);
        await message.send({ image: imageBuffer });
        fs.unlinkSync(imagePath);
    } catch {
        message.send(lang.plugins.toimg.conversion_failed);
    }
});


Command({
    pattern: 'tomp4',
    desc: lang.plugins.tomp4.desc,
    type: 'media'
}, async (message) => {
    try {
        if (!message.quoted?.sticker || !message.quoted.sticker.animated) 
            return message.send(lang.plugins.tomp4.reply_required);

        const stickerPath = await downLoad(message.quoted, 'path');
        if (!stickerPath) return message.send(lang.plugins.tomp4.download_failed);

        const mp4Path = await webpToMp4(stickerPath);
        await message.send({ video: fs.readFileSync(mp4Path) });

        fs.unlinkSync(mp4Path);
        fs.unlinkSync(stickerPath);
    } catch {
        message.send(lang.plugins.tomp4.conversion_failed);
    }
});

Command({
    pattern: 'crop ?(.*)',
    desc: lang.plugins.crop.desc,
    type: 'media'
}, async (message, match) => {
    const target = message.video || message.image || message.quoted?.video || message.quoted?.image;
    if (!target) return message.send(lang.plugins.crop.reply_required);

    if (!match) {
        const data = await downLoad(message.raw, 'both');
        return new Promise((res) => {
            ffmpeg(data.path).ffprobe((err, meta) => {
                if (err) return message.send(lang.plugins.crop.failed_info);
                const { width, height } = meta.streams[0];
                message.send(`*Dimensions:* ${width}x${height}`);
                cleanup([data.path]);
                res();
            });
        });
    }

    const input = match.trim();
    let options = { returnPath: true };

    if (input.includes('-')) {
        const [dim, coords] = input.split('-');
        const [x, y] = coords.split(',').map(Number);
        if (dim.includes(':')) options.ratio = dim;
        else [options.width, options.height] = dim.split('x').map(Number);
        options.x = x;
        options.y = y;
    } else {
        if (input.includes(':')) options.ratio = input;
        else [options.width, options.height] = input.split('x').map(Number);
    }

    if (!resultPath) return message.send(lang.plugins.crop.failed);

    try {
        const isVideo = message.video || message.quoted?.video;
        if (isVideo) {
            await message.send({ video: { url: resultPath } });
        } else {
            await message.send({ image: { url: resultPath } });
        }
    } finally {
        if (fs.existsSync(resultPath)) fs.unlinkSync(resultPath);
    }
});

Command({
    pattern: 'resize ?(.*)',
    desc: lang.plugins.resize.desc,
    type: 'media'    
}, async (message, match) => {
    const target = message.video || message.image || message.quoted?.video || message.quoted?.image;
    if (!target) return message.send(lang.plugins.resize.reply_required);
    if (!match) return message.send(lang.plugins.resize.usage);

    const parts = match.trim().split(/\s+/);
    const size = parts[0];
    const fitMode = parts[1] || 'contain';

    const resizedPath = await resizeMedia(message.raw, size, { fit: fitMode });
    
    if (!resizedPath) return message.send(lang.plugins.resize.failed);

    try {
        if (message.video || message.quoted?.video) {
            await message.send({ video: { url: resizedPath } });
        } else {
            await message.send({ image: { url: resizedPath } });
        }
    } finally {
        if (fs.existsSync(resizedPath)) fs.unlinkSync(resizedPath);
    }
});


Command({
    pattern: 'rotate ?(.*)',
    desc: lang.plugins.rotate.desc,
    type: 'media'  
}, async (message, match) => {
    const isVideo = message.video || message.quoted?.video;
    const isImage = message.image || message.quoted?.image;

    if (!isVideo && !isImage) return message.send(lang.plugins.rotate.reply_required);
    if (!match) return message.send(lang.plugins.rotate.usage);

    const rotated = await mediaRotate(message.raw, match.trim());
    if (!rotated) return message.send(lang.plugins.rotate.failed);

    if (isVideo) {
        await message.send({ video: { url: rotated } });
    } else {
        await message.send({ image: { url: rotated } });
    }
});


Command({
    pattern: 'tomp3 ?(.*)',
    aliases: ['toaudio', 'mp3'],
    desc: lang.plugins.tomp3.desc,
    type: 'media'
}, async (message, match) => {
    const video = message.video || message.quoted?.video;
    const audio = message.audio || message.quoted?.audio;
    
    if (!video && !audio) return message.send(lang.plugins.tomp3.noMedia);

    try {
        const title = match?.trim() || undefined;
        let audioBuffer;

        if (video) {
            audioBuffer = await videoToAudio(message.raw, { format: 'mp3', quality: '128k', title });
        } else {
            audioBuffer = await editAudioMeta(message.raw, title);
        }

        if (!audioBuffer) return message.send(lang.plugins.tomp3.failed);

        const fileName = title ? `${title.replace(/[^\w\s.-]/g, '_')}.mp3` : `manji_audio_${Date.now()}.mp3`;

        await message.send({
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName
        });
    } catch {
        await message.send(lang.plugins.tomp3.failed);
    }
});