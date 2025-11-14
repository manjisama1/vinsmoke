import { Command, downLoad, audioEffect, lang } from '../lib/index.js';
import fs from 'fs';

const hasAudio = (msg) => msg.quoted?.audio || msg.quoted?.voice || msg.quoted?.document?.audio;

Command({
    pattern: 'bass ?(.*)',
    desc: lang.plugins.bass.desc,
    type: 'au-effect'
}, async (message, match) => {
    if (!hasAudio(message)) return await message.send(lang.plugins.bass.reply_required);
    const input = await downLoad(message.raw);
    if (!input) return;
    const audio = await audioEffect(input, 'bass', { asVoiceNote: match?.trim().toLowerCase() === 'vn' });
    fs.unlinkSync(input);
    if (audio) await message.send(match?.trim().toLowerCase() === 'vn' ? { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true } : { audio, mimetype: 'audio/mpeg', fileName: 'bass.mp3' });
});

Command({
    pattern: 'deep ?(.*)',
    desc: lang.plugins.deep.desc,
    type: 'au-effect'
}, async (message, match) => {
    if (!hasAudio(message)) return await message.send(lang.plugins.deep.reply_required);
    const input = await downLoad(message.raw);
    if (!input) return;
    const audio = await audioEffect(input, 'deep', { asVoiceNote: match?.trim().toLowerCase() === 'vn' });
    fs.unlinkSync(input);
    if (audio) await message.send(match?.trim().toLowerCase() === 'vn' ? { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true } : { audio, mimetype: 'audio/mpeg', fileName: 'deep.mp3' });
});

Command({
    pattern: 'slow ?(.*)',
    desc: lang.plugins.slow.desc,
    type: 'au-effect'
}, async (message, match) => {
    if (!hasAudio(message)) return await message.send(lang.plugins.slow.reply_required);
    const input = await downLoad(message.raw);
    if (!input) return;
    const audio = await audioEffect(input, 'slow', { asVoiceNote: match?.trim().toLowerCase() === 'vn' });
    fs.unlinkSync(input);
    if (audio) await message.send(match?.trim().toLowerCase() === 'vn' ? { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true } : { audio, mimetype: 'audio/mpeg', fileName: 'slow.mp3' });
});

Command({
    pattern: 'fast ?(.*)',
    desc: lang.plugins.fast.desc,
    type: 'au-effect'
}, async (message, match) => {
    if (!hasAudio(message)) return await message.send(lang.plugins.fast.reply_required);
    const input = await downLoad(message.raw);
    if (!input) return;
    const audio = await audioEffect(input, 'fast', { asVoiceNote: match?.trim().toLowerCase() === 'vn' });
    fs.unlinkSync(input);
    if (audio) await message.send(match?.trim().toLowerCase() === 'vn' ? { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true } : { audio, mimetype: 'audio/mpeg', fileName: 'fast.mp3' });
});

Command({
    pattern: 'reverse ?(.*)',
    desc: lang.plugins.reverse.desc,
    type: 'au-effect'
}, async (message, match) => {
    if (!hasAudio(message)) return await message.send(lang.plugins.reverse.reply_required);
    const input = await downLoad(message.raw);
    if (!input) return;
    const audio = await audioEffect(input, 'reverse', { asVoiceNote: match?.trim().toLowerCase() === 'vn' });
    fs.unlinkSync(input);
    if (audio) await message.send(match?.trim().toLowerCase() === 'vn' ? { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true } : { audio, mimetype: 'audio/mpeg', fileName: 'reverse.mp3' });
});

Command({
    pattern: 'chipmunk ?(.*)',
    desc: lang.plugins.chipmunk.desc,
    type: 'au-effect'
}, async (message, match) => {
    if (!hasAudio(message)) return await message.send(lang.plugins.chipmunk.reply_required);
    const input = await downLoad(message.raw);
    if (!input) return;
    const audio = await audioEffect(input, 'chipmunk', { asVoiceNote: match?.trim().toLowerCase() === 'vn' });
    fs.unlinkSync(input);
    if (audio) await message.send(match?.trim().toLowerCase() === 'vn' ? { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true } : { audio, mimetype: 'audio/mpeg', fileName: 'chipmunk.mp3' });
});

Command({
    pattern: 'echo ?(.*)',
    desc: lang.plugins.echo.desc,
    type: 'au-effect'
}, async (message, match) => {
    if (!hasAudio(message)) return await message.send(lang.plugins.echo.reply_required);
    const input = await downLoad(message.raw);
    if (!input) return;
    const audio = await audioEffect(input, 'echo', { asVoiceNote: match?.trim().toLowerCase() === 'vn' });
    fs.unlinkSync(input);
    if (audio) await message.send(match?.trim().toLowerCase() === 'vn' ? { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true } : { audio, mimetype: 'audio/mpeg', fileName: 'echo.mp3' });
});

Command({
    pattern: 'robot ?(.*)',
    desc: lang.plugins.robot.desc,
    type: 'au-effect'
}, async (message, match) => {
    if (!hasAudio(message)) return await message.send(lang.plugins.robot.reply_required);
    const input = await downLoad(message.raw);
    if (!input) return;
    const audio = await audioEffect(input, 'robot', { asVoiceNote: match?.trim().toLowerCase() === 'vn' });
    fs.unlinkSync(input);
    if (audio) await message.send(match?.trim().toLowerCase() === 'vn' ? { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true } : { audio, mimetype: 'audio/mpeg', fileName: 'robot.mp3' });
});

Command({
    pattern: 'nightcore ?(.*)',
    desc: lang.plugins.nightcore.desc,
    type: 'au-effect'
}, async (message, match) => {
    if (!hasAudio(message)) return await message.send(lang.plugins.nightcore.reply_required);
    const input = await downLoad(message.raw);
    if (!input) return;
    const audio = await audioEffect(input, 'nightcore', { asVoiceNote: match?.trim().toLowerCase() === 'vn' });
    fs.unlinkSync(input);
    if (audio) await message.send(match?.trim().toLowerCase() === 'vn' ? { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true } : { audio, mimetype: 'audio/mpeg', fileName: 'nightcore.mp3' });
});

Command({
    pattern: 'earrape ?(.*)',
    desc: lang.plugins.earrape.desc,
    type: 'au-effect'
}, async (message, match) => {
    if (!hasAudio(message)) return await message.send(lang.plugins.earrape.reply_required);
    const input = await downLoad(message.raw);
    if (!input) return;
    const audio = await audioEffect(input, 'earrape', { asVoiceNote: match?.trim().toLowerCase() === 'vn' });
    fs.unlinkSync(input);
    if (audio) await message.send(match?.trim().toLowerCase() === 'vn' ? { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true } : { audio, mimetype: 'audio/mpeg', fileName: 'earrape.mp3' });
});

Command({
    pattern: 'tremolo ?(.*)',
    desc: lang.plugins.tremolo.desc,
    type: 'au-effect'
}, async (message, match) => {
    if (!hasAudio(message)) return await message.send(lang.plugins.tremolo.reply_required);
    const input = await downLoad(message.raw);
    if (!input) return;
    const audio = await audioEffect(input, 'tremolo', { asVoiceNote: match?.trim().toLowerCase() === 'vn' });
    fs.unlinkSync(input);
    if (audio) await message.send(match?.trim().toLowerCase() === 'vn' ? { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true } : { audio, mimetype: 'audio/mpeg', fileName: 'tremolo.mp3' });
});

Command({
    pattern: 'underwater ?(.*)',
    desc: lang.plugins.underwater.desc,
    type: 'au-effect'
}, async (message, match) => {
    if (!hasAudio(message)) return await message.send(lang.plugins.underwater.reply_required);
    const input = await downLoad(message.raw);
    if (!input) return;
    const audio = await audioEffect(input, 'underwater', { asVoiceNote: match?.trim().toLowerCase() === 'vn' });
    fs.unlinkSync(input);
    if (audio) await message.send(match?.trim().toLowerCase() === 'vn' ? { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true } : { audio, mimetype: 'audio/mpeg', fileName: 'underwater.mp3' });
});

Command({
    pattern: 'tovn',
    aliases: ['vn'],
    desc: lang.plugins.tovn.desc,
    type: 'media'
}, async (message) => {
    const hasAudio = message.quoted?.audio || message.quoted?.document?.audio;
    if (!hasAudio || message.quoted?.voice) return await message.send(lang.plugins.tovn.reply_required);
    const audio = await downLoad(message.raw);
    if (!audio) return;
    await message.voicenote(audio);
    fs.unlinkSync(audio);
});
