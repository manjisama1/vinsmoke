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

**A powerful, feature-rich WhatsApp bot built with Baileys**

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Bot-25D366?logo=whatsapp)](https://whatsapp.com/)
[![Baileys](https://img.shields.io/badge/Baileys-6.7.20-blue)](https://github.com/WhiskeySockets/Baileys)

</div>

## ✨ Features

### 🎯 **Core Features**
- **Multi-Device Support** - Works with WhatsApp Web multi-device
- **QR & Pairing Code** - Flexible authentication methods
- **Plugin System** - Modular architecture with hot-reload
- **Multi-Language** - Internationalization support
- **Auto-Reconnect** - Robust connection handling
- **Permission System** - Sudo users and role-based access

### 🛡️ **Group Management**
- **Admin Controls** - Promote, demote, kick, add members
- **Anti-Link Protection** - Configurable link filtering with warnings
- **Anti-Word Filter** - Bad word detection and moderation
- **User Banning** - Temporary and permanent ban system
- **Join Request Management** - Accept/reject group join requests
- **Group Settings** - Mute, unmute, disappearing messages
- **Mention Tools** - Tag all members, admins, or non-admins

### 🎨 **Media & Stickers**
- **Sticker Creation** - Convert images/videos to stickers with custom metadata
- **Sticker Tools** - Take, crop, and modify existing stickers
- **Media Conversion** - Convert stickers to images/videos
- **View-Once Bypass** - Reveal and save view-once media
- **Auto-Sticker Steal** - Automatically steal stickers from groups
- **Pinterest Integration** - Download images and create stickers from Pinterest

### 🎵 **Media Downloads**
- **Spotify Downloader** - Download songs from Spotify links
- **Instagram Downloader** - Download videos from Instagram
- **Telegram Stickers** - Import sticker packs from Telegram
- **Media Processing** - Advanced media handling with FFmpeg

### 🔧 **Utility Tools**
- **Number Checker** - Verify WhatsApp numbers and get profile info
- **JID Tools** - Get JIDs from users, groups, and invite links
- **Message Tools** - Star, delete, and manage messages
- **Profile Management** - Update bot and group profiles

### 👑 **Owner Features**
- **Variable Management** - Dynamic configuration system
- **Sudo Management** - Add/remove sudo users
- **Bot Control** - Restart, status monitoring, and system info
- **Profile Updates** - Change bot name, bio, and profile picture
- **Debug Tools** - Message tracking and debugging utilities

## 🚀 Quick Start

### Prerequisites
- **Node.js** v20.0.0 or higher
- **FFmpeg** (for media processing)
- **Git** (for cloning)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/manjisama1/vinsmoke.git
   cd vinsmoke
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure the bot**
   ```bash
   cp config.env.example config.env
   # Edit config.env with your settings
   ```

4. **Start the bot**
   ```bash
   npm start
   ```

### Authentication Methods

#### Method 1: QR Code (Default)
```env
QR=true
```
- Scan the QR code with WhatsApp
- Go to **WhatsApp > Linked Devices > Link a Device**

#### Method 2: Pairing Code
```env
QR=false
BOT_NUM=1234567890  # Your phone number without +  
```
- Enter the pairing code in WhatsApp
- Go to **WhatsApp > Linked Devices > Link a Device**

## ⚙️ Configuration

### Basic Configuration (`config.env`)

```env
# Bot Settings
PREFIX=.                    # Command prefix
BOT_MODE=private           # Bot mode: public/private
SUDO=null                  # Sudo users (comma-separated)
BOT_LANG=en               # Language code

# Connection
QR=true                   # Use QR code (true) or pairing code (false)
BOT_NUM=null              # Phone number for pairing code method

# Features
AUTO_READ=false           # Auto-read messages
AUTO_STATUS_READ=false    # Auto-read status updates
ALWAYS_ONLINE=false       # Keep bot always online

# Stickers
STICKER_PACK=𝐕𝐈𝐍𝐒𝐌𝐎𝐊𝐄  # Default sticker pack name
```

#### Custom Plugins
Place custom plugins in the `mPlugins/` directory:
```javascript
// mPlugins/my-plugin.js
import { Command } from '../lib/index.js';

Command({
    pattern: 'hello',
    desc: 'Say hello',
    type: 'misc'
}, async (message) => {
    await message.send('Hello World!');
});
```


## 🏗️ Architecture

### Project Structure
```
vinsmoke/
├── lib/                    # Core library files
│   ├── bot.js             # Main bot class
│   ├── client.js          # WhatsApp client wrapper
│   ├── message.js         # Message handling and utilities
│   ├── config.js          # Configuration management
│   ├── plugin-manager.js  # Plugin system
│   └── index.js           # Library exports
├── plugins/               # Built-in plugins
│   ├── general.js         # General commands
│   ├── group.js           # Group management
│   ├── media.js           # Media handling
│   ├── sticker.js         # Sticker tools
│   └── owner.js           # Owner commands
├── mPlugins/        # Custom user plugins
├── lang/                  # Language files
│   └── en.json           # English translations
├── session/              # WhatsApp session data
├── media/                # Temporary media files
└── config.env            # Configuration file
```

### Plugin System
Vinsmoke uses a modular plugin architecture:

```javascript
import { Command } from '../lib/index.js';

Command({
    pattern: 'example ?(.*)',    // Command pattern (regex)
    aliases: ['ex', 'demo'],     // Alternative names
    desc: 'Example command',     // Description
    type: 'utility',            // Category
    sudo: false,                // Requires sudo
    group: false,               // Group only
    private: false,             // Private only
    react: true                 // Auto-react with ⏳
}, async (message, match) => {
    // Command logic here
    await message.send('Hello from plugin!');
});
```

### Message Object
The enhanced message object provides extensive functionality:

```javascript
// Basic properties
message.text           // Message text
message.sender         // Sender JID
message.isGroup        // Is group message
message.isPrivate      // Is private message
message.fromMe         // Is from bot

// Media detection
message.image          // Is image
message.video          // Is video
message.sticker        // Sticker object with isAnimated
message.quoted         // Quoted message

// Utilities
message.send()         // Send message
message.reply()        // Reply to message
message.react()        // React to message
message.delete()       // Delete message
message.forward()      // Forward message
```

## 🔧 Development

### Adding Custom Commands
1. Create a new file in `mPlugins/`
2. Use the Command wrapper to define your command
3. The bot will automatically load it on startup

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

### Debugging

Use the track command to monitor raw messages:
```
.track 10  # Track next 10 messages
```

## 🛠️ Troubleshooting

### Common Issues

#### Connection Problems
- **QR Code not appearing**: Check if `QR=true` in config
- **Pairing code not working**: Verify `BOT_NUM` format (no + or spaces)
- **Frequent disconnections**: Check internet connection and WhatsApp Web status

#### Plugin Issues
- **Commands not working**: Check if plugin files are in correct directory
- **Permission errors**: Verify sudo settings and user permissions
- **Media processing fails**: Ensure FFmpeg is installed and accessible

#### Performance Issues
- **High memory usage**: Restart bot periodically or check for memory leaks
- **Slow responses**: Check database connection and server resources

### Getting Help
- Check the [Issues](https://github.com/manjisama1/vinsmoke/issues) page
- Join our [Support Group](https://chat.whatsapp.com/your-group-link)
- Read the [Wiki](https://github.com/manjisama1/vinsmoke/wiki) for detailed guides


## 🙏 Acknowledgments

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API

## 📞 Support

- **Developer**: [manjisama1](https://github.com/manjisama1)
- **Issues**: [GitHub Issues](https://github.com/manjisama1/vinsmoke/issues)
- **Discussions**: [GitHub Discussions](https://github.com/manjisama1/vinsmoke/discussions)

---

<div align="center">

**Made with ❤️ by [manjisama1](https://github.com/manjisama1)**

⭐ **Star this repo if you found it helpful!**

</div>