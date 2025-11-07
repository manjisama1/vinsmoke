import { Command, lang, spotifyDl, instaDl, downLoad, webpToImage, webpToMp4 } from '../lib/index.js';
import fs from 'fs';
import axios from 'axios';

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
    const url =
        match?.trim() ||
        message.quoted?.text?.match(/https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[a-zA-Z0-9_-]+/)?.[0];

    if (!url) return message.send(lang.plugins.instagram.usage);
    if (!/https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[a-zA-Z0-9_-]+/.test(url))
        return message.send(lang.plugins.instagram.invalid_url);

    const downloading = await message.send(lang.plugins.instagram.downloading);

    try {
        const videoUrl = await instaDl(url);
        if (!videoUrl) throw new Error('No video URL');

        const video = Buffer.from(
            (await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 60000 })).data
        );

        await message.send({
            video,
            mimetype: 'video/mp4',
        });
    } catch (err) {
        console.error('Instagram error:', err);
        await message.send(lang.plugins.instagram.failed);
    } finally {
        downloading?.delete?.().catch(() => {});
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
    react: false
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
        if (!message.quoted.sticker || message.quoted.sticker.isAnimated) return message.send(lang.plugins.toimg.reply_required);

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
        if (!message.quoted?.sticker || !message.quoted.sticker.isAnimated) 
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