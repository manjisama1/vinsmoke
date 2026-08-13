import fs from 'fs';
import path from 'path';
import { Command, lang, settings } from '../lib/index.js';

const MENU_DIR    = path.resolve(process.cwd(), 'media/menu');
const MEDIA_KEYS  = ['image', 'video', 'gif', 'audio'];
const EXT         = { image: 'jpg', video: 'mp4', gif: 'mp4', audio: 'mp3' };
const LAYOUT_KEYS = [
    'header', 'botInfoTitle', 'botInfoBorder', 'botInfoFooter',
    'categoryHeader', 'commandLine', 'categoryFooter',
    'aliasSeparator', 'externalTag',
];

const DEFAULT_LAYOUT = {
    header:         `╭───────────────\n│     *{botName}*\n╰───────────────\n`,
    botInfoTitle:   `┌─⊷ *BOT INFO*`,
    botInfoBorder:  `│ • `,
    botInfoFooter:  `└───────────────`,
    categoryHeader: `┌─⊷ *{category} COMMANDS* [{count}]`,
    commandLine:    `│ • {prefix}{name}{alias}{externalTag}`,
    categoryFooter: `└───────────────`,
    readmore:       true,
    aliasSeparator: ' | ',
    externalTag:    ' 🔌',
    botInfo: {
        fields: [
            { key: 'user',            label: 'User' },
            { key: 'totalCommands',   label: 'Commands',   suffix: ' cmds' },
            { key: 'totalCategories', label: 'Categories', suffix: ' cats' },
            { key: 'version',          label: 'Version' },
            { key: 'prefix',          label: 'Prefix' },
            { key: 'developer',       label: 'Developer' },
        ],
    },
};

const wipe   = p => p && fs.existsSync(p) && fs.unlinkSync(p);
const drop   = (media, keys) => keys.forEach(k => (wipe(media[k]), delete media[k]));
const kindOf = (q, message) => {
    const type = q.type || message.type || '';

    if (type.includes('image') || q.image) return 'image';
    if (type.includes('audio') || q.audio) return 'audio';
    if (type.includes('video') || q.video) return q.gif ? 'gif' : 'video';
    return null;
};

const mergeLayout = custom =>
    Object.fromEntries([...LAYOUT_KEYS, 'readmore'].map(k => [k, custom[k] ?? DEFAULT_LAYOUT[k]]));

async function saveMed(kind, buf) {
    if (!fs.existsSync(MENU_DIR)) fs.mkdirSync(MENU_DIR, { recursive: true });

    const filePath = path.join(MENU_DIR, `${kind}_${Date.now()}.${EXT[kind]}`);
    fs.writeFileSync(filePath, buf);

    const media = await settings.get('menu', 'media', {});

    if (kind === 'video') drop(media, ['image', 'gif', 'audio']);
    if (kind === 'gif')   drop(media, ['image', 'video']);
    if (kind === 'image') drop(media, ['video', 'gif']);
    if (kind === 'audio') drop(media, ['video']);

    media[kind] = filePath;
    await settings.set('menu', 'media', media);
}

Command({
    pattern: 'menu ?(.*)',
    desc: 'Display and configure command menu',
    type: 'general',
}, async (message, match) => {
    const args = match?.trim() || '';

    if (!args.startsWith('-set')) {
        const res = await message.menu(DEFAULT_LAYOUT, args);
        return res || message.send(`No categories found for "${args}"`);
    }

    if (!message.isSudo) return message.send('Only Sudo users can modify menu settings.');

    return handleSet(message, args.replace('-set', '').trim());
});

async function handleSet(message, sub) {
    if (sub === 'on') return toggle(message, 'customMenu', true, 'Custom menu enabled.');
    if (sub === 'off') return toggle(message, 'customMenu', false, 'Custom menu disabled.');
    if (sub === 'product off') return toggle(message, 'productMenu', false, 'Product menu disabled.');

    if (sub === 'product on') {
        await settings.set('menu', 'productMenu', true);
        await settings.set('menu', 'customMenu', true);
        return message.send('Product menu enabled.');
    }

    if (sub === 'media')         return saveQuo(message);
    if (sub.startsWith('remove ')) return remMed(message, sub.slice(7).trim());
    if (sub === 'reset')          return reset(message);
    if (sub === 'status')         return status(message);
    if (sub === 'export')         return expoRt(message);
    if (sub === 'import')         return impoRt(message, sub);
    if (sub === 'readmore on')    return setRM(message, true);
    if (sub === 'readmore off')   return setRM(message, false);

    const key = LAYOUT_KEYS.find(k => sub.startsWith(`${k} `));
    if (key) return setKey(message, key, sub.slice(key.length + 1));

    return message.send('Invalid menu settings command.');
}

const toggle = async (message, key, val, msg) => (
    await settings.set('menu', key, val), message.send(msg)
);

async function saveQuo(message) {
    const q = message.quoted;
    if (!q) return message.send('Please reply to a media file.');

    const kind = kindOf(q, message);
    if (!kind) return message.send('Unsupported media type.');

    const buf = await q.download();
    if (!buf) return message.send('Failed to download media.');

    await saveMed(kind, buf);
    await settings.set('menu', 'customMenu', true);
    return message.send(`Saved ${kind.toUpperCase()} for menu.`);
}

async function remMed(message, target) {
    const media = await settings.get('menu', 'media', {});

    if (target === 'media') {
        Object.values(media).forEach(wipe);
        await settings.set('menu', 'media', {});
        return message.send('All menu media removed.');
    }

    if (!MEDIA_KEYS.includes(target)) return message.send('Invalid menu settings command.');

    wipe(media[target]);
    delete media[target];
    await settings.set('menu', 'media', media);
    return message.send(`Removed ${target} from menu media.`);
}

async function reset(message) {
    await settings.set('menu', 'layout', {});
    await settings.set('menu', 'productMenu', false);
    return message.send('Menu layout and product settings reset to default.');
}

async function status(message) {
    const customMenu  = await settings.get('menu', 'customMenu', false);
    const productMenu = await settings.get('menu', 'productMenu', false);
    const media        = await settings.get('menu', 'media', {});
    const layout        = await settings.get('menu', 'layout', {});

    const active = Object.keys(media).filter(k => media[k] && fs.existsSync(media[k])).join(', ') || 'None';

    return message.send(
        `*Menu Status*\n\n` +
        `• Custom Menu: *${customMenu}*\n` +
        `• Product Menu: *${productMenu}*\n` +
        `• Active Media: *${active}*\n` +
        `• Custom Layout Keys: *${Object.keys(layout).length}*`
    );
}

async function expoRt(message) {
    const customMenu  = await settings.get('menu', 'customMenu', false);
    const productMenu = await settings.get('menu', 'productMenu', false);
    const layout        = mergeLayout(await settings.get('menu', 'layout', {}));
    const media          = await settings.get('menu', 'media', {});

    const mediaMeta = Object.fromEntries(
        Object.entries(media)
            .filter(([, p]) => p && fs.existsSync(p))
            .map(([k, p]) => [k, path.basename(p)])
    );

    const data = { customMenu, productMenu, layout, media: mediaMeta };
    return message.send(`\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``);
}

async function impoRt(message, sub) {
    const input = message.quoted?.text || sub.replace('import', '').trim();
    const clean = input.replace(/```json|```/g, '').trim();

    let parsed;
    try {
        parsed = JSON.parse(clean);
    } catch {
        return message.send('Not a valid settings JSON');
    }

    if (typeof parsed !== 'object' || parsed === null) return message.send('Not a valid settings JSON');

    if (typeof parsed.customMenu === 'boolean')  await settings.set('menu', 'customMenu', parsed.customMenu);
    if (typeof parsed.productMenu === 'boolean') await settings.set('menu', 'productMenu', parsed.productMenu);

    if (parsed.layout && typeof parsed.layout === 'object') {
        const layout = await settings.get('menu', 'layout', {});

        [...LAYOUT_KEYS, 'readmore'].forEach(k => {
            const val = parsed.layout[k];
            if (k === 'readmore' ? typeof val === 'boolean' : typeof val === 'string') layout[k] = val;
        });

        await settings.set('menu', 'layout', layout);
    }

    return message.send('Menu settings imported successfully.');
}

async function setRM(message, on) {
    const layout = await settings.get('menu', 'layout', {});
    layout.readmore = on;
    await settings.set('menu', 'layout', layout);
    return message.send(`Readmore ${on ? 'enabled' : 'disabled'}.`);
}

async function setKey(message, key, val) {
    const layout = await settings.get('menu', 'layout', {});
    layout[key] = val.replace(/\\n/g, '\n');
    await settings.set('menu', 'layout', layout);
    await settings.set('menu', 'customMenu', true);
    return message.send(`Updated ${key}.`);
}


Command({
    pattern: 'ping',
    aliases: ['p'],
    desc: lang.plugins.ping.desc,
    type: 'general',
}, async (message) => {
    const start = Date.now();
    await message.send(lang.plugins.ping.pingMessage);
    const end = Date.now();
    const response = lang.plugins.ping.pongMessage.format(end - start);
    await message.send(response);
});


Command({
    pattern: 'system',
    desc: lang.plugins.status.desc,
    type: 'general',
    sudo: true
}, async (message, _, manji) => {
    const text = manji.runtime(
        message.client.pluginManager,
        manji.config, message);
    await message.send(text);
});

Command({
    pattern: 'repo ?(.*)',
    desc: 'Get bot repository link',
    type: 'general'
}, async (message) => {
    await message.send(`https://github.com/manjisama1/vinsmoke`);
});