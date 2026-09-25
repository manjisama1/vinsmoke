# VINSMOKE — Plugin Development Guide

A complete reference for writing plugins against the actual `Message`, `Command`, `Listen`, and `Manji` APIs shipped in this bot. Everything below reflects what the code actually does — not aspirational or deprecated behavior.

---

## Table of Contents

1. [Basic Plugin Structure](#basic-plugin-structure)
2. [Command Configuration](#command-configuration)
3. [The Message Object](#the-message-object)
4. [Quoted Messages](#quoted-messages)
5. [Sending Messages](#sending-messages)
6. [Rich Responses — code / web / table](#rich-responses--code--web--table)
7. [Group Management](#group-management)
8. [The `manji` Helper](#the-manji-helper)
9. [Event Listening](#event-listening)
10. [Utility Imports](#utility-imports)
11. [Example Plugins](#example-plugins)
12. [Best Practices](#best-practices)

---

## Basic Plugin Structure

Drop a `.js` file into `plugins/` (built-in) or `mPlugins/` (your own — loaded from `mPlugins/` and takes priority for overridable commands). Every plugin file is hot-loaded at boot.

```javascript
import { Command, lang } from '../lib/index.js';

Command({
    pattern: 'commandname ?(.*)',
    aliases: ['alias1', 'alias2'],
    desc: 'Command description',
    type: 'category',
    sudo: false,
    group: false,
    pm: false,
    react: true,
    fromMe: false,
    owner: false
}, async (message, match, manji) => {
    // Your plugin logic here
});
```

The handler receives:

| Arg | Description |
|---|---|
| `message` | The parsed [`Message`](#the-message-object) instance |
| `match` | The regex capture group from your pattern (see below), or the text after an alias |
| `manji` | A shared [`Manji`](#the-manji-helper) helper instance for this message |

`pattern` supports a trailing `?(.*)` (or `?.*`) as optional free text — it is turned into `(.*)` internally, and whatever it captures is what you receive as `match`.

---

## Command Configuration

| Property | Type | Default | Description |
|---|---|---|---|
| `pattern` | string | — | Command pattern, e.g. `'hello ?(.*)'` |
| `aliases` | string[] | `[]` | Alternative trigger words |
| `desc` / `description` | string | `'No description'` | Shown in menus/help |
| `type` / `category` | string | `'general'` | Menu category |
| `usage` | string | `''` | Optional usage hint |
| `prefix` | boolean | `true` | Set `false` to make this a **no-prefix** command (matched against raw text) |
| `group` / `groupOnly` | boolean | `false` | Group chats only |
| `pm` / `pmOnly` / `private` | boolean | `false` | Private chats only |
| `sudo` / `fromMe` | boolean | `false` | Requires sudo access (owner always passes) |
| `owner` | boolean | `false` | Bot owner (the number the bot is logged in as) only |
| `botOnly` | boolean | `false` | Only runs when the message was sent by the bot itself |
| `react` | boolean \| string | `true` | `true` = default configured emoji, `false` = no reaction, `'🎉'` = custom emoji |

**Permission order actually enforced** (`message-handler.js`):
1. `fromMe`/`botOnly` — hard gate, checked first.
2. `owner` — hard gate.
3. Sudo or the bot owner **bypasses every other restriction below.**
4. Everyone else is denied outright in private chats unless the command is explicitly public for that chat (via the settings system).
5. `group` / `pm` scoping is enforced.
6. `sudo: true` denies non-sudo users at this point (silently unless already handled above).

---

## The Message Object

### Identity & Chat

```javascript
message.chat        // Normalized chat JID (group or 1:1)
message.chatlid     // Raw LID-form chat identifier (used internally for LID/PN mapping)
message.sender       // Sender JID (prefers @s.whatsapp.net form)
message.lid          // Sender's LID form
message.jid          // Alias for message.sender
message.gid          // Alias for message.chat
message.botJid       // The bot's own JID (getter)
message.botLid       // The bot's own LID (getter)
message.name         // Sender's push name, or a resolved fallback
message.isGroup       // true for group chats
message.isPrivate     // true for 1:1 chats
message.isBroadcast   // true for status@broadcast
message.fromMe        // true if the bot sent this message
message.isOwner       // alias of fromMe
message.isSudo        // true if sender is fromMe or in SUDO list
message.sudo          // alias of isSudo
```

### Command Parsing

```javascript
message.text     // Extracted text/caption content (null if none)
message.body     // text, or '[View Once Message]' for absent view-once stubs
message.command  // Parsed command name (set only after parseCommand() runs)
message.args     // Array of arguments after the command
```

### Stub / System Messages

```javascript
message.stubType             // Raw messageStubType, or null
message.stubParameters       // Raw stub parameters array
message.isStub               // true if this is a stub-type message
message.isViewOnceStubMessage // true if it's a "view-once expired/absent" stub
```

### Media Detection

`message.hasMedia` is `true` whenever `_detectMedia()` recognized a payload. `message.type` holds the detected type string (`'text'` when there's no media).

```javascript
message.hasMedia
message.type          // 'image' | 'video' | 'audio' | 'sticker' | 'document' | 'poll' |
                       // 'contact' | 'location' | 'live_location' | 'event' | 'reaction' |
                       // 'button_response' | 'list_response' | 'template_response' |
                       // 'interactive' | 'order' | 'payment' | 'invoice' | 'product' |
                       // 'group_invite' | 'rich_response' | 'system' | 'text' | ...
```

Boolean shortcuts (only meaningful when `hasMedia` is true — all `false`/`null` otherwise):

```javascript
message.image / message.video / message.audio
message.sticker      // { animated, avatar, ai, lottie } or null
message.isSticker
message.contact / message.location / message.liveLocation
message.poll / message.event / message.reaction
message.button / message.list / message.template   // button/list/template replies
message.interactive
message.order / message.payment / message.invoice / message.product
message.groupInvite
message.voice         // true for push-to-talk audio
message.gif           // true for a video sent with gifPlayback
message.viewOnce
message.ephemeral
message.mimetype / message.filesize / message.filename
message.caption       // Same as message.text for captioned media
message.document      // { type, audio, video, image, pdf, txt, apk, doc, xls, ppt, zip } or null
```

### Mentions

```javascript
message.mention  // Array of mentioned JIDs from the message context (getter — not "mentions")
```

### Other Getters

```javascript
message.raw   // The original Baileys message object
message.key   // The original Baileys message key
message.id / message.timestamp / message.date
```

---

## Quoted Messages

`message.quoted` is populated automatically when the incoming message replies to another one. It mirrors most of the top-level media flags plus its own metadata:

```javascript
message.quoted.text / message.quoted.type
message.quoted.sender / message.quoted.jid / message.quoted.lid
message.quoted.fromMe / message.quoted.chat / message.quoted.id / message.quoted.key
message.quoted.message      // Raw Baileys message payload for the quoted message
message.quoted.raw          // Getter — full stored raw entry from the in-memory store, if present
message.quoted.name         // Getter — push name or resolved fallback

// Media flags (same shape as the top-level message):
message.quoted.image / video / audio / voice / gif
message.quoted.contact / location / liveLocation
message.quoted.poll / event / reaction / button / list / template / interactive
message.quoted.product / order / payment / invoice / groupInvite
message.quoted.sticker      // { animated, avatar, ai, lottie } or null
message.quoted.document     // Same shape as message.document
message.quoted.mimetype / filename / filesize / caption
message.quoted.hasMedia
message.quoted.mentions     // mentionedJid array from the quoted message's own context
message.quoted.ephemeral / viewOnce

// Download the quoted media directly:
const buf = await message.quoted.download('buffer'); // default type is 'buffer'
```

> ⚠️ Resolution note: `quoted.sender` / `quoted.lid` are resolved from LID to phone-number form **asynchronously** right after the `Message` is constructed. If you need the fully-resolved value at the very top of your handler, `await message.resolveSenderAndParticipant()` first.

---

## Sending Messages

### Plain Text

```javascript
await message.send('Hello World!');
await message.reply('This is a reply');          // quotes the current message
await message.send('Hi there', {}, 'chatid@g.us'); // send to a different chat
```

> A raw `Buffer` passed directly to `send()` is treated as an **image** (`msg.image = content`). Use the object form below for anything else.

### Media

```javascript
await message.send({ image: buffer, caption: 'Image caption' });
await message.send({ video: buffer, caption: 'Video caption' });
await message.send({ audio: buffer, ptt: true });          // voice note
await message.send({ sticker: buffer });
await message.send({
    document: buffer,
    fileName: 'file.pdf',
    mimetype: 'application/pdf'
});

// A short-hand `gif` key auto-converts a GIF buffer/path to an mp4 with gifPlayback:
await message.send({ gif: gifBuffer, caption: 'nice' });
```

Short-hand keys accepted in the content object (mapped internally): `txt`/`msg` → text, `img` → image, `vid` → video, `aud` → audio, `doc` → document, `stk` → sticker, `loc` → location, `con` → contacts, `fwd` → forward, `cap` → caption, `mime` → mimetype, `name` → fileName, `view` → viewOnce, `ptv` → ptv. Any other key (e.g. `mentions`) is passed straight through to Baileys.

### Poll

```javascript
await message.send({
    poll: 'Choose an option',
    values: ['Option 1', 'Option 2'],   // or `options`
    selectableCount: 1,                 // or `select`
    announce: false                     // toAnnouncementGroup
});
```

### Contact

```javascript
await message.send({
    contacts: {
        name: 'Contact Name',           // or displayName
        vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:Name\nTEL:+1234567890\nEND:VCARD'
    }
});
```

### Location

```javascript
await message.send({
    location: { lat: 40.7128, lng: -74.0060, name: 'New York', address: 'New York, NY, USA' }
});
```

### Mentions

```javascript
// Simple single mention (auto-prepends "@number" to the text):
await message.send('Welcome!', { mention: 'user@s.whatsapp.net' });

// Explicit mentions array — works on any content type, including media captions:
await message.send({ image: buffer, caption: 'Hi @user', mentions: ['user@s.whatsapp.net'] });
```

### Reacting, Editing, Deleting

```javascript
await message.react('👍');
await message.unreact();
await message.edit('Updated text');
await message.delete();          // deletes the current message
await message.delete(otherMsg);  // deletes some other tracked message
```

### Forwarding & Ephemeral

```javascript
await message.forward('targetchat@g.us');
await message.sendEphemeral('Disappearing message', '7d'); // '1d' | '7d' | '90d' | seconds
```

### Starring

```javascript
await message.star();     // star the current message
await message.unstar();
```

### Sending From a URL

```javascript
// Auto-detects the content-type and sends as image/video/audio/document/sticker (webp):
await message.sendFromUrl('https://example.com/file.mp4', {
    caption: 'From the web',
    fileName: 'clip.mp4'
});
```

### Voice Notes (with optional rich preview)

```javascript
// Simple push-to-talk voice note (any audio buffer/path is transcoded to opus/ogg):
await message.voicenote(audioBufferOrPath);

// With a rich "external ad reply" style preview card:
await message.voicenote(audioBufferOrPath, {
    title: 'Track Title',
    body: 'Artist name',
    thumbnail: imageBuffer   // or `image`
});
```

### Permission & Media Helpers

```javascript
message.hasPermission('owner');   // true only for the bot owner
message.hasPermission('sudo');    // true for sudo users or the owner
message.hasPermission();          // 'user' level — always true

message.arg(0, 'default');        // args[0] or the default
message.argsText(' ');            // args joined back into a string

message.getUserMention();         // '@1234567890'
message.getBotMention();          // '@botnumber'
message.getFormattedTime();       // locale-formatted date string
message.getStubInfo();            // { type, parameters, isViewOnce } or null

message.getMediaUrl();            // direct media URL, if present
message.getMediaKey();            // media encryption key
message.getMediaSize();           // fileLength in bytes
message.getMediaDuration();       // seconds (audio/video)
message.getMediaDimensions();     // { width, height } for image/video, else null

message.isBot(jid);               // true if jid (or fromMe) matches the bot
message.isBotJid(jid);            // strict JID comparison against the bot
```

### Downloading Media

```javascript
const filePath = await message.download();          // default 'path'
const buffer   = await message.quoted.download();    // default 'buffer' on quoted
```

---

## Rich Responses — code / web / table

These three helpers piggyback on WhatsApp's "AI rich response" rendering (the same UI used by Meta AI) to send formatted content. They require no extra imports — they're built into every `Message` instance.

### `message.code(src, opts)`

Sends a syntax-highlighted code block.

```javascript
await message.code('console.log("hi")', { lang: 'js' });

await message.code('print("hi")', {
    lang: 'py',
    intro: 'Here is an example:',
    outro: 'Hope that helps!'
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `lang` | string | `'javascript'` | Language — see alias table below |
| `intro` | string | — | Optional text block rendered before the code |
| `outro` | string | — | Optional text block rendered after the code |

Recognized short aliases for `lang` (anything else is passed through as-is):

`js` `ts` `py` `sh` `rb` `rs` `kt` `cs` `cpp` `c` `go` `java` `php` `swift` `lua` `r` `html` `css` `json` `sql` `dart` `scala`

Highlighting covers keywords, method/function calls, strings, numbers, and line/block comments for C-style and Python-style syntax.

### `message.web(html, jid?)`

Renders a raw HTML payload as a rich, forwarded-style message. Useful for quick visual output (tables of data, simple layouts) without generating an image.

```javascript
await message.web('<h2>Status</h2><p>All systems operational.</p>');
```

### `message.table(blocks)`

Sends one or more text blocks and tables in a single rich message.

```javascript
await message.table([
    { type: 'text', text: 'Leaderboard:' },
    { type: 'table', rows: [
        ['Rank', 'User', 'Score'],  // first row is rendered as the header
        ['1', 'Alice', '99'],
        ['2', 'Bob', '87']
    ]}
]);
```

---

## Group Management

Available directly on `Message` (operate on `message.chat`):

```javascript
await message.kick(userJid);      // or an array of JIDs
await message.add(userJid);
await message.promote(userJid);
await message.demote(userJid);

await message.mute();             // announcement-only mode
await message.unmute();
await message.lock();             // only admins can edit group info
await message.unlock();
await message.leave();

await message.getInviteCode();
await message.revokeInvite();

await message.isAdmin(userJid);   // defaults to message.sender if omitted
await message.admin();            // shorthand for isAdmin(message.sender)
```

> All of the above (except `isAdmin`/`admin`) require the **bot itself** to be a group admin. Always check with `manji.isBotAdmin(message.chat)` before calling them.

---

## The `manji` Helper

Passed as the third argument to every command/listener handler. A selection of the most useful methods (not exhaustive — see `lib/manji.js` for the full surface):

### Group Info & Admin Checks

```javascript
await manji.isBotAdmin(gid);
await manji.isAdmin(gid, userJid);
await manji.isSuperAdmin(gid, userJid);
await manji.isMember(gid, userJid);
await manji.getUserRole(gid, userJid);   // 'superadmin' | 'admin' | 'member' | 'not_member'
await manji.getAdmins(gid);
await manji.getMembers(gid);
await manji.groupMetadata(gid);
```

### Group Actions (mirrors of the Message shortcuts, callable with an explicit `gid`)

```javascript
await manji.kick(gid, userJid);
await manji.promote(gid, userJid);
await manji.acceptRequest(gid, userJid);
await manji.rejectRequests(gid, [userJid1, userJid2]);
await manji.joinGroup(inviteCode);
await manji.enableDisappearing(gid, '7d');
```

### JID / LID Utilities

```javascript
await manji.getUserJid(message, match);   // Resolve mentions/quoted/typed numbers to JIDs
await manji.getUserLid(message, match);   // Same, but returns LIDs
await manji.normalizeToPhoneJid(jid);
manji.numToJid(number);
manji.jidToNum(jid);
await manji.lid2pn(lid);
await manji.pn2lid(phoneNumber);
```

### Media

```javascript
await manji.downLoad(rawMessage, 'buffer' | 'path' | 'info'); // 'info' returns { buffer, path, fileName, extension, size, info }
await manji.downloadFromUrl(url, fileName);
```

### Env / Config Helpers

```javascript
manji.envGet('PREFIX');
await manji.envSet('BOT_MODE', 'public');
await manji.envAdd('SUDO', '1234567890');
await manji.envRemove('SUDO', '1234567890');
manji.envList('SUDO');
```

### Timing / System

```javascript
manji.parseTime('1h30m');     // -> milliseconds
manji.formatTime(ms);
manji.formatUptime(ms);
manji.getMemoryUsage();
manji.getSystemInfo();
```

### Lightweight Message-Filter Tracking

`Manji` also exposes a small in-memory tracker registry, checked once per incoming message (before command dispatch):

```javascript
const id = manji.addTracker(
    (msg, manji) => msg.type === 'sticker',   // filter: function OR a plain object (see matchesFilter keys)
    async (msg, manji) => {
        // runs for every sticker message, regardless of prefix/command
    },
    { name: 'sticker-logger', description: 'Logs every sticker' }
);

manji.toggleTracker(id, false);   // pause it
manji.removeTracker(id);          // remove it
manji.getTrackers();              // list all active trackers
```

Object filters support these keys: `sender`, `chat`, `isGroup`, `isPrivate`, `isSudo`, `fromMe`, `hasMedia`, `quoted`, `mediaType`, `text` (substring match). Trackers are capped at 100 and evict the oldest when full — treat them as a debugging/automation aid, not a permanent store.

---

## Event Listening

There are **two separate mechanisms** — don't mix them up.

### 1. `Listen()` — per-message-type plugin listeners

Registered like a command, but runs for **every incoming WhatsApp message** whose detected `type` matches `on` (or always, if `on: 'all'`). Respects the same permission flags as `Command`.

```javascript
import { Listen } from '../lib/index.js';

Listen({
    on: 'text',        // matches message.type — 'text', 'image', 'sticker', 'all', etc.
    group: true,        // group chats only
    fromMe: false        // not restricted to the bot's own messages
}, async (message) => {
    // Runs on every plain-text group message
});
```

**⚠️ Use `Listen` carefully:**
- It bypasses private-mode and sudo command restrictions — anyone whose message matches the filter triggers it.
- Use it for passive/background behavior: logging, auto-replies, moderation triggers, stat tracking.
- Use `Command` for anything the user explicitly invokes.

### 2. `listen` — raw Baileys event bus

A lower-level `EventEmitter` wired directly to the socket, covering every underlying event — not just new messages. Useful for reacting to things `Listen()` can't see (deletions, presence, group metadata changes, calls, etc.).

```javascript
import { listen } from '../lib/index.js';

listen.on('message.update', async (updates) => {
    for (const { key, update } of updates) {
        if (update?.message === null) console.log('Deleted:', key.id);
    }
});

listen.on('group.participants', async (data) => {
    console.log('Group update:', data.id, data.action);
});
```

Available events: `message` `message.update` `message.delete` `receipt` `presence` `connection` `creds` `chat` `chat.update` `chat.delete` `contact` `contact.update` `group` `group.update` `group.participants` `block` `block.update` `call` `label` `label.assoc` `history` `lid` `phone.share`

### In-Memory Store

```javascript
import { store } from '../lib/index.js';

const msg     = store.get(messageId);
const raw     = store.getRaw(jid, messageId);
const history = store.history(jid, 50);
const stats   = store.stats();
```

---

## Utility Imports

Everything is exported from `../lib/index.js`. Most are lazily loaded, so importing them has no startup cost until first use.

```javascript
import {
    Command, Listen,                 // registration
    lang, config,                    // language strings / live config
    settings,                        // persistent key-value + per-command access DB
    store,                           // in-memory message store
    listen,                          // raw baileys event bus
    downLoad,                        // generic media downloader
    webpToImage, webpToMp4,          // sticker conversion
    cropImage, cropVideo,            // media cropping
    resizeMedia, mediaRotate,        // media transforms
    imageMeta, videoMeta,            // media metadata
    videoToAudio, editAudioMeta,     // audio extraction/tagging
    spotifyDl, instaDl, instaData, fbDl, tgStk, pinterest, // scrapers
    Manji,                           // helper class (rarely constructed directly — use the `manji` arg)
    wait                             // Promise-based sleep(ms)
} from '../lib/index.js';
```

### Language Strings

```javascript
await message.send(lang.plugins.ping.desc);
```

### Live Config

```javascript
const prefix    = config.PREFIX;
const botMode   = config.BOT_MODE;   // 'public' | 'private'
const sudoUsers = config.SUDO;       // array
```

### Persistent Settings (SQLite-backed)

Used for anything that needs to survive a restart and isn't a simple env var — per-command public access grants, saved menu layouts, anti-delete rules, etc.

```javascript
await settings.set('mynamespace', 'someKey', { any: 'json-serializable value' });
const value = await settings.get('mynamespace', 'someKey', fallback);
await settings.push('mynamespace', 'listKey', 'item1', 'item2');
```

---

## Example Plugins

### Simple Command

```javascript
import { Command } from '../lib/index.js';

Command({
    pattern: 'hello ?(.*)',
    desc: 'Say hello',
    type: 'fun',
    react: true
}, async (message, match) => {
    const name = match || 'World';
    await message.reply(`Hello ${name}!`);
});
```

### Silent Command (no reaction)

```javascript
Command({
    pattern: 'silent ?(.*)',
    desc: 'Runs without an emoji reaction',
    type: 'utility',
    react: false
}, async (message) => {
    await message.send('This command runs silently');
});
```

### Custom Reaction Emoji

```javascript
Command({
    pattern: 'fun ?(.*)',
    desc: 'Fun command with a custom reaction',
    type: 'fun',
    react: '🎉'
}, async (message) => {
    await message.send('Party time! 🎊');
});
```

### Media-Aware Command

```javascript
Command({
    pattern: 'toimage',
    desc: 'Extract an image from a non-animated sticker',
    type: 'media'
}, async (message) => {
    if (!message.quoted?.sticker || message.quoted.sticker.animated) {
        return message.send('Reply to a static sticker');
    }
    const buf = await message.quoted.download('buffer');
    // ...convert and send
});
```

### Group Moderation

```javascript
Command({
    pattern: 'kick',
    desc: 'Kick a user from the group',
    type: 'group',
    group: true,
    react: true
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) {
        return message.send('I need admin rights for that.');
    }
    if (!await message.admin()) {
        return message.send('You need admin rights for that.');
    }

    const target = message.mention[0] || message.quoted?.sender;
    if (!target) return message.send('Mention or reply to a user.');

    await message.kick(target);
    await message.send('User kicked.');
});
```

### Owner-Only Command

```javascript
Command({
    pattern: 'restart',
    desc: 'Restart the bot',
    type: 'system',
    owner: true,
    react: false
}, async (message) => {
    await message.send('Restarting...');
    process.exit(0);
});
```

### Poll Command

```javascript
Command({
    pattern: 'poll ?(.*)',
    desc: 'Create a poll: poll question|option1|option2',
    type: 'utility'
}, async (message, match) => {
    if (!match) return message.send('Usage: poll question|option1|option2');

    const [question, ...options] = match.split('|').map(s => s.trim());
    if (options.length < 2) return message.send('Need a question and at least 2 options.');

    await message.send({ poll: question, values: options, selectableCount: 1 });
});
```

### Code Snippet Response

```javascript
Command({
    pattern: 'snippet ?(.*)',
    desc: 'Send a highlighted code example',
    type: 'utility'
}, async (message) => {
    await message.code(
        'function add(a, b) {\n  return a + b;\n}',
        { lang: 'js', intro: 'Here you go:' }
    );
});
```

### Info About a Message (own or quoted)

```javascript
Command({
    pattern: 'info',
    desc: 'Get message info',
    type: 'utility'
}, async (message) => {
    const target = message.quoted || message;
    await message.send([
        `Type: ${target.type}`,
        `From: ${target.sender}`,
        `Chat: ${target.chat}`,
        `ID: ${target.id}`
    ].join('\n'));
});
```

---

## Best Practices

1. **Validate input** before acting on `match`/`args`.
2. **Check group admin status on both sides** (`manji.isBotAdmin` and `message.admin()`) before any moderation action.
3. **Wrap risky calls in try/catch** — an uncaught error is reported automatically, but a graceful in-chat message is friendlier.
4. **Prefer `Command` over `Listen`** unless you specifically need passive, always-on behavior.
5. **Clean up trackers** you register dynamically (`manji.removeTracker`) once they're no longer needed.
6. **Use `react` intentionally** — `false` for silent/system commands, a themed emoji for fun/utility ones.
7. **Don't assume `message.quoted` fields are already LID-resolved** — `await message.resolveSenderAndParticipant()` if you need the resolved phone-number JID immediately.
8. Persist anything that must survive a restart in `settings`, not in module-level variables.