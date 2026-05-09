import { Command, YouTube,  tempDir, config, lang } from '../lib/index.js';
import fs from 'fs';

const yt = new YouTube();

Command({
    pattern: 'yt ?(.*)',
    desc: lang.plugins.yt.desc,
    type: 'download',
}, async (message, match) => {
    const args  = match?.trim().split(/\s+/) ?? [];
    const flag  = args[0]?.toLowerCase();
    const query = args.slice(1).join(' ');

    if (!flag || !query) return message.send(lang.plugins.yt.usage);

    const cookie = config.YT_COOKIE?.trim() || null;

    if (flag === '-s') {
        const results = await yt.search(query, 10, cookie).catch(() => null);
        return !results?.length
            ? message.send(lang.plugins.yt.no_results)
            : message.send(yt.fmtSearch(results));
    }

    if (flag === '-d') {
        const info = await yt.details(query, cookie).catch(e => {
            message.send(lang.plugins.yt.failed.format(e.message));
            return null;
        });
        if (!info) return;
        const text = lang.plugins.yt.details.format(info.title, info.channel, info.duration, info.views, info.likes, info.url);
        return info.thumbnail
            ? message.send({ image: { url: info.thumbnail }, caption: text })
            : message.send(text);
    }

    if (flag !== '-v' && flag !== '-a')
        return message.send(lang.plugins.yt.unknown_flag);

    const loading = await message.send(
        flag === '-a' ? lang.plugins.yt.downloading_audio : lang.plugins.yt.downloading_video
    );

    try {
        const result = flag === '-a'
            ? await yt.downloadAudio(query, tempDir, cookie)
            : await yt.downloadVideo(query, tempDir, cookie);

        await (flag === '-a'
            ? message.send({ audio: { url: result.file }, mimetype: 'audio/mpeg', fileName: `${result.title}.mp3` })
            : message.send({ video: { url: result.file }, caption: `*${result.title}*` }));

        fs.unlink(result.file, () => {});
    } catch (e) {
        await message.send(lang.plugins.yt.failed.format(e.message));
    } finally {
        loading?.delete?.().catch(() => {});
    }
});
