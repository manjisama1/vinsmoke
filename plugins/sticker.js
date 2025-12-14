import {
    Command,
    sticker,
    cropSticker,
    addExif,
    exif,
    tgStk,
    lang,
    Tracker,
    waChatss,
    formatTime
} from '../lib/index.js';
import fs from 'fs';

const st = { chats: new Set(), q: [], tid: null, proc: false };

const proc = async () => {
    if (st.proc || !st.q.length) return;
    st.proc = true;
    try {
        while (st.q.length) {
            const { raw, msg } = st.q.shift();
            const buf = await sticker(raw).catch(() => null);
            if (buf) {
                for (const chat of st.chats) {
                    await msg.send({ sticker: buf }, {}, chat).catch(() => {});
                }
            }
        }
    } finally {
        st.proc = false;
    }
};

const name = (id) => id.endsWith('@g.us') ? lang.plugins.asteal.group : id.split('@')[0];


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
    pattern: 'asteal ?(.*)',
    aliases: ['atake'],
    desc: lang.plugins.asteal.desc,
    type: 'sticker',
}, async (message, match) => {
    const [act, tgt] = (match || '').trim().split(/\s+/);
    const chat = tgt || message.chat;

    switch (act?.toLowerCase()) {
        case 'on':
            st.chats.add(chat);
            if (!st.tid) {
                st.tid = Tracker.register(
                    (msg) => msg.media?.type === 'sticker' && !msg.fromMe && !st.chats.has(msg.chat),
                    async (msg) => {
                        st.q.push({ raw: msg.raw, msg });
                        await proc();
                    },
                    { name: 'StickerSteal' }
                );
            }
            return message.send(lang.plugins.asteal.on.format(name(chat)));

        case 'off':
            st.chats.delete(chat);
            if (!st.chats.size && st.tid) {
                Tracker.unregister(st.tid);
                st.tid = null;
            }
            return message.send(lang.plugins.asteal.off.format(name(chat)));

        case 'status':
            const list = [...st.chats].map(name).join(', ') || lang.plugins.asteal.none;
            return message.send(lang.plugins.asteal.status.format(st.chats.size, st.q.length, list));

        case 'clear':
            st.chats.clear();
            st.q = [];
            if (st.tid) {
                Tracker.unregister(st.tid);
                st.tid = null;
            }
            return message.send(lang.plugins.asteal.cleared);

        default:
            return message.send(lang.plugins.asteal.usage.format(config.PREFIX));
    }
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
        const timeText = formatTime(message.quoted?.time || message.time);
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