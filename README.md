<div align="center">

<img src="media/assets/vinsmoke.png" alt="VINSMOKE" width="300" height="auto">

# VINSMOKE - WhatsApp Bot

**Professional WhatsApp Bot with Advanced Features**

[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Bot-25D366?logo=whatsapp)](https://whatsapp.com/)
[![Baileys](https://img.shields.io/badge/Baileys-6.7.20-blue)](https://github.com/WhiskeySockets/Baileys)

</div>

## Features

- **Multi-Device Support** - QR code and pairing code authentication
- **Group Management** - Admin controls, anti-link, anti-word, user banning
- **Media Processing** - Sticker creation, view-once bypass, auto-steal
- **Content Downloads** - Spotify, Instagram, Pinterest, Telegram stickers
- **Utility Tools** - Fancy text, number validation, message tracking
- **Admin Features** - Variable management, sudo system, bot control
- **LID/PN Mapping** - Professional JID handling with Baileys v7 support

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

## Configuration Guide

### Essential Settings
```env
# Authentication
SESSION_ID=                 # Session from web generator
QR=true                    # true=QR code, false=pairing code
BOT_NUM=                   # Your number (for pairing mode)

# Bot Settings
PREFIX=.                   # Command prefix
BOT_MODE=private          # public/private
SUDO=                     # Sudo users (comma-separated)

# Features
AUTO_READ=false           # Auto-read messages
STICKER_PACK=VINSMOKE     # Default sticker pack name
```

### Advanced Configuration
```env
# Database
DATABASE_URL=             # PostgreSQL URL (we aren't using this so skip it)

# Media
MAX_SIZE=100              # Max file size (MB)
TIMEZONE=Asia/Kolkata     # Bot timezone

# Security
ANTI_DELETE=false         # Anti-delete protection
LOGS=false               # Enable logging
```

## Core APIs

### Listen - Event System
```javascript
import { listen } from '../lib/index.js';

listen.on('message.update', async (updates) => {
    for (const { key, update } of updates) {
        if (update?.message === null) console.log('Deleted:', key.id);
    }
});

listen.on('message', async ({ messages, type }) => {
    console.log('New messages:', messages.length);
});

listen.on('group.participants', async (data) => {
    console.log('Group update:', data.id, data.action);
});
```

**Available Events:**
`message` `message.update` `message.delete` `receipt` `presence` `connection` `creds` `chat` `chat.update` `chat.delete` `contact` `contact.update` `group` `group.update` `group.participants` `block` `block.update` `call` `label` `label.assoc` `history` `lid` `phone.share`

### Store - Message Storage
```javascript
import { store } from '../lib/index.js';

const msg = store.get(messageId);
const raw = store.getRaw(jid, messageId);
const history = store.history(jid, 50);
const stats = store.stats();
```

## Plugin System

### Plugins site
Explore all available plugins: https://vinsmoke-ten.vercel.app/plugins

### Custom Plugin Development
Create plugins and upload in our site

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

## Project Structure

```
vinsmoke/
├── lib/                  # Core library files
│   ├── client.js        # WhatsApp client
│   ├── manji.js         # Main bot class
│   ├── message.js       # Message handling
│   └── config.js        # Configuration management
├── plugins/             # Built-in plugins
├── mPlugins/           # Custom plugins
├── lang/               # Language files
├── session/            # WhatsApp session data
└── config.env          # Environment configuration
```

## Troubleshooting

### Common Issues

**Session Problems:**
- Use web generator if terminal auth fails
- Clear `session/` folder for fresh start
- Ensure correct phone number format

**Connection Issues:**
- Check internet connection
- Verify Node.js version (20.0.0+)
- Install FFmpeg for media processing

**Plugin Errors:**
- Check plugin syntax
- Verify import statements
- Review error logs

### FAQ & Support

For detailed troubleshooting and frequently asked questions, visit our support page:
https://vinsmoke-ten.vercel.app/faq

## Development

### Prerequisites
- Node.js v20.0.0 or higher
- FFmpeg (for media processing)
- Git
- pm2

### Debug Mode
```bash
# Track messages for debugging
.track 10

# Check bot status
.status

# View response
.ping
```

### Contributing
1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## Resources

- **Session Generator**: https://vinsmoke-ten.vercel.app/session
- **Plugin Library**: https://vinsmoke-ten.vercel.app/plugins
- **FAQ**: https://vinsmoke-ten.vercel.app/faq
- **Support**: https://vinsmoke-ten.vercel.app/support
- **GitHub Issues**: https://github.com/manjisama1/vinsmoke/issues

## Credits

Special thanks to:
- **[Baileys](https://github.com/WhiskeySockets/Baileys)** - The amazing WhatsApp Web API library that powers this bot
- **[WhiskeySockets](https://github.com/WhiskeySockets)** - For maintaining and developing Baileys
- All contributors and the open-source community

## License

This project is licensed under the MIT License.

---

<div align="center">

**Developed by [manjisama1](https://github.com/manjisama1)**

Star this repository if you find it useful

</div>