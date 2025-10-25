import { Command, lang, config } from '../lib/index.js';
import moment from 'moment-timezone';


Command({
    pattern: 'jid ?(.*)',
    desc: lang.plugins.jid.desc,
    type: 'tools',
}, async (message, match, manji) => {
    const jids = await manji.getUserJid(message, match);
    if (jids == ""){
        return message.send(message.chat);
    } else {
        return message.send(Array.isArray(jids) ? jids.join('\n') : jids);
    }
});

Command({
    pattern: 'num ?(.*)',
    desc: 'Get number with +',
    type: 'tools',
}, async (message, match, manji) => {
    const jids = await manji.getUserJid(message, match);
    const numbers = Array.isArray(jids)
        ? jids.map(j => '+' + j.split('@')[0])
        : ['+' + jids.split('@')[0]];
    return message.send(numbers.join('\n'));
});

Command({
    pattern: 'linkjid ?(.*)',
    desc: 'Get the jid of a group from invite link',
    type: 'tools',
}, async (message, match, manji) => {
    const response = await manji.gInfoCode(match || message.quoted.text);
    const info = response[0];
    const jid = info.id;
    await message.send(jid);
});


Command({
    pattern: "onwa ?(.*)",
    desc: "Check WhatsApp numbers",
    type: "tools",
}, async (msg, match, manji) => {
    if (!match) return msg.send(lang.plugins.onwa.usage.format(config.PREFIX));
    const input = match.trim();
    if ((input.match(/x/g) || []).length > 3) return msg.send(lang.plugins.onwa.maxXAllowed);

    const gen = (t) => {
        if (!t.includes("x")) return [t];
        const res = [];
        const f = (s, i = 0) => i === s.length ? res.push(s) : s[i] === "x" ? [...Array(10).keys()].forEach(d => f(s.slice(0, i) + d + s.slice(i + 1), i + 1)) : f(s, i + 1);
        f(t); return res;
    };
    const numbers = gen(input);
    if (numbers.length > 999) return msg.send(lang.plugins.onwa.tooManyNumbers);

    const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
    const tz = config.TIMEZONE || "Asia/Kolkata";
    const fmt = d => moment(d).tz(tz).format("hh:mm:ssa  |  DD-MM-YYYY");

    const cats = { pfpbio: [], nopfpbio: [], pfp_nobio: [], nopfp_nobio: [], notwa: [] };

    for (const c of chunk(numbers, 100)) {
        const check = await manji.checkOnWhatsApp(c);
        const exists = check.filter(r => r.exists).map(r => r.jid);
        cats.notwa.push(...check.filter(r => !r.exists).map(r => `+${r.jid.split("@")[0]}`));
        if (!exists.length) continue;

        const [pfp, bio] = await Promise.all([manji.isPfp(exists), manji.getBio(exists)]);
        exists.forEach(jid => {
            const n = `+${jid.split("@")[0]}`;
            const b = Array.isArray(bio) ? bio.find(x => x.jid === jid) : bio;
            const s = fmt(b?.setAt);
            const hasBio = b?.status;
            const hasPfp = pfp.find(x => x.jid === jid)?.exists;

            if (hasPfp && hasBio) cats.pfpbio.push(lang.plugins.onwa.bioInfo.format(n, hasBio, s));
            else if (!hasPfp && hasBio) cats.nopfpbio.push(lang.plugins.onwa.bioInfo.format(n, hasBio, s));
            else if (hasPfp && !hasBio) cats.pfp_nobio.push(n);
            else cats.nopfp_nobio.push(n);
        });

        await new Promise(r => setTimeout(r, 1000));
    }

    let out = `${lang.plugins.onwa.checked.format(numbers.length)}\n\n`;
    if (cats.pfpbio.length) out += `${lang.plugins.onwa.hasPfpBio}\n${cats.pfpbio.join("\n\n")}\n\n`;
    if (cats.nopfpbio.length) out += `${lang.plugins.onwa.noPfpBio}\n${cats.nopfpbio.join("\n\n")}\n\n`;
    if (cats.pfp_nobio.length) out += `${lang.plugins.onwa.pfpNoBio}\n${cats.pfp_nobio.join(", ")}\n\n`;
    if (cats.nopfp_nobio.length) out += `${lang.plugins.onwa.noPfpNoBio}\n${cats.nopfp_nobio.join(", ")}\n\n`;
    if (cats.notwa.length) out += `${lang.plugins.onwa.notOnWhatsApp}\n${cats.notwa.join(", ")}\n\n`;

    await msg.send(out);
});


