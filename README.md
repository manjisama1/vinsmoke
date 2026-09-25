<div align="center">

<img src="media/assets/vinsmoke.png" alt="VINSMOKE" width="300" height="auto">

# VINSMOKE - WhatsApp Bot

**Professional WhatsApp Bot with Advanced Features**

[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Bot-25D366?logo=whatsapp)](https://whatsapp.com/)
[![Baileys](https://img.shields.io/badge/Baileys-6.7.20-blue)](https://github.com/WhiskeySockets/Baileys)

</div>

## Features

- **Multi-Device Support** — QR code and pairing code authentication, with automatic local-session and cloud-session recovery
- **Group Management** — admin controls, welcome/goodbye messages, participant actions, anti-delete forwarding
- **Media Processing** — sticker creation/conversion, view-once bypass, cropping, resizing, rotation, audio extraction
- **Content Downloads** — Spotify, Instagram (posts/reels + profile lookup), Facebook, Telegram stickers, Pinterest
- **Rich Message Responses** — syntax-highlighted code blocks, HTML rich responses, and tables (Meta AI-style rendering)
- **Utility Tools** — polls, contacts, locations, ephemeral messages, message editing/starring
- **Admin Features** — live config editing, sudo system, per-command/per-chat public access grants
- **LID/PN Mapping** — JID handling across Baileys' LID and phone-number addressing modes

## Quick Setup

### 1. Installation
```bash
git clone https://github.com/manjisama1/vinsmoke.git
cd vinsmoke
npm install
cp config.env.example config.env
```

### 2. Session Configuration

**Option A: Web Session Generator (Recommended)**
1. Visit: https://vinsmoke-ten.vercel.app/session
2. Generate your session ID
3. Add to `config.env`:
```env
SESSION_ID=your_session_id_here
```

**Option B: Terminal Authentication**

For QR Code:
```env
QR=true
SESSION_ID=
```

For Pairing Code:
```env
QR=false
BOT_NUM=1234567890
SESSION_ID=
```

### 3. Start Bot
```bash
npm start
```

On boot the bot tries, in order: a valid local `session/creds.json`, then a cloud session fetched via `SESSION_ID`, then falls back to fresh QR/pairing authentication.

## Configuration

Settings live in `config.env` as simple `KEY=value` pairs and are reloaded live (no restart needed) whenever changed through an admin command.

```env
# Authentication
SESSION_ID=                # Session ID from the web generator
QR=false                   # true = QR code, false = pairing code
BOT_NUM=                   # Your number, with country code (for pairing mode)

# Bot Settings
PREFIX=.                   # Command prefix
BOT_MODE=private           # public | private
SUDO=                      # Comma-separated sudo user numbers/LIDs

# Behavior
AUTO_READ=false            # Auto-read incoming messages
AUTO_STATUS_READ=false     # Auto-read status updates
ALWAYS_ONLINE=false        # Force "online" presence
DELETE=false               # Enable anti-delete forwarding
REACT=⏳                   # Default command-reaction emoji ('' disables reactions)

# Media
STICKER_PACK=PackName,AuthorName   # Comma-separated: name, author
TIMEZONE=Asia/Kolkata
```

> Runtime data that needs to persist across restarts and isn't a simple toggle — per-command public access grants, saved custom menu layouts, anti-delete rule sets — is stored in a local SQLite database (`lib/db/settings.db`) rather than in `config.env`, and is managed through in-chat admin commands.

## Core APIs

### Command — Register a Command

```javascript
import { Command } from '../lib/index.js';

Command({
    pattern: 'hello ?(.*)',
    desc: 'Greet users',
    type: 'misc'
}, async (message, match, manji) => {
    await message.send(`Hello ${match || 'World'}!`);
});
```

See **[PLUGIN_DEVELOPMENT.md](./PLUGIN_DEVELOPMENT.md)** for the full command-config reference and the complete `Message` API.

### Listen — Per-Message-Type Plugin Listeners

Runs on every incoming message whose type matches, independent of any command prefix:

```javascript
import { Listen } from '../lib/index.js';

Listen({ on: 'text', group: true }, async (message) => {
    // runs for every plain-text group message
});
```

### listen — Raw Baileys Event Bus

A lower-level event emitter wired to the socket, for events beyond new messages:

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

**Available events:** `message` `message.update` `message.delete` `receipt` `presence` `connection` `creds` `chat` `chat.update` `chat.delete` `contact` `contact.update` `group` `group.update` `group.participants` `block` `block.update` `call` `label` `label.assoc` `history` `lid` `phone.share`

### Store — In-Memory Message Cache

```javascript
import { store } from '../lib/index.js';

const msg     = store.get(messageId);
const raw     = store.getRaw(jid, messageId);
const history = store.history(jid, 50);
const stats   = store.stats();
```

## Plugin System

### Plugins Site
Explore all available community plugins: https://vinsmoke-ten.vercel.app/plugins

### Custom Plugin Development

Drop plugin files into `mPlugins/` — they're loaded after (and take priority over) the built-in `plugins/` directory for any overridable command.

```javascript
import { Command, lang } from '../lib/index.js';

Command({
    pattern: 'hello ?(.*)',
    desc: 'Greet users',
    type: 'misc'
}, async (message, match) => {
    const name = match || 'World';
    await message.send(`Hello ${name}!`);
});
```

Full guide, including every `Message` property/method and the `manji` helper surface: **[PLUGIN_DEVELOPMENT.md](./PLUGIN_DEVELOPMENT.md)**

## Project Structure

```
vinsmoke/
├── lib/
│   ├── bot.js              # Main bot bootstrap (VinsmokeBot)
│   ├── client.js           # WhatsApp socket connection & LID/PN utilities
│   ├── message.js          # Message class — parsing, sending, quoting, media
│   ├── message-handler.js  # Command routing, permissions, rate limiting
│   ├── plugin-manager.js   # Plugin loading & command/listener registry
│   ├── manji.js            # Manji helper class (group tools, JID utils, trackers, menu)
│   ├── eventon.js          # Internal event wiring (anti-delete, welcome/goodbye, etc.)
│   ├── listen.js           # Low-level event bus (Listener/EventEmitter)
│   ├── config.js           # config.env reader/writer, live-reloadable
│   ├── settings.js         # SQLite-backed persistent settings & access control
│   ├── store.js            # In-memory message store
│   ├── scrapers.js         # Spotify / Instagram / Facebook / Telegram / Pinterest
│   ├── functions.js        # Media download & conversion helpers
│   └── index.js            # Single entry point re-exporting the whole library
├── plugins/                # Built-in commands
├── mPlugins/               # Your custom commands (overrides built-ins where allowed)
├── lang/                   # Language files
├── session/                # WhatsApp session data
└── config.env              # Environment configuration
```

## Troubleshooting

### Common Issues

**Session Problems:**
- Use the web generator if terminal auth fails
- Clear the `session/` folder for a fresh start
- Ensure the phone number includes the correct country code

**Connection Issues:**
- Check your internet connection
- Verify Node.js version (20.0.0+)
- Install FFmpeg — required for media processing (stickers, voice notes, GIF conversion)

**Plugin Errors:**
- Check plugin syntax and import paths
- Errors during command execution are reported automatically to the bot's own chat with file/line context

### FAQ & Support

For detailed troubleshooting and frequently asked questions, visit our support page:
https://vinsmoke-ten.vercel.app/faq

## Development

### Prerequisites
- Node.js v20.0.0 or higher
- FFmpeg (for media processing)
- Git
- pm2 (recommended for production process management)

### Debug Commands
```bash
.status   # Bot status/uptime/resource usage
.ping     # Response time check
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Resources

- **Session Generator**: https://vinsmoke-ten.vercel.app/session
- **Plugin Library**: https://vinsmoke-ten.vercel.app/plugins
- **Plugin Development Guide**: [PLUGIN_DEVELOPMENT.md](./PLUGIN_DEVELOPMENT.md)
- **FAQ**: https://vinsmoke-ten.vercel.app/faq
- **Support**: https://vinsmoke-ten.vercel.app/support
- **GitHub Issues**: https://github.com/manjisama1/vinsmoke/issues

## Credits

Special thanks to:
- **[Baileys](https://github.com/WhiskeySockets/Baileys)** — The WhatsApp Web API library that powers this bot
- **[WhiskeySockets](https://github.com/WhiskeySockets)** — For maintaining and developing Baileys
- All contributors and the open-source community

## License

This project is licensed under the MIT License.

---

<div align="center">

**Developed by [manjisama1](https://github.com/manjisama1)**

Star this repository if you find it useful

</div>