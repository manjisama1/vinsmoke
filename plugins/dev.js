import { Command, lang, Tracker } from '../lib/index.js';
import util from 'util';


Command({
    pattern: 'track ?(.*)',
    desc: lang.plugins.track.desc,
    type: 'dev',
    sudo: true
}, async (message, match) => {
    const input = match?.trim() || '';
    const parts = input.split(' ');
    const mode = parts[0]?.toLowerCase();
    const count = parseInt(parts[1] || parts[0]) || 0;

    if (count <= 0 || count > 100) return message.send(lang.plugins.track.invalid);
    if (mode && !['a', 'b', 'basic', 'advance'].includes(mode) && isNaN(parseInt(mode))) {
        return message.send(lang.plugins.track.usage);
    }

    const { chat, botJid } = message;
    const target = botJid || chat;
    const isAdvanced = mode === 'a' || mode === 'advance';
    const isBasic = mode === 'b' || mode === 'basic';
    const logMode = isAdvanced ? 'ADVANCE' : isBasic ? 'BASIC' : 'ADVANCE';

    let tracked = 0;
    await message.send(lang.plugins.track.started.format(count));

    const taskId = Tracker.register({ chat }, async (msg) => {
        let log;

        if (isBasic) {
            log = JSON.stringify(msg.raw, (key, value) => {
                if (value instanceof Uint8Array) return Array.from(value);
                if (typeof value === 'function') return '[Function]';
                return value;
            }, 2);
        } else {
            log = util.inspect(msg.raw, {
                depth: null,
                showHidden: true,
                colors: false,
                maxArrayLength: null,
                maxStringLength: null,
                breakLength: 80,
                compact: false
            });
        }

        console.log(`[TRACK ${logMode} ${++tracked}/${count}]`, log);

        await message.send(`${lang.plugins.track.log.format(tracked, count)} (${logMode})\n\`\`\`json\n${log}\n\`\`\``, {}, target);

        if (tracked >= count) {
            Tracker.unregister(taskId);
            await message.send(lang.plugins.track.completed);
            await message.send(lang.plugins.track.finished.format(chat), {}, target);
        }
    });
});


Command({
    pattern: 'db ?(.*)',
    desc: lang.plugins.db.desc,
    type: 'dev',
    sudo: true
}, async (message) => {
    const data = message.quoted || message.raw;
    const json = JSON.stringify(data, null, 2);
    await message.send(`\`\`\`json\n${json}\n\`\`\``);
    console.log(data);
});