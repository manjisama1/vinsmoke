import { Command, lang, config, calculate, Translate, downLoad  } from '../lib/index.js';
import fs from 'fs';
const tr = new Translate();

const LANG_MAP = {
    js: 'javascript', ts: 'typescript', py: 'python', sh: 'bash', rb: 'ruby',
    rs: 'rust', kt: 'kotlin', cs: 'csharp', cpp: 'cpp', cc: 'cpp', c: 'c',
    go: 'go', java: 'java', php: 'php', swift: 'swift', lua: 'lua', r: 'r',
    html: 'html', css: 'css', scss: 'scss', sass: 'sass', json: 'json',
    sql: 'sql', yaml: 'yaml', yml: 'yaml', toml: 'toml', xml: 'xml',
    md: 'markdown', zsh: 'bash', fish: 'bash', ps1: 'powershell',
    dart: 'dart', scala: 'scala', ex: 'elixir', exs: 'elixir', erl: 'erlang',
    hs: 'haskell', clj: 'clojure', groovy: 'groovy', pl: 'perl', m: 'matlab',
    jsx: 'javascript', tsx: 'typescript', mjs: 'javascript', cjs: 'javascript',
    vue: 'html', svelte: 'html', tf: 'hcl', dockerfile: 'dockerfile',
};

const norm  = l => l ? (LANG_MAP[l.toLowerCase()] ?? l.toLowerCase()) : null;
const fence = t => t?.match(/^```(\w+)?\n?([\s\S]*?)```$/s);
const angle = t => t?.match(/^<(\w+)>\s*([\s\S]+)$/s);

const parseOpts = str => {
    const o = { origin: 'UNKNOWN', forward: false };
    const t = str.split(/\s+/);
    for (let i = 0; i < t.length; i++) {
        if      (t[i] === '-o')  o.origin  = (t[++i] ?? 'META_AI').toUpperCase();
        else if (t[i] === '-f')  o.forward = true;
        else if (t[i] === '-nf') o.forward = false;
        else if (t[i] === '-s')  o.score   = parseInt(t[++i] ?? '1');
        else if (t[i] === '-b')  o.botJid  = t[++i];
        else if (t[i] === '-i')  o.intro   = t[++i];
        else if (t[i] === '-ot') o.outro   = t[++i];
    }
    return o;
};

const stripOpts = s => s.replace(/-o\s+\S+|-f\b|-nf\b|-s\s+\S+|-b\s+\S+|-i\s+\S+|-ot\s+\S+/g, '').trim();

Command({
    pattern: 'calculate ?(.*)',
    aliases: ['calc', 'c'],
    desc: lang.plugins.calculate.desc,
    type: 'tools'
}, async (message, match) => {
    if (!match) return message.send(lang.plugins.calculate.usage.format(config.PREFIX));
    
    const expr = match.trim();
    const result = calculate(expr);
    
    await message.send(lang.plugins.calculate.result.format(expr, result));
});

Command({
    pattern: 'discount ?(.*)',
    aliases: ['dis'],
    desc: lang.plugins.discount.desc,
    type: 'tools'
}, async (message, match) => {
    if (!match) return message.send(lang.plugins.discount.usage.format(config.PREFIX));
    
    const args = match.trim().split(' ');
    const price = parseFloat(args[0]);
    const discount = parseFloat(args[1]);
    
    if (isNaN(price) || isNaN(discount)) return message.send(lang.plugins.discount.usage);
    
    const discountAmount = (price * discount) / 100;
    const finalPrice = price - discountAmount;
    
    await message.send(lang.plugins.discount.result.format(price, discount, discountAmount, finalPrice));
});

Command({
    pattern: 'percentage ?(.*)',
    aliases: ['per'],
    desc: lang.plugins.percentage.desc,
    type: 'tools'
}, async (message, match) => {
    if (!match) return message.send(lang.plugins.percentage.usage.format(config.PREFIX));
    
    const args = match.trim().split(' ');
    const total = parseFloat(args[0]);
    const part = parseFloat(args[1]);
    
    if (isNaN(total) || isNaN(part)) return message.send(lang.plugins.percentage.usage.format(config.PREFIX));
    
    const percentage = (part / total) * 100;
    
    await message.send(lang.plugins.percentage.result.format(part, total, percentage.toFixed(2)));
});

Command({
    pattern: 'translate ?(.*)',
    aliases: ['trt'],
    desc: lang.plugins.translate.desc,
    type: 'tools'
}, async (message, match) => {
    let from = 'auto', to = 'en', targetText = message.quoted?.text || match;

    if (!targetText) return await message.reply(lang.plugins.translate.no_text);

    const args = match?.split(' ');
    const firstArg = args?.[0];

    if (match) {
        firstArg?.includes('-') 
            ? ([from, to] = firstArg.split('-'), targetText = args.slice(1).join(' ') || message.quoted?.text || targetText)
            : firstArg?.length === 2 
                ? (to = firstArg, targetText = args.slice(1).join(' ') || message.quoted?.text || targetText) 
                : null;
    }

    if (!targetText || (targetText === firstArg && firstArg.includes('-'))) 
        return await message.reply(lang.plugins.translate.no_target);

    const result = await tr.exec(targetText, { from, to });
    await message.reply(result);
});

Command({
    pattern: 'code ?(.*)',
    desc: lang.plugins.code.desc,
    type: 'tools',
}, async (message, match) => {
    const raw   = match?.trim() || '';
    const opts  = parseOpts(raw);
    const input = stripOpts(raw);
    const q     = message.quoted;
    const qText = q?.text?.trim();

    if (q?.document || q?.hasMedia) {
        const fp = await downLoad(message.raw, 'path') || await downLoad(message.quoted, 'path');
        if (fp) {
            const ext  = fp.split('.').pop().toLowerCase();
            let   langCode = ext === 'txt' ? norm(input) : (LANG_MAP[ext] ?? norm(input));
            if (!langCode) {
                fs.unlinkSync(fp);
                return message.send(ext === 'txt' ? lang.plugins.code.txt_lang : lang.plugins.code.unknown_ext.format(ext));
            }
            const code = fs.readFileSync(fp, 'utf8');
            fs.unlinkSync(fp);
            return message.code(code, { lang: langCode, ...opts });
        }
    }

    if (qText) {
        const fm = fence(qText);
        if (fm) {
            const langCode = fm[1] ? norm(fm[1]) : norm(input);
            if (!langCode) return message.send(lang.plugins.code.add_lang);
            return message.code(fm[2].trim(), { lang: langCode, ...opts });
        }
        const parts   = input.split(/\s+/);
        const mayLang = norm(parts[0]);
        const rest    = parts.slice(1).join(' ').trim();
        if (rest)    return message.code(rest, { lang: mayLang ?? 'javascript', ...opts });
        if (mayLang) return message.code(qText, { lang: mayLang, ...opts });
        return message.send(lang.plugins.code.add_lang);
    }

    if (!input) return message.send(lang.plugins.code.usage);

    const fm = fence(input);
    if (fm) {
        const langCode = fm[1] ? norm(fm[1]) : null;
        if (!langCode) return message.send(lang.plugins.code.fence_lang);
        return message.code(fm[2].trim(), { lang: langCode, ...opts });
    }

    const am = angle(input);
    if (am) return message.code(am[2].trim(), { lang: norm(am[1]) ?? 'javascript', ...opts });

    const parts   = input.split(/\s+/);
    const mayLang = norm(parts[0]);
    const rest    = parts.slice(1).join(' ').trim();

    if (rest && mayLang) return message.code(rest, { lang: mayLang, ...opts });
    return message.code(input, { lang: 'javascript', ...opts });
});

Command({
    pattern: 'table ?(.*)',
    desc: lang.plugins.table.desc,
    type: 'tools',
}, async (message, match) => {
    const raw   = match?.trim() || message.quoted?.text?.trim() || '';
    const opts  = parseOpts(raw);
    const input = stripOpts(raw);

    if (!input) return message.send(lang.plugins.table.usage);

    const segments = input.split(/\n?---\n?/).map(b => b.trim()).filter(Boolean);
    const blocks   = segments.map(block => {
        const isText = block.startsWith('text:') || !block.includes('|');
        if (isText) return { type: 'text', text: block.replace(/^text:\s*/i, '').trim() };
        const rows = block.split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split('|').map(c => c.trim()));
        return { type: 'table', rows };
    });

    if (!blocks.length) return message.send(lang.plugins.table.no_content);

    await message.table(blocks, opts);
});