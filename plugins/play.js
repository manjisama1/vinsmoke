import { Command, manjitube, lang } from '../lib/index.js';
import { listen } from '../lib/listen.js';

// Store active selections for tracking user responses
const activeSelectionsMap = new Map();

Command({
    pattern: 'play ?(.*)',
    desc: lang.plugins.play.desc,
    type: 'media'
}, async (message, match) => {
    const query = match || message.quoted?.text;
    if (!query) {
        return message.send(lang.plugins.play.usage);
    }

    try {
        // Show searching message
        await message.react('🔍');
        await message.send(lang.plugins.play.searching.replace('{0}', query));

        // Search for 10 results
        const results = await manjitube.search(query, 10);
        
        if (!results || results.length === 0) {
            await message.react('❌');
            return message.send(lang.plugins.play.no_results.replace('{0}', query));
        }

        // Create numbered list with song info
        let songList = `🎵 *Choose your song for: "${query}"*\n\n`;
        results.forEach((song, index) => {
            const duration = song.duration || 'Live';
            const views = song.views || '0';
            songList += `*${index + 1}.* ${song.title}\n`;
            songList += `   👤 ${song.author}\n`;
            songList += `   📊 ${views} • ⏱️ ${duration}\n\n`;
        });
        
        songList += `📝 *Reply with a number (1-${results.length}) to select*`;

        // Send the selection message
        const selectionMessage = await message.send(songList);

        // Store selection data for tracking
        const selectionId = `${message.chat}_${message.sender}_${Date.now()}`;
        activeSelectionsMap.set(selectionId, {
            results: results,
            query: query,
            sender: message.sender,
            chat: message.chat,
            timestamp: Date.now(),
            selectionMessage: selectionMessage
        });

        // Set up response listener
        const listenerId = `selection_${selectionId}`;
        
        listen.onMessage(listenerId, async ({ messages, type }) => {
            if (type !== 'notify') return;
            
            for (const msg of messages) {
                // Check if it's from the same chat and sender
                if (msg.key.remoteJid === message.chat && 
                    (msg.key.participant === message.sender || msg.key.remoteJid === message.sender)) {
                    
                    const text = msg.message?.conversation || 
                                msg.message?.extendedTextMessage?.text;
                    
                    if (text && /^\d+$/.test(text.trim())) {
                        const selectedNumber = parseInt(text.trim());
                        const selectionData = activeSelectionsMap.get(selectionId);
                        
                        if (selectionData && selectedNumber >= 1 && selectedNumber <= selectionData.results.length) {
                            const selectedSong = selectionData.results[selectedNumber - 1];
                            
                            // Clean up listener and selection data
                            listen.disconnect(listenerId);
                            activeSelectionsMap.delete(selectionId);
                            
                            // Process the selected song
                            await processSongSelection(message, selectedSong, selectionData.query);
                        }
                    }
                }
            }
        });

        // Auto cleanup after 5 minutes
        setTimeout(() => {
            if (activeSelectionsMap.has(selectionId)) {
                listen.disconnect(listenerId);
                activeSelectionsMap.delete(selectionId);
            }
        }, 5 * 60 * 1000);

        await message.react('🎵');
        
    } catch (error) {
        console.error('[Play Error]:', error.message);
        await message.react('❌');
        return message.send(lang.plugins.play.search_failed.replace('{0}', error.message));
    }
});

// Function to process the selected song
async function processSongSelection(message, selectedSong, originalQuery) {
    try {
        // Show processing message
        const processingText = lang.plugins.play.processing
            .replace('{0}', selectedSong.title)
            .replace('{1}', selectedSong.author)
            .replace('{2}', selectedSong.duration)
            .replace('{3}', selectedSong.views);
        
        await message.send(processingText);
        
        // Download the selected song
        const { path, buffer, title } = await manjitube.download(selectedSong.id, 'audio');
        
        // Create success caption
        const caption = lang.plugins.play.success_caption
            .replace('{0}', title)
            .replace('{1}', selectedSong.author)
            .replace('{2}', selectedSong.duration)
            .replace('{3}', selectedSong.views)
            .replace('{4}', originalQuery);
        
        // Send the audio
        await message.send({
            audio: buffer,
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            caption: caption
        });
        
        // Clean up temp file
        manjitube.cleanup(path);
        
        // React with success
        await message.react('✅');
        
    } catch (error) {
        console.error('[Song Processing Error]:', error.message);
        await message.react('❌');
        const errorText = lang.plugins.play.download_failed
            .replace('{0}', selectedSong.title)
            .replace('{1}', error.message);
        await message.send(errorText);
    }
}

// Command to show active selections (for debugging)
Command({
    pattern: 'selections',
    desc: 'Show active YouTube selections',
    type: 'dev',
    sudo: true
}, async (message) => {
    if (activeSelectionsMap.size === 0) {
        return message.send('📊 No active selections');
    }
    
    let selectionList = '� *Active YouTube Selections:*\n\n';
    let count = 1;
    
    for (const [selectionId, data] of activeSelectionsMap.entries()) {
        const timeAgo = Math.floor((Date.now() - data.timestamp) / 1000);
        selectionList += `${count}. **${data.query}**\n`;
        selectionList += `   👤 ${data.sender.split('@')[0]}\n`;
        selectionList += `   ⏰ ${timeAgo}s ago\n`;
        selectionList += `   🎵 ${data.results.length} songs\n\n`;
        count++;
    }
    
    await message.send(selectionList);
});

// Command to clear all active selections (for debugging)
Command({
    pattern: 'clearselections',
    desc: 'Clear all active YouTube selections',
    type: 'dev',
    sudo: true
}, async (message) => {
    const count = activeSelectionsMap.size;
    
    // Disconnect all listeners
    for (const [selectionId] of activeSelectionsMap.entries()) {
        const listenerId = `selection_${selectionId}`;
        listen.disconnect(listenerId);
    }
    
    // Clear the map
    activeSelectionsMap.clear();
    
    await message.send(`🧹 Cleared ${count} active selections`);
});