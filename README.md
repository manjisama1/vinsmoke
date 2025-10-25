# 🚀 VINSMOKE - WhatsApp Bot

<div align="center">

```
██╗   ██╗██╗███╗   ██╗███████╗███╗   ███╗ ██████╗ ██╗  ██╗███████╗
██║   ██║██║████╗  ██║██╔════╝████╗ ████║██╔═══██╗██║ ██╔╝██╔════╝
██║   ██║██║██╔██╗ ██║███████╗██╔████╔██║██║   ██║█████╔╝ █████╗  
╚██╗ ██╔╝██║██║╚██╗██║╚════██║██║╚██╔╝██║██║   ██║██╔═██╗ ██╔══╝  
 ╚████╔╝ ██║██║ ╚████║███████║██║ ╚═╝ ██║╚██████╔╝██║  ██╗███████╗
  ╚═══╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝
```

**Advanced WhatsApp bot built with Baileys**

[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Bot-25D366?logo=whatsapp)](https://whatsapp.com/)
[![Baileys](https://img.shields.io/badge/Baileys-6.7.20-blue)](https://github.com/WhiskeySockets/Baileys)

</div>

## ✨ Features

- 🎯 **Multi-Device Support** - QR & Pairing code authentication
- 🛡️ **Group Management** - Admin controls, anti-link, anti-word, banning system
- 🎨 **Media Tools** - Sticker creation, view-once bypass, auto-steal
- 🎵 **Downloads** - Spotify, Instagram, Pinterest, Telegram stickers
- 🔧 **Utilities** - Fancy text, number checker, message tools
- 👑 **Owner Features** - Variable management, sudo system, bot control

## 🚀 Quick Start

### Installation
```bash
git clone https://github.com/manjisama1/vinsmoke.git
cd vinsmoke
npm install
cp config.env.example config.env
# Edit config.env with your settings
npm start
```

### Authentication
**QR Code (Default):**
```env
QR=true
```

**Pairing Code:**
```env
QR=false
BOT_NUM=1234567890
```

## ⚙️ Configuration

```env
PREFIX=.                    # Command prefix
BOT_MODE=private           # Bot mode: public/private
SUDO=null                  # Sudo users (comma-separated)
QR=true                   # Use QR code or pairing code
BOT_NUM=null              # Phone number for pairing
AUTO_READ=false           # Auto-read messages
STICKER_PACK=𝐕𝐈𝐍𝐒𝐌𝐎𝐊𝐄  # Default sticker pack
```

## 🏗️ Plugin System

Create custom plugins in `mPlugins/`:

```javascript
import { Command } from '../lib/index.js';

Command({
    pattern: 'hello',
    desc: 'Say hello',
    type: 'misc'
}, async (message) => {
    await message.send('Hello World!');
});
```

## 📁 Project Structure

```
vinsmoke/
├── lib/           # Core library
├── plugins/       # Built-in plugins
├── mPlugins/      # Custom plugins
├── lang/          # Language files
├── session/       # WhatsApp session
└── config.env     # Configuration
```

## 🔧 Development

**Debug messages:**
```
.track 10  # Track next 10 messages
```

**Prerequisites:**
- Node.js v20.0.0+
- FFmpeg (for media processing)

## 📞 Support

- **Developer**: [manjisama1](https://github.com/manjisama1)
- **Issues**: [GitHub Issues](https://github.com/manjisama1/vinsmoke/issues)

---

<div align="center">

**Made with ❤️ by [manjisama1](https://github.com/manjisama1)**

⭐ **Star this repo if you found it helpful!**

</div>