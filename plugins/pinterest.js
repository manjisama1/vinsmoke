import { Command, sticker, cropImage, roundedCrop, circleCrop, tempDir, pinterest, lang, config } from '../lib/index.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', 'config.env') });

const settingsPath = path.join(__dirname, '..', 'db', 'sticker.json');
const safeDelete = file => fs.existsSync(file) && fs.unlinkSync(file);

const activeProcesses = new Map();

const ensureConfig = () => {
    if (!fs.existsSync(settingsPath)) {
        const defaultConfig = { settings: { ratio: '1:1', placement: 1, type: '0' } };
        fs.writeFileSync(settingsPath, JSON.stringify(defaultConfig, null, 2));
    }
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8')).settings;
};

Command({
    pattern: 'pinterest ?(.*)',
    aliases: ['pt'],
    desc: lang.plugins.pinterest.desc,
    type: 'media',
}, async (message, match, manji) => {
    if (!match?.trim()) {
        const prefix = manji.config?.PREFIX || message.config?.PREFIX || config?.PREFIX || '.';
        return message.send(lang.plugins.pinterest.usage.format(prefix));
    }

    const parts = match.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase();

    if (command === 'stop') {
        const processId = message.chat;
        if (activeProcesses.has(processId)) {
            activeProcesses.get(processId).stopped = true;
            return message.send(lang.plugins.pinterest.stopped);
        }
        return message.send(lang.plugins.pinterest.no_active_process);
    }

    const type = command;
    if (!['i', 's'].includes(type)) {
        return message.send(lang.plugins.pinterest.invalid_mode);
    }

    let count, query;
    const secondPart = parts[1];

    if (secondPart && !isNaN(parseInt(secondPart))) {
        count = parseInt(secondPart);
        query = parts.slice(2).join(' ');
    } else {
        query = parts.slice(1).join(' ');
        count = null;
    }

    if (!query) {
        return message.send(lang.plugins.pinterest.no_query.format(manji.config.PREFIX));
    }

    const pinApi = process.env.PIN_API || 'http://localhost:3000/scrape';
    let results = [];
    let usingApi = false;

    try {
        const apiCount = count || (type === 'i' ? 5 : 50);
        const res = await axios.post(pinApi, { input: query, desiredCount: apiCount });
        results = res.data?.data || [];
        usingApi = true;
    } catch {
        // API failed, will use fallback
    }

    if (!results.length) {
        try {
            results = await pinterest(query);
            if (!count) {
                count = type === 'i' ? 5 : results.length;
            }
        } catch {
            return message.send(lang.plugins.pinterest.failed);
        }
    } else {
        count = count || (type === 'i' ? 5 : 50);
    }

    if (!results?.length) return message.send(lang.plugins.pinterest.no_results);

    const finalCount = Math.min(count, results.length);
    const source = usingApi ? 'API' : 'Backup';
    const mediaType = type === 'i' ? 'images' : 'stickers';

    const processId = message.chat;
    const processInfo = { stopped: false, tempFiles: [] };
    activeProcesses.set(processId, processInfo);

    await message.send(lang.plugins.pinterest.searching.format(results.length, source, finalCount, mediaType, query));

    const { ratio, placement, type: shape } = ensureConfig();

    try {
        for (let i = 0; i < results.slice(0, finalCount).length; i++) {
            if (activeProcesses.get(processId)?.stopped) break;

            const url = results[i];
            const tempFiles = [];

            try {
                const imgBuffer = Buffer.from((await axios.get(url, { responseType: 'arraybuffer' })).data);
                const tempFile = path.join(tempDir, `pinterest_${Date.now()}.jpg`);
                fs.writeFileSync(tempFile, imgBuffer);
                tempFiles.push(tempFile);

                if (type === 's') {
                    let processedFile = tempFile;

                    if (ratio !== '0') {
                        processedFile = await cropImage(tempFile, ratio, parseInt(placement) || 1);
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

                    if (activeProcesses.get(processId)?.stopped) break;

                    const stickerBuffer = await sticker(processedFile);
                    if (activeProcesses.get(processId)?.stopped) break;

                    if (stickerBuffer) await message.send({ sticker: stickerBuffer });
                } else {
                    if (activeProcesses.get(processId)?.stopped) break;
                    await message.send(imgBuffer);
                }
            } catch (err) {
                console.error('Pinterest processing error:', err.message);
            } finally {
                tempFiles.forEach(safeDelete);
            }
        }
    } finally {
        activeProcesses.delete(processId);
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

            default:
                valid = true;
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
