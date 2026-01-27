import {
    Command,
    sticker,
    cropSticker,
    addExif,
    exif,
    tgStk,
    lang,
    config,
    Tracker,
    waChatss,
    formatTime
} from '../lib/index.js';

import fs from 'fs';


Command({
    pattern: 'sticker',
    aliases: ['s', 'skt', 'skr', 'sti'],
    desc: lang.plugins.sticker.desc,
    type: 'sticker',
}, async (message) => {
    const stickerBuffer = await sticker(message.raw);

    if (!stickerBuffer) {
        return await message.send(lang.plugins.sticker.reply_required);
    }

    await message.send({ sticker: stickerBuffer });
});


Command({
    pattern: 'steal ?(.*)',
    aliases: ['t', 'take'],
    desc: lang.plugins.steal.desc,
    type: 'sticker',
}, async (message, match) => {
    let pack, author;

    if (!match || match.trim() === '') {
        pack = undefined;
        author = undefined;
    } else {
        const parts = match.split(',').map(x => x?.trim() || undefined);
        pack = parts[0];
        author = parts[1];
    }

    const stickerBuffer = await sticker(message.raw, pack, author);

    if (!stickerBuffer) {
        return await message.send(lang.plugins.steal.reply_required);
    }

    await message.send({ sticker: stickerBuffer });
});


Command({
    pattern: 'exif',
    aliases: ['getexif', 'stickerinfo'],
    desc: lang.plugins.exif.desc,
    type: 'sticker',
}, async (message) => {
    const exifData = await exif(message.raw);

    if (!exifData) {
        return await message.send(lang.plugins.exif.no_data);
    }

    const info = lang.plugins.exif.info.format(
        exifData.packname,
        exifData.author,
        exifData.packId,
        exifData.emojis
    );

    await message.send(info);
});


Command({
    pattern: "tg ?(.*)",
    aliases: ["telegram"],
    desc: lang.plugins.tg.desc,
    type: "sticker",
}, async (message, match) => {
    const link = match?.trim();
    if (!link) return message.send(lang.plugins.tg.reply_required);

    const msgFetching = await message.send(lang.plugins.tg.fetching);

    try {
        await tgStk(link, async (filePath) => {
            const stickerBuffer = fs.readFileSync(await addExif(filePath));
            await message.send({ sticker: stickerBuffer });
            fs.rmSync(filePath, { force: true });
        });

        await message.send(lang.plugins.tg.done);

    } catch (err) {
        console.error(err);
        await message.send(lang.plugins.tg.failed);
    } finally {
        await msgFetching?.delete?.().catch(() => { });
    }
});


Command({
    pattern: 'cs',
    aliases: ['cropsticker'],
    desc: lang.plugins.cs.desc,
    type: 'sticker'
}, async (message) => {
    try {
        const stickerBuffer = await cropSticker(message.raw);

        if (!stickerBuffer) return message.send(lang.plugins.cs.reply_required);

        await message.send({ sticker: stickerBuffer });
    } catch (err) {
        console.error('CS error:', err);
        await message.send(lang.plugins.cs.error);
    }
});


Command({
    pattern: 'ws ?(.*)',
    desc: lang.plugins.ws.desc,
    type: 'sticker'
}, async (message, match, manji) => {
    const text = message.quoted?.text || match?.trim();
    if (!text) return message.send(lang.plugins.ws.noText);
    
    try {
        const senderName = message.quoted?.name || message.name || 'User';
        const timeText = formatTime(message.quoted?.timestamp || message.timestamp);
        const senderJid = message.quoted?.sender || message.sender;
        
        let profilePicUrl;
        try { profilePicUrl = await manji.fetchProfilePic(senderJid); } catch {}
        
        const imagePath = await waChatss(text, senderName, timeText, profilePicUrl);
        if (!imagePath) return;
        
        await message.send({ sticker: await sticker(imagePath) });
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        
    } catch (error) {
        console.error('WS:', error);
    }
});