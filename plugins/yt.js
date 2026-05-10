import { Command, Youtube, config, tempDir, lang } from '../lib/index.js';
import fs from 'fs/promises';

const yt = new Youtube(config.YT_COOKIE);

const fmtSearch = r => r.map((v, i) => 
    `*${i + 1}.* ${v.title}\n${v.channel} | ${v.duration} | ${v.views}\n${v.url}`
).join('\n\n');

const fmtDetails = d => 
    lang.plugins.yt.details.format(d.title, d.channel, d.duration, d.views, d.likes, d.url);


Command({
    pattern: 'yt ?(.*)',
    desc: lang.plugins.yt.desc,
    type: 'download',
}, async (message, match) => {
    const [flag, ...queryArgs] = match?.trim().split(/\s+/) ?? [];
    const query = queryArgs.join(' ');

    if (!flag || !query) return message.send(lang.plugins.yt.usage);

    if (flag === '-s') {
        const res = await yt.search(query, 10).catch(() => null);
        return !res?.length ? message.send(lang.plugins.yt.no_results) : message.send(fmtSearch(res));
    }

    if (flag === '-d') {
        const info = await yt.details(query).catch(e => message.send(lang.plugins.yt.failed.format(e.message)));
        if (!info) return;
        const caption = fmtDetails(info);
        return info.thumbnail ? message.send({ image: { url: info.thumbnail }, caption }) : message.send(caption);
    }

    const modes = {
        '-a': { method: 'audio', mime: 'audio/mpeg', ext: 'mp3', msg: lang.plugins.yt.downloading_audio },
        '-v': { method: 'video', mime: 'video/mp4', ext: 'mp4', msg: lang.plugins.yt.downloading_video }
    };

    const mode = modes[flag];
    if (!mode) return message.send(lang.plugins.yt.unknown_flag);

    const status = await message.send(mode.msg);
    
    try {
        const res = await yt[mode.method](query, tempDir);
        const payload = mode.method === 'audio' 
            ? { audio: { url: res.file }, mimetype: mode.mime, fileName: `${res.title}.${mode.ext}` }
            : { video: { url: res.file }, caption: `*${res.title}*` };

        await message.send(payload);
        await fs.unlink(res.file).catch(() => {});
    } catch (e) {
        await message.send(lang.plugins.yt.failed.format(e.message));
    } finally {
        await status?.delete?.().catch(() => {});
    }
});

Command({
    pattern: 'play ?(.*)',
    desc: lang.plugins.play.desc,
    type: 'download',
}, async (message, match) => {
    const query = match?.trim();
    if (!query) return message.send(lang.plugins.play.usage.format(config.PREFIX));

    const status = await message.send(lang.plugins.play.searching.format(query));
    const search = await yt.search(query, 1).catch(() => null);

    if (!search?.length) {
        await status?.delete?.().catch(() => {});
        return message.send(lang.plugins.play.not_found);
    }

    try {
        const res = await yt.audio(search[0].url, tempDir);
        await message.send({ 
            audio: { url: res.file }, 
            mimetype: 'audio/mpeg', 
            fileName: `${res.title}.mp3` 
        });
        await fs.unlink(res.file).catch(() => {});
    } catch (e) {
        await message.send(lang.plugins.play.failed.format(e.message));
    } finally {
        await status?.delete?.().catch(() => {});
    }
});