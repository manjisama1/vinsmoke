# WhatsApp Bot Plugin Development Guide

## Basic Plugin Structure

```javascript
import { Command, lang, config } from '../lib/index.js';

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

## Command Configuration

| Property | Type | Description |
|----------|------|-------------|
| `pattern` | string | Command pattern with optional regex `?(.*)`  |
| `aliases` | array | Alternative command names |
| `desc` | string | Command description |
| `type` | string | Category (general, media, group, etc.) |
| `sudo` | boolean | Requires sudo access |
| `group` | boolean | Group chats only |
| `pm` | boolean | Private messages only |
| `react` | boolean/string | Auto-react: true (default), false (none), or '🤡' (custom emoji) |
| `fromMe` | boolean | Bot owner only |
| `owner` | boolean | Bot owner only |
| `botOnly` | boolean | Bot-specific restriction |

## Message Object Properties

### Basic Properties
```javascript
message.text          // Message text content
message.chat          // Chat JID
message.sender        // Sender JID
message.isGroup       // true if group chat
message.isPrivate     // true if private chat
message.fromMe        // true if sent by bot
message.isSudo        // true if sender is sudo user
message.name          // Sender's name
message.args          // Command arguments array
message.command       // Parsed command name
```

### Media Properties
```javascript
message.hasMedia      // true if message has media
message.type          // 'text', 'image', 'video', 'audio', 'sticker', 'document'
message.image         // true if image
message.video         // true if video
message.audio         // true if audio
message.sticker       // sticker object or null
message.document      // document object or null
message.mimetype      // Media MIME type
message.filename      // File name
message.filesize      // File size in bytes
```

### Quoted Message
```javascript
message.quoted        // Quoted message object
message.quoted.text   // Quoted message text
message.quoted.type   // Quoted message type
message.quoted.sender // Quoted message sender
message.quoted.image  // true if quoted message is image
// ... other media properties available on quoted
```

## Sending Messages

### Text Messages
```javascript
// Simple text
await message.send('Hello World!');

// Reply to message
await message.reply('This is a reply');

// Send to specific chat
await message.send('Hello', {}, 'chatid@g.us');
```

### Media Messages
```javascript
// Send image
await message.send({ 
    image: buffer,
    caption: 'Image caption' 
});

// Send video
await message.send({ 
    video: buffer,
    caption: 'Video caption',
    gifPlayback: true  // for GIF
});

// Send audio
await message.send({ 
    audio: buffer,
    ptt: true  // voice note
});

// Send sticker
await message.send({ 
    sticker: buffer 
});

// Send document
await message.send({ 
    document: buffer,
    fileName: 'file.pdf',
    mimetype: 'application/pdf'
});
```

### Advanced Message Options
```javascript
// With mentions
await message.send('Hello @user', { 
    mentions: ['user@s.whatsapp.net'] 
});

// Ephemeral message
await message.sendEphemeral('Secret message', '7d');

// Edit message
await message.edit('Updated text');

// React to message
await message.react('👍');

// Delete message
await message.delete();

// Forward message
await message.forward('targetchat@g.us');
```

## Media Download
```javascript
// Download media as buffer
const buffer = await message.download();

// Download quoted media
const quotedBuffer = await message.quoted.download();

// Download to file
const filePath = await message.download('path');
```

## Group Management (via manji)

```javascript
// Check if bot is admin
const isBotAdmin = await manji.isBotAdmin(message.chat);

// Check if user is admin
const isUserAdmin = await message.admin();

// Group actions (requires bot admin)
await manji.kick(message.chat, 'user@s.whatsapp.net');
await manji.add(message.chat, 'user@s.whatsapp.net');
await manji.promote(message.chat, 'user@s.whatsapp.net');
await manji.demote(message.chat, 'user@s.whatsapp.net');
```

## Event Listeners

### Listen to All Messages
```javascript
Listen({
    on: 'text',           // Message type filter
    group: true,          // Group only
    fromMe: false         // Not from bot
}, async (message) => {
    // Handle message
});
```

### Tracker System
```javascript
import { Tracker } from '../lib/index.js';

// Register tracker
const trackerId = Tracker.register(
    (msg) => msg.type === 'sticker',  // Filter function
    async (msg) => {
        // Handle sticker
    }
);

// Unregister tracker
Tracker.unregister(trackerId);
```

## Utility Functions

### Available Imports
```javascript
import { 
    Command,           // Command registration
    lang,             // Language strings
    config,           // Bot configuration
    Manji,            // Bot utilities
    Tracker,          // Message tracking
    sticker,          // Sticker creation
    downloadMedia,    // Media download
    webpToImage,      // Convert webp to image
    // ... many more utilities
} from '../lib/index.js';
```

### Language Strings
```javascript
// Use predefined language strings
await message.send(lang.plugins.ping.desc);

// Format with parameters
const formatted = lang.plugins.status.template.format(
    uptime, mode, prefix
);
```

### Configuration Access
```javascript
const prefix = config.PREFIX;
const botMode = config.BOT_MODE;
const sudoUsers = config.SUDO;
```

## Example Plugins

### Simple Command
```javascript
import { Command } from '../lib/index.js';

Command({
    pattern: 'hello ?(.*)',
    desc: 'Say hello',
    type: 'fun',
    react: true  // Bot will react to command
}, async (message, match) => {
    const name = match || 'World';
    await message.reply(`Hello ${name}!`);
});
```

### No React Command
```javascript
import { Command } from '../lib/index.js';

Command({
    pattern: 'silent ?(.*)',
    desc: 'Silent command without reaction',
    type: 'utility',
    react: false  // No auto-reaction
}, async (message, match) => {
    await message.send('This command runs silently');
});
```

### Custom Emoji React
```javascript
import { Command } from '../lib/index.js';

Command({
    pattern: 'fun ?(.*)',
    desc: 'Fun command with custom reaction',
    type: 'fun',
    react: '🎉'  // Custom emoji reaction
}, async (message, match) => {
    await message.send('Party time! 🎊');
});
```

### Media Processing
```javascript
import { Command, sticker } from '../lib/index.js';

Command({
    pattern: 'sticker',
    desc: 'Create sticker from image',
    type: 'media'
}, async (message) => {
    if (!message.image && !message.quoted?.image) {
        return await message.send('Reply to an image');
    }
    
    const stickerBuffer = await sticker(message.raw);
    await message.send({ sticker: stickerBuffer });
});
```

### Group Management
```javascript
import { Command } from '../lib/index.js';

Command({
    pattern: 'kick',
    desc: 'Kick user from group',
    type: 'group',
    group: true,  // Group chats only
    react: true   // React to show command received
}, async (message, match, manji) => {
    if (!await manji.isBotAdmin(message.chat)) {
        return await message.send('Bot needs admin rights');
    }
    
    if (!await message.admin()) {
        return await message.send('You need admin rights');
    }
    
    const targetUser = message.mention[0] || message.quoted?.sender;
    if (!targetUser) {
        return await message.send('Mention or reply to user');
    }
    
    await manji.kick(message.chat, targetUser);
    await message.send('User kicked');
});
```

### Owner Only Command
```javascript
import { Command } from '../lib/index.js';

Command({
    pattern: 'restart',
    desc: 'Restart the bot',
    type: 'system',
    owner: true,  // Bot owner only
    react: false  // Silent execution
}, async (message) => {
    await message.send('Restarting bot...');
    process.exit(0);
});
```

### Background Process
```javascript
import { Command, Tracker } from '../lib/index.js';

let autoReply = { active: false, trackerId: null };

Command({
    pattern: 'autoreply ?(on|off)',
    desc: 'Toggle auto reply',
    type: 'utility'
}, async (message, match) => {
    if (match === 'on') {
        autoReply.active = true;
        autoReply.trackerId = Tracker.register(
            (msg) => msg.text?.includes('hello') && !msg.fromMe,
            async (msg) => {
                if (autoReply.active) {
                    await msg.reply('Hello! How can I help?');
                }
            }
        );
        await message.send('Auto reply enabled');
    } else if (match === 'off') {
        autoReply.active = false;
        if (autoReply.trackerId) {
            Tracker.unregister(autoReply.trackerId);
        }
        await message.send('Auto reply disabled');
    }
});
```

## Best Practices

1. **Always validate inputs** before processing
2. **Check permissions** for group commands
3. **Handle errors gracefully** with try-catch
4. **Use early returns** to avoid deep nesting
5. **Clean up resources** (trackers, intervals) when done
6. **Test thoroughly** before sharing
7. **Use appropriate reactions** - custom emojis for specific commands

## React System Options

```javascript
// Default reaction (uses bot config emoji)
react: true

// No reaction
react: false  

// Custom emoji reaction
react: '🤡'    // Any emoji
react: '⚡'    // Lightning for fast commands
react: '🔧'    // Tools for utility commands
react: '🎮'    // Games for fun commands
```

## Common Patterns

### Input Validation
```javascript
if (!match?.trim()) {
    return await message.send('Please provide input');
}
```

### Permission Checks
```javascript
if (message.isGroup && !await message.admin()) {
    return await message.send('Admin only command');
}
```

### Error Handling
```javascript
try {
    // Your code here
} catch (error) {
    await message.send('Something went wrong');
    console.error(error);
}
```

This guide covers the essential patterns for creating WhatsApp bot plugins. Copy this to GPT and ask for specific plugin implementations!