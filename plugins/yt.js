import { Command, YouTube, tempDir, config, lang } from '../lib/index.js';
import fs from 'fs';

const yt = new YouTube();

const cookie = () => config.YT_COOKIE?.trim() || null;

const fmtDetails = d =>
    lang.plugins.yt.details.format(d.title, d.channel, d.duration, d.views, d.likes, d.url);

const fmtSearch = r =>
    r.map((v, i) => `*${i + 1}.* ${v.title}\n${v.channel} | ${v.duration}\n${v.url}`)
     .join('\n\n');

Command({
    pattern: 'yt ?(.*)',
    desc: lang.plugins.yt.desc,
    type: 'download',
    react: false,
}, async (message, match) => {
    const args  = match?.trim().split(/\s+/) ?? [];
    const flag  = args[0]?.toLowerCase();
    const query = args.slice(1).join(' ');

    if (!flag || !query) return message.send(lang.plugins.yt.usage);

    if (flag === '-s') {
        const results = await yt.search(query, 10, cookie()).catch(() => null);
        return !results?.length
            ? message.send(lang.plugins.yt.no_results)
            : message.send(fmtSearch(results));
    }

    if (flag === '-d') {
        const info = await yt.details(query, cookie()).catch(e => { 
            message.send(lang.plugins.yt.failed.format(e.message)); 
            return null; 
        });
        if (!info) return;
        return info.thumbnail
            ? message.send({ image: { url: info.thumbnail }, caption: fmtDetails(info) })
            : message.send(fmtDetails(info));
    }

    if (flag !== '-v' && flag !== '-a')
        return message.send(lang.plugins.yt.unknown_flag);

    const loading = await message.send(flag === '-a' ? lang.plugins.yt.downloading_audio : lang.plugins.yt.downloading_video);

    try {
        const result = flag === '-a'
            ? await yt.downAudio(query, tempDir, cookie())
            : await yt.downVideo(query, tempDir, cookie());

        flag === '-a'
            ? await message.send({ audio: { url: result.file }, mimetype: 'audio/mpeg', fileName: `${result.title}.mp3` }, { quoted: message.raw })
            : await message.send({ video: { url: result.file }, caption: `*${result.title}*` }, { quoted: message.raw });

        fs.unlink(result.file, () => {});
    } catch (e) {
        await message.send(lang.plugins.yt.failed.format(e.message));
    } finally {
        loading?.delete?.().catch(() => {});
    }
});