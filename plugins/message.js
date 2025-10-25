import { Command, lang } from '../lib/index.js';

Command({
    pattern: 'star',
    desc: 'Star a message (reply to message)',
    type: 'owner',
}, async (message) => {
    try {
        if (!message.quoted) {
            return await message.reply(lang.plugins.star.noQuoted);
        }
        await message.star(message.quoted);
    } catch (error) {
        await message.reply(lang.plugins.star.error.format(error.message));
    }
});

Command({
    pattern: 'unstar',
    desc: 'Unstar a message (reply to message)',
    type: 'owner',
}, async (message) => {
    try {
        if (!message.quoted) {
            return await message.reply(lang.plugins.unstar.noQuoted);
        }
        await message.unstar(message.quoted);
    } catch (error) {
        await message.reply(lang.plugins.unstar.error.format(error.message));
    }
});

