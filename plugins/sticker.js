import {
    Command,
    sticker,
    cropImage,
    circleCrop,
    roundedCrop,
    tempDir,
    pinterest,
    addExif,
    exif,
    tgStk,
    lang,
    downLoad
} from '../lib/index.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', 'config.env') });

const settingsPath = path.join(__dirname, '..', 'db', 'sticker.json');
const del = f => fs.existsSync(f) && fs.unlinkSync(f);

const getSettings = () => {
    if (!fs.existsSync(settingsPath))
        fs.writeFileSync(settingsPath, JSON.stringify({ settings: { ratio: '1:1', placement: 1, type: '0' } }, null, 2));
    return JSON.parse(fs.readFileSync(settingsPath)).settings;
};



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
    pattern: 'take ?(.*)',
    aliases: ['t'],
    desc: lang.plugins.take.desc,
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
        return await message.send(lang.plugins.take.reply_required);
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
    const temp = [];
    try {
        const media = await downLoad(message.raw, 'path');
        if (!media) return message.send(lang.plugins.cs.reply_required);
        temp.push(media);

        const { ratio, placement, type } = getSettings();
        let processed = media;

        if (ratio !== '0') {
            processed = await cropImage(media, ratio, parseInt(placement) || 1);
            temp.push(processed);
        }

        if (type && type !== '0') {
            let shaped;
            if (type === 'circle') shaped = await circleCrop(processed);
            else if (type === 'rounded') shaped = await roundedCrop(processed, 80);
            if (shaped) {
                temp.push(shaped);
                if (shaped !== processed) processed = shaped;
            }
        }

        const stk = await sticker(processed);
        if (!stk) return message.send(lang.plugins.cs.failed);
        await message.send({ sticker: stk });

    } catch (err) {
        console.error('CS error:', err);
        await message.send(lang.plugins.cs.error);
    } finally {
        temp.forEach(del);
    }
});
