import { Command, YouTube, tempDir, config } from '../lib/index.js';
import fs from 'fs';

const yt      = new YouTube();
let ytReady   = false;

const ensureYt = async () => {
    if (ytReady) return true;
    const cookie = config.YT_COOKIE?.trim() || null;
    if (!cookie) return false;
    await yt.init(cookie);
    ytReady = true;
    return true;
};

const fmtDetails = d => [
    `*${d.title}*`,
    `Channel    : ${d.channel}`,
    `Duration   : ${d.duration}`,
    `Views      : ${d.views}`,
    `Likes      : ${d.likes}`,
    `Uploaded   : ${d.uploadDate}`,
    `Subscribers: ${d.subscribers}`,
    d.url,
].join('\n');

const fmtSearch = r =>
    r.map((v, i) => `*${i + 1}.* ${v.title}\n${v.channel} | ${v.duration} | ${v.views}\n${v.url}`)
     .join('\n\n');

Command({
    pattern: 'yt ?(.*)',
    desc:    'YouTube downloader and search',
    type:    'download',
    react:   false,
}, async (message, match) => {
    const args  = match?.trim().split(/\s+/) ?? [];
    const flag  = args[0]?.toLowerCase();
    const query = args.slice(1).join(' ');

    if (!flag || !query) return message.send(
        '.yt -v <link>    video\n' +
        '.yt -a <link>    audio\n' +
        '.yt -s <query>   search\n' +
        '.yt -d <link>    details'
    );

    const ok = await ensureYt();
    if (!ok) return message.send('Add YT_COOKIE first: .var set YT_COOKIE=<cookie>');

    if (flag === '-s') {
        const results = await yt.search(query, 10).catch(() => null);
        return !results?.length
            ? message.send('No results found.')
            : message.send(fmtSearch(results));
    }

    if (flag === '-d') {
        const info = await yt.details(query).catch(e => { message.send(`Failed: ${e.message}`); return null; });
        if (!info) return;
        return info.thumbnail
            ? message.send({ image: { url: info.thumbnail }, caption: fmtDetails(info) })
            : message.send(fmtDetails(info));
    }

    if (flag !== '-v' && flag !== '-a')
        return message.send('Unknown flag. Use -v, -a, -s or -d.');

    const loading = await message.send(flag === '-a' ? 'Downloading audio...' : 'Downloading video...');

    try {
        const result = flag === '-a'
            ? await yt.downAudio(query, tempDir)
            : await yt.downVideo(query, tempDir);

        flag === '-a'
            ? await message.send({ audio: { url: result.file }, mimetype: 'audio/mp4', fileName: `${result.title}.m4a` }, { quoted: message.raw })
            : await message.send({ video: { url: result.file }, caption: `*${result.title}*` }, { quoted: message.raw });

        fs.unlink(result.file, () => {});
    } catch (e) {
        await message.send(`Failed: ${e.message}`);
    } finally {
        loading?.delete?.().catch(() => {});
    }
});
