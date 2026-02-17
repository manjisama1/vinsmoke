import { Command, sticker, cropImage, roundedCrop, circleCrop, tempDir, pinterest, lang, config, downLoad } from '../lib/index.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const media = path.join(root, '..', 'media');
const qf = path.join(media, 'pin.json');
const db = path.join(root, '..', 'lib', 'db', 'sticker.json');
const active = new Map();

const del = f =>
  fs.existsSync(f) && fs.unlinkSync(f);

const load = () => {
  if (!fs.existsSync(db)) {
    fs.mkdirSync(path.dirname(db), { recursive: true });
    fs.writeFileSync(db, JSON.stringify({ settings: { ratio: '1:1', placement: 1, type: '0' } }));
  }
  return JSON.parse(fs.readFileSync(db, 'utf8')).settings;
};

const init = () => {
  if (!fs.existsSync(media)) fs.mkdirSync(media, { recursive: true });
  if (!fs.existsSync(qf)) fs.writeFileSync(qf, '');
};

const list = () => {
  init();
  try {
    const d = fs.readFileSync(qf, 'utf8');
    const p = d.trim() ? JSON.parse(d) : { type: 's', links: [] };
    return ({
      type: p.type || 's',
      links: Array.isArray(p.links) ? p.links : (Array.isArray(p) ? p : [])
    });
  } catch { return ({ type: 's', links: [] }); }
};

const save = d => {
  init();
  fs.writeFileSync(qf, JSON.stringify(d, null, 2));
};

const pop = n => {
  const d = list();
  d.links = d.links.slice(n);
  save(d);
};

const make = async (url, type, ratio, shape, i) => {
  const temps = [];
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    const buf = res.data;
    const f = path.join(tempDir, `pin_${Date.now()}_${i}.jpg`);
    fs.writeFileSync(f, buf);
    temps.push(f);
    if (type !== 's') return ({ buffer: buf, temps });
    let cur = ratio !== '0' ? await cropImage(f, { ratio }) : f;
    if (cur !== f) temps.push(cur);
    cur = shape === 'circle' ? await circleCrop(cur)
      : shape === 'rounded' ? await roundedCrop(cur, 80)
      : cur;
    if (!temps.includes(cur)) temps.push(cur);
    const stic = await sticker(cur);
    return ({ sticker: stic, temps });
  } catch (e) { return ({ error: e, temps }); }
};

Command({
    pattern: 'pinterest ?(.*)',
    aliases: ['pt'],
    desc: lang.plugins.pinterest.desc,
    type: 'media'
  },
  async (message, match) => {
    const args = (match || '').trim().split(/\s+/)
    const cmd = args[0]?.toLowerCase()
    const pid = message.chat
    const isDoc = message.quoted?.document?.txt
    if (!match && isDoc) {
      const path = await downLoad(message.raw, 'path')
      if (!path) return message.send(lang.plugins.pinterest.failed)
      const links = fs.readFileSync(path, 'utf-8')
        .match(/https?:\/\/[^\s]+/g) || []
      if (!links.length) {
        del(path)
        return message.send(lang.plugins.pinterest.no_links)
      }
      active.set(pid, { stopped: false })
      const { ratio, type: shape } = load()
      let sent = 0
      try {
        for (const url of links) {
          if (active.get(pid)?.stopped) break
          const { sticker: stic, buffer: buf, temps } = await make(url, 's', ratio, shape, sent)
          stic ? await message.send({ sticker: stic })
            : buf ? await message.send(buf)
            : null
          if (stic || buf) sent++
          temps?.forEach(del)
        }
      } finally {
        del(path)
        const stop = active.get(pid)?.stopped
        active.delete(pid)
        return stop ? message.send(lang.plugins.pinterest.stopped.format(sent, links.length))
          : message.send(lang.plugins.pinterest.file_done.format(sent))
      }
    }
    if (!match) return message.send(lang.plugins.pinterest.usage.format(config.PREFIX))
    if (cmd === 'stop') return active.has(pid)
      ? (active.get(pid).stopped = true)
      : message.send(lang.plugins.pinterest.no_active)
    if (cmd === 'add') {
      const input = args.slice(1).join(' ')
      if (!input) return message.send(lang.plugins.pinterest.add_usage.format(config.PREFIX))
      const type = ['i', 's'].includes(args[1]) ? args[1] : 's'
      const count = !isNaN(args[type === args[1] ? 2 : 1]) ? parseInt(args[type === args[1] ? 2 : 1]) : 50
      const queries = input.split(',').map(q => q.trim()).filter(Boolean)
      const q = list()
      q.type = type
      for (const query of queries) {
        const res = await axios.post(config.PIN_API || 'http://localhost:3000/scrape', { input: query, desiredCount: count }).catch(() => null)
        const links = (res?.data?.data || (!query.startsWith('http') ? await pinterest(query) : [])).slice(0, count)
        q.links.push(...links)
      }
      save(q)
      return message.send(lang.plugins.pinterest.add_done.format(q.links.length))
    }
    if (cmd === 'go') {
      const q = list()
      if (!q.links.length) return message.send(lang.plugins.pinterest.queue_empty)
      active.set(pid, { stopped: false })
      const { ratio, type: shape } = load()
      let sent = 0
      try {
        for (const url of q.links) {
          if (active.get(pid)?.stopped) break
          const { sticker: stic, buffer: buf, temps } = await make(url, q.type, ratio, shape, sent)
          stic ? await message.send({ sticker: stic })
            : buf ? await message.send(buf)
            : null
          if (stic || buf) { sent++; pop(1) }
          temps?.forEach(del)
        }
      } finally {
        const stop = active.get(pid)?.stopped
        active.delete(pid)
        return stop ? message.send(lang.plugins.pinterest.stopped.format(sent, q.links.length))
          : message.send(lang.plugins.pinterest.queue_done.format(sent))
      }
    }
    const mode = ['i', 's'].includes(cmd) ? cmd : null
    if (!mode) return message.send(lang.plugins.pinterest.invalid_mode)
    const count = !isNaN(args[1]) ? parseInt(args[1]) : (mode === 'i' ? 5 : 50)
    const query = args.slice(!isNaN(args[1]) ? 2 : 1).join(' ')
    if (!query) return message.send(lang.plugins.pinterest.no_query)
    active.set(pid, { stopped: false })
    const res = await axios.post(config.PIN_API || 'http://localhost:3000/scrape', { input: query, desiredCount: count }).catch(() => null)
    const links = (res?.data?.data || (!query.startsWith('http') ? await pinterest(query) : [])).slice(0, count)
    if (!links.length) return message.send(lang.plugins.pinterest.no_results)
    const { ratio, type: shape } = load()
    let sent = 0
    try {
      for (const url of links) {
        if (active.get(pid)?.stopped) break
        const { sticker: stic, buffer: buf, temps } = await make(url, mode, ratio, shape, sent)
        stic ? await message.send({ sticker: stic })
          : buf ? await message.send(buf)
          : null
        if (stic || buf) sent++
        temps?.forEach(del)
      }
    } finally {
      const stop = active.get(pid)?.stopped
      active.delete(pid)
      if (stop) await message.send(lang.plugins.pinterest.stopped.format(sent, links.length))
    }
  }
)

Command({
    pattern: 'ssize ?(.*)',
    desc: lang.plugins.ssize.desc,
    type: 'sticker'
  },
  async (message, match) => {
    const s = load()
    const ks = Object.keys(s)
    if (!match?.trim()) {
      const l = ks
        .map((k, i) => `${i + 1}. ${k[0].toUpperCase() + k.slice(1)}: ${s[k]}`)
        .join('\n')
      return message.send(lang.plugins.ssize.current.format(l))
    }
    const ok = [], bad = []
    match.split(',')
      .map(x => x.trim())
      .filter(Boolean)
      .forEach(u => {
        const [n, v] = u.split('=').map(x => x.trim())
        const k = ks[parseInt(n) - 1]
        if (!v || !k) return bad.push(lang.plugins.ssize.invalid_index.format(u))
        const valid = k === 'ratio' ? (/^(\d+:\d+)$/.test(v) || v === '0')
          : k === 'placement' ? ['0', '1', '2'].includes(v)
          : k === 'type' ? ['0', 'circle', 'rounded'].includes(v.toLowerCase())
          : false
        if (!valid) return bad.push(`${k}: ${v} → ${lang.plugins.ssize[`invalid_${k}`]}`)
        s[k] = v
        ok.push(`${k}: ${v}`)
      })
    fs.writeFileSync(db, JSON.stringify({ settings: s }))
    const res = [
      ok.length ? lang.plugins.ssize.updated.format(ok.join('\n')) : '',
      bad.length ? lang.plugins.ssize.failed.format(bad.join('\n')) : ''
    ]
      .filter(Boolean)
      .join('\n')
    return message.send(res.trim() || lang.plugins.ssize.no_updates)
  }
)