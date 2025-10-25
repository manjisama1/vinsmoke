import { Command, Tracker, lang, config } from '../lib/index.js';

let enabledChats = new Set();
let stickerQueue = [];
let globalTrackerId = null;
let processing = false;

async function processQueue() {
    if (processing || stickerQueue.length === 0) return;
    processing = true;

    while (stickerQueue.length > 0) {
        const { rawMessage, manji } = stickerQueue.shift();
        const stickerBuffer = await manji.sticker(rawMessage);

        if (stickerBuffer) {
            for (const chat of enabledChats) {
                await manji.client.sendMessage(chat, { sticker: stickerBuffer });
            }
        }
    }
    processing = false;
}

function getChatName(chatId) {
    if (chatId.endsWith('@g.us')) {
        return lang.plugins.asteal.group;
    }
    return chatId.split('@')[0];
}

Command({
    pattern: 'asteal ?(.*)',
    desc: lang.plugins.asteal.desc,
    type: 'sticker',
}, async (message, match, manji) => {
    const args = (match || '').trim().split(/\s+/);
    const action = args[0]?.toLowerCase();

    switch (action) {
        case 'on': {
            const targetChat = args[1] || message.chat;
            enabledChats.add(targetChat);

            if (!globalTrackerId) {
                globalTrackerId = Tracker.register(
                    (msg) => msg.sticker && !msg.fromMe && !enabledChats.has(msg.chat),
                    async (msg) => {
                        stickerQueue.push({ rawMessage: msg.raw, manji });
                        processQueue();
                    },
                    { name: 'StickerSteal' }
                );
            }

            const chatName = getChatName(targetChat);
            await message.send(lang.plugins.asteal.on.format(chatName));
            break;
        }

        case 'off': {
            const targetChat = args[1] || message.chat;
            enabledChats.delete(targetChat);

            if (enabledChats.size === 0 && globalTrackerId) {
                Tracker.unregister(globalTrackerId);
                globalTrackerId = null;
            }

            const chatName = getChatName(targetChat);
            await message.send(lang.plugins.asteal.off.format(chatName));
            break;
        }

        case 'status': {
            const chats = Array.from(enabledChats);
            const chatNames = chats.map(getChatName);
            const chatList = chatNames.join(', ') || lang.plugins.asteal.none;
            await message.send(lang.plugins.asteal.status.format(chats.length, stickerQueue.length, chatList));
            break;
        }

        case 'clear': {
            enabledChats.clear();
            stickerQueue = [];
            if (globalTrackerId) {
                Tracker.unregister(globalTrackerId);
                globalTrackerId = null;
            }
            await message.send(lang.plugins.asteal.cleared);
            break;
        }

        default: {
            await message.send(lang.plugins.asteal.usage.format(config.PREFIX));
            break;
        }
    }
});
