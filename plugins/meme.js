import { Command } from '../lib/index.js';
import fetch from 'node-fetch';

Command({
    pattern: 'meme',
    desc: 'Generate random meme',
    type: 'fun',
}, async (message) => {
    try {
        const res = await fetch("https://meme-api.com/gimme");
        const data = await res.json();

        const caption = `😂 *Random Meme*\n\n👍 ${data.ups} | r/${data.subreddit}`;

        await message.send(
            { url: data.url },
            { caption: caption },
            message
        );

    } catch (err) {
        await message.send("*❌ Failed to fetch meme*");
        console.error(err);
    }
});
