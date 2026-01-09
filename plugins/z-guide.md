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
message.type          // 'text', 'image', 'video', 'audio', 'sticker', 'document', 'poll', etc.
message.image         // true if image
message.video         // true if video
message.audio         // true if audio
message.sticker       // sticker object or null
message.document      // document object or null
message.poll          // true if poll message
message.event         // true if event message
message.reaction      // true if reaction message
message.contact       // true if contact message
message.location      // true if location message
message.interactive   // true if interactive message
message.liveLocation  // true if live location
message.order         // true if business order
message.payment       // true if payment message
message.invoice       // true if invoice message
message.product       // true if product message
message.groupInvite   // true if group invite
message.voice         // true if voice note
message.gif           // true if GIF video
message.viewOnce      // true if view once media
message.ephemeral     // true if ephemeral message
message.mimetype      // Media MIME type
message.filename      // File name
message.filesize      // File size in bytes
message.caption       // Media caption
```

### Quoted Message
```javascript
message.quoted        // Quoted message object
message.quoted.text   // Quoted message text
message.quoted.type   // Quoted message type
message.quoted.sender // Quoted message sender (JID format)
message.quoted.jid    // Quoted message sender JID
message.quoted.lid    // Quoted message sender LID
message.quoted.fromMe // true if quoted message from bot
message.quoted.chat   // Quoted message chat
message.quoted.id     // Quoted message ID
message.quoted.key    // Advanced WhatsApp key structure
// All media properties available on quoted messages
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
// Poll message
await message.send({
    poll: 'Choose option',
    values: ['Option 1', 'Option 2'],
    selectableCount: 1
});

// Contact message
await message.send({
    contacts: {
        name: 'Contact Name',
        vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:Name\nTEL:+1234567890\nEND:VCARD'
    }
});

// Location message
await message.send({
    location: {
        lat: 40.7128,
        lng: -74.0060,
        name: 'New York',
        address: 'New York, NY, USA'
    }
});

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

### Listen to All Messages (Special & Powerful)
```javascript
Listen({
    on: 'text',           // Message type filter
    group: true,          // Group only
    fromMe: false         // Not from bot
}, async (message) => {
    // Handle message
});
```

**⚠️ WARNING: Use Listen Carefully**
- Listen bypasses private mode and sudo restrictions
- **DO NOT** create command-like functionality with Listen
- Everyone can trigger Listen handlers
- Use Listen for: auto-tasks, variable updates, logging, monitoring
- Use Command for: user-triggered actions with proper permissions

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

### Poll Command Example
```javascript
import { Command } from '../lib/index.js';

Command({
    pattern: 'poll ?(.*)',
    desc: 'Create a poll',
    type: 'utility'
}, async (message, match) => {
    if (!match) return await message.send('Usage: poll question|option1|option2');
    
    const parts = match.split('|');
    if (parts.length < 3) return await message.send('Need question and 2+ options');
    
    const [question, ...options] = parts;
    await message.send({
        poll: question.trim(),
        values: options.map(opt => opt.trim()),
        selectableCount: 1
    });
});
```

### Enhanced Quoted Message Handling
```javascript
import { Command } from '../lib/index.js';

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
        `ID: ${target.id}`,
        target.quoted ? `LID: ${target.lid}` : ''
    ].filter(Boolean).join('\n'));
});
```

## Message Type Detection

```javascript
// Media types
if (message.image) { /* handle image */ }
if (message.video) { /* handle video */ }
if (message.audio) { /* handle audio */ }
if (message.sticker) { /* handle sticker */ }
if (message.document) { /* handle document */ }
if (message.poll) { /* handle poll */ }
if (message.contact) { /* handle contact */ }
if (message.location) { /* handle location */ }
if (message.voice) { /* handle voice note */ }
if (message.gif) { /* handle GIF */ }

// Business types
if (message.order) { /* handle business order */ }
if (message.payment) { /* handle payment */ }
if (message.invoice) { /* handle invoice */ }
if (message.product) { /* handle product */ }

// Other types
if (message.reaction) { /* handle reaction */ }
if (message.event) { /* handle event */ }
if (message.groupInvite) { /* handle group invite */ }
if (message.viewOnce) { /* handle view once media */ }
```

## Best Practices

1. **Always validate inputs** before processing
2. **Check permissions** for group commands
3. **Handle errors gracefully** with try-catch
4. **Use early returns** to avoid deep nesting
5. **Clean up resources** (trackers, intervals) when done
6. **Test thoroughly** before sharing
7. **Use appropriate reactions** - custom emojis for specific commands
8. **⚠️ Listen vs Command**: Use Listen for background tasks only, not user commands

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