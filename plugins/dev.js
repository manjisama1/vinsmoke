import { Command, lang, Tracker } from '../lib/index.js';
import util from 'util';

const flatten = (obj, parent = '', res = {}) => {
  for (let key in obj) {
    const prop = parent ? `${parent}.${key}` : key;
    const val = obj[key];
    val && typeof val === 'object' && !(val instanceof Uint8Array) && !Array.isArray(val)
      ? flatten(val, prop, res)
      : (res[prop] = val);
  }
  return res;
};

const format = (val, isBasic) =>
  isBasic
    ? JSON.stringify(val, (k, v) =>
        v instanceof Uint8Array || v?.type === 'Buffer' ? '[Buffer]'
        : typeof v === 'function' ? '[Function]'
        : v, 2)
    : util.inspect(val, {
        depth: null,
        showHidden: true,
        colors: false,
        maxArrayLength: null,
        maxStringLength: null,
        breakLength: 80,
        compact: false
      });

const sendOutput = async (message, data, target, info = {}) => {
  let output = format(data, info.isBasic);

  if (output.split('\n').length > 100) {
    output = util.inspect(flatten(data), {
      compact: true,
      depth: null,
      breakLength: 200,
      colors: false
    });
  }

  const len = output.length;
  if (len > 65000) return message.send(`*Error:* Cannot send ${len} characters.`, {}, target);

  const header = info.tracked ? `${lang.plugins.track.log.format(info.tracked, info.count)} (${info.logMode})\n` : '';
  
  return len > 10000
    ? message.send(`${header}\`\`\`json\n${output}\n\`\`\``, {}, target)
    : (header && await message.send(header, {}, target), message.code(output));
};

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

  const isBasic = mode === 'b' || mode === 'basic';
  const logMode = isBasic ? 'BASIC' : 'ADVANCE';
  const target = message.botJid || message.chat;

  let tracked = 0;
  await message.send(lang.plugins.track.started.format(count));

  const taskId = Tracker.register({ chat: message.chat }, async (msg) => {
    tracked++;
    await sendOutput(message, msg.raw, target, { tracked, count, logMode, isBasic });

    if (tracked >= count) {
      Tracker.unregister(taskId);
      await message.send(lang.plugins.track.completed);
    }
  });
});

Command({
  pattern: 'log ?(.*)',
  desc: 'Evaluate and log context',
  type: 'dev',
  sudo: true
}, async (message, match) => {
  const query = match?.trim();
  const target = message.quoted || message.raw;

  try {
    const result = query ? await eval(query) : target;
    await sendOutput(message, result, message.chat, { isBasic: false });
  } catch (e) {
    await message.send(`*Error:* ${e.message}`);
  }
});