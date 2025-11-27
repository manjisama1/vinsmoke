import { Command, sticker, cropImage, roundedCrop, circleCrop, tempDir, pinterest, lang, config } from '../lib/index.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mediaDir = path.join(__dirname, '..', 'media');
const queueFile = path.join(mediaDir, 'pin.json');
const settingsPath = path.join(__dirname, '..', 'db', 'sticker.json');
const activeProcesses = new Map();

const safeDelete = file => fs.existsSync(file) && fs.unlinkSync(file);

const ensureConfig = () => {
    if (!fs.existsSync(settingsPath)) {
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
        fs.writeFileSync(settingsPath, JSON.stringify({ settings: { ratio: '1:1', placement: 1, type: '0' } }, null, 2));
    }
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8')).settings;
};

const ensureMediaDir = () => {
    if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
    if (!fs.existsSync(queueFile)) fs.writeFileSync(queueFile, '');
};

const readQueue = () => {
    ensureMediaDir();
    try {
        const data = fs.readFileSync(queueFile, 'utf8');
        if (!data.trim()) return { type: 's', links: [] };
        const parsed = JSON.parse(data);
        return { 
            type: parsed.type || 's', 
            links: Array.isArray(parsed.links) ? parsed.links : (Array.isArray(parsed) ? parsed : [])
        };
    } catch {
        return { type: 's', links: [] };
    }
};

const writeQueue = data => {
    ensureMediaDir();
    fs.writeFileSync(queueFile, JSON.stringify(data, null, 2));
};

const removeFromQueue = count => {
    const data = readQueue();
    data.links = data.links.slice(count);
    writeQueue(data);
};

Command({
    pattern: 'pinterest ?(.*)',
    aliases: ['pt'],
    desc: lang.plugins.pinterest.desc,
    type: 'media',
}, async (message, match, manji) => {
    if (!match?.trim()) return message.send(lang.plugins.pinterest.usage.format(manji.config.PREFIX));

    const parts = match.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase();

    if (command === 'stop') {
        const processId = message.chat;
        if (activeProcesses.has(processId)) {
            activeProcesses.get(processId).stopped = true;
            return;
        }
        return message.send(lang.plugins.pinterest.no_active);
    }

    if (command === 'add') {
        const input = parts.slice(1).join(' ');
        if (!input) return message.send(lang.plugins.pinterest.add_usage.format(manji.config.PREFIX));

        let type = 's';
        let count = 50;
        let queriesStr = input;

        if (['i', 's'].includes(parts[1]?.toLowerCase())) {
            type = parts[1].toLowerCase();
            const secondPart = parts[2];
            
            if (secondPart && !isNaN(parseInt(secondPart))) {
                count = parseInt(secondPart);
                queriesStr = parts.slice(3).join(' ');
            } else {
                queriesStr = parts.slice(2).join(' ');
            }
        } else if (!isNaN(parseInt(parts[1]))) {
            count = parseInt(parts[1]);
            queriesStr = parts.slice(2).join(' ');
        }

        const queries = queriesStr.split(',').map(q => q.trim()).filter(Boolean);
        if (!queries.length) return message.send(lang.plugins.pinterest.add_usage.format(manji.config.PREFIX));

        const pinApi = manji.config.PIN_API || config.PIN_API || 'http://localhost:3000/scrape';
        const current = readQueue();
        const queueData = { type, links: Array.isArray(current.links) ? [...current.links] : [] };

        for (const query of queries) {
            try {
                let links = [];
                let source = '';

                try {
                    const res = await axios.post(pinApi, { input: query, desiredCount: count });
                    links = res.data?.data || [];
                    source = 'API';
                } catch {}

                if (!links.length) {
                    if (query.startsWith('http')) {
                        await message.send(lang.plugins.pinterest.backup_no_link);
                        continue;
                    }
                    try {
                        links = await pinterest(query);
                        links = links.slice(0, count);
                        source = 'Backup';
                    } catch {}
                }

                if (links.length) {
                    await message.send(lang.plugins.pinterest.add_fetching.format(source, query, count));
                    queueData.links.push(...links);
                    await message.send(lang.plugins.pinterest.add_done.format(query, links.length));
                } else {
                    await message.send(lang.plugins.pinterest.add_failed.format(query));
                }
            } catch (err) {
                await message.send(lang.plugins.pinterest.add_error.format(query, err.message));
            }
        }

        fs.writeFileSync(queueFile, JSON.stringify(queueData, null, 2));
        return;
    }

    if (command === 'go') {
        const queueData = readQueue();
        if (!queueData.links.length) return message.send(lang.plugins.pinterest.queue_empty);

        const processId = message.chat;
        activeProcesses.set(processId, { stopped: false });

        const type = queueData.type;
        const mediaType = type === 'i' ? 'images' : 'stickers';
        await message.send(lang.plugins.pinterest.queue_start.format(queueData.links.length, mediaType));

        const { ratio, placement, type: shape } = ensureConfig();
        let sent = 0;
        let stopped = false;

        try {
            for (let i = 0; i < queueData.links.length; i++) {
                const process = activeProcesses.get(processId);
                if (!process || process.stopped) {
                    stopped = true;
                    break;
                }

                const url = queueData.links[i];
                const tempFiles = [];

                try {
                    const imgBuffer = Buffer.from((await axios.get(url, { responseType: 'arraybuffer' })).data);
                    const tempFile = path.join(tempDir, `pin_${Date.now()}_${i}.jpg`);
                    fs.writeFileSync(tempFile, imgBuffer);
                    tempFiles.push(tempFile);

                    if (type === 's') {
                        let processedFile = tempFile;

                        if (ratio !== '0') {
                            processedFile = await cropImage(tempFile, { ratio });
                            tempFiles.push(processedFile);
                        }

                        if (shape && shape !== '0') {
                            let shapedFile;
                            if (shape === 'circle') shapedFile = await circleCrop(processedFile);
                            else if (shape === 'rounded') shapedFile = await roundedCrop(processedFile, 80);

                            if (shapedFile) {
                                tempFiles.push(shapedFile);
                                processedFile = shapedFile;
                            }
                        }

                        const currentProcess = activeProcesses.get(processId);
                        if (!currentProcess || currentProcess.stopped) {
                            stopped = true;
                            break;
                        }

                        const stickerBuffer = await sticker(processedFile);
                        
                        const finalProcess = activeProcesses.get(processId);
                        if (!finalProcess || finalProcess.stopped) {
                            stopped = true;
                            break;
                        }

                        if (stickerBuffer) {
                            await message.send({ sticker: stickerBuffer });
                            sent++;
                            removeFromQueue(1);
                        }
                    } else {
                        const currentProcess = activeProcesses.get(processId);
                        if (!currentProcess || currentProcess.stopped) {
                            stopped = true;
                            break;
                        }
                        
                        await message.send(imgBuffer);
                        sent++;
                        removeFromQueue(1);
                    }
                } catch (err) {
                    console.error('Pinterest queue error:', err.message);
                } finally {
                    tempFiles.forEach(safeDelete);
                }
            }
        } finally {
            activeProcesses.delete(processId);
            if (stopped) {
                await message.send(lang.plugins.pinterest.stopped.format(sent, queueData.links.length));
            } else {
                await message.send(lang.plugins.pinterest.queue_done.format(sent));
            }
        }
        return;
    }

    const type = command;
    if (!['i', 's'].includes(type)) return message.send(lang.plugins.pinterest.invalid_mode);

    let count, query;
    const secondPart = parts[1];

    if (secondPart && !isNaN(parseInt(secondPart))) {
        count = parseInt(secondPart);
        query = parts.slice(2).join(' ');
    } else {
        query = parts.slice(1).join(' ');
        count = null;
    }

    if (!query) return message.send(lang.plugins.pinterest.no_query.format(manji.config.PREFIX));

    const pinApi = manji.config.PIN_API || config.PIN_API || 'http://localhost:3000/scrape';
    let results = [];
    let source = '';

    const apiCount = count || (type === 'i' ? 5 : 50);

    try {
        const res = await axios.post(pinApi, { input: query, desiredCount: apiCount });
        results = res.data?.data || [];
        source = 'API';
    } catch {}

    if (!results.length) {
        if (query.startsWith('http')) {
            return message.send(lang.plugins.pinterest.backup_no_link);
        }
        try {
            results = await pinterest(query);
            source = 'Backup';
        } catch {
            return message.send(lang.plugins.pinterest.failed);
        }
    }

    if (!results?.length) return message.send(lang.plugins.pinterest.no_results);

    count = count || (type === 'i' ? 5 : results.length);
    const finalCount = Math.min(count, results.length);
    const mediaType = type === 'i' ? 'images' : 'stickers';

    const processId = message.chat;
    activeProcesses.set(processId, { stopped: false });

    await message.send(lang.plugins.pinterest.searching.format(results.length, source, finalCount, mediaType, query));

    const { ratio, placement, type: shape } = ensureConfig();

    let sent = 0;
    let stopped = false;

    try {
        for (let i = 0; i < finalCount; i++) {
            const process = activeProcesses.get(processId);
            if (!process || process.stopped) {
                stopped = true;
                break;
            }

            const url = results[i];
            const tempFiles = [];

            try {
                const imgBuffer = Buffer.from((await axios.get(url, { responseType: 'arraybuffer' })).data);
                const tempFile = path.join(tempDir, `pinterest_${Date.now()}_${i}.jpg`);
                fs.writeFileSync(tempFile, imgBuffer);
                tempFiles.push(tempFile);

                if (type === 's') {
                    let processedFile = tempFile;

                    if (ratio !== '0') {
                        processedFile = await cropImage(tempFile, { ratio });
                        tempFiles.push(processedFile);
                    }

                    if (shape && shape !== '0') {
                        let shapedFile;
                        if (shape === 'circle') {
                            shapedFile = await circleCrop(processedFile);
                        } else if (shape === 'rounded') {
                            shapedFile = await roundedCrop(processedFile, 80);
                        }

                        if (shapedFile) {
                            tempFiles.push(shapedFile);
                            processedFile = shapedFile;
                        }
                    }

                    const currentProcess = activeProcesses.get(processId);
                    if (!currentProcess || currentProcess.stopped) {
                        stopped = true;
                        break;
                    }

                    const stickerBuffer = await sticker(processedFile);
                    
                    const finalProcess = activeProcesses.get(processId);
                    if (!finalProcess || finalProcess.stopped) {
                        stopped = true;
                        break;
                    }

                    if (stickerBuffer) {
                        await message.send({ sticker: stickerBuffer });
                        sent++;
                    }
                } else {
                    const currentProcess = activeProcesses.get(processId);
                    if (!currentProcess || currentProcess.stopped) {
                        stopped = true;
                        break;
                    }
                    
                    await message.send(imgBuffer);
                    sent++;
                }
            } catch (err) {
                console.error('Pinterest error:', err.message);
            } finally {
                tempFiles.forEach(safeDelete);
            }
        }
    } finally {
        activeProcesses.delete(processId);
        if (stopped) {
            await message.send(lang.plugins.pinterest.stopped.format(sent, finalCount));
        }
    }
});

Command({
    pattern: 'ssize ?(.*)',
    desc: lang.plugins.ssize.desc,
    type: 'sticker',
}, async (message, match) => {
    const settings = ensureConfig();
    const keys = Object.keys(settings);

    if (!match?.trim()) {
        const list = keys.map((k, i) => `${i + 1}. ${k[0].toUpperCase() + k.slice(1)}: ${settings[k]}`).join('\n');
        return message.send(lang.plugins.ssize.current.format(list));
    }

    const updates = match.split(',').map(s => s.trim()).filter(Boolean);
    const success = [];
    const failed = [];

    for (const upd of updates) {
        const [num, val] = upd.split('=').map(x => x.trim());
        const idx = parseInt(num) - 1;
        const key = keys[idx];

        if (!val || !key) {
            failed.push(lang.plugins.ssize.invalid_index.format(upd));
            continue;
        }

        let valid = true;
        let reason = '';

        switch (key) {
            case 'ratio':
                valid = /^(\d+:\d+)$/.test(val) || val === '0';
                if (!valid) reason = lang.plugins.ssize.invalid_ratio;
                break;
            case 'placement':
                valid = ['0', '1', '2'].includes(val);
                if (!valid) reason = lang.plugins.ssize.invalid_placement;
                break;
            case 'type':
                valid = ['0', 'circle', 'rounded'].includes(val.toLowerCase());
                if (!valid) reason = lang.plugins.ssize.invalid_type;
                break;
        }

        if (valid) {
            settings[key] = val;
            success.push(`${key}: ${val}`);
        } else {
            failed.push(`${key}: ${val} → ${reason}`);
        }
    }

    fs.writeFileSync(settingsPath, JSON.stringify({ settings }, null, 2));

    let msg = '';
    if (success.length) msg += lang.plugins.ssize.updated.format(success.join('\n')) + '\n';
    if (failed.length) msg += lang.plugins.ssize.failed.format(failed.join('\n'));
    await message.send(msg.trim() || lang.plugins.ssize.no_updates);
});
