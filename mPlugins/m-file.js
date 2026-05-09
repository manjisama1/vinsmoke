// Gist: https://gist.github.com/manjisama1/53439347dd2daaab497b2a912b33953f
import { Command, downLoad } from '../lib/index.js';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve();

const FSM = {
    resolve(input) {
        if (!input) return ROOT;
        const target = input.startsWith('~') ? path.join(ROOT, input.slice(1)) : path.join(ROOT, input);
        const resolved = path.resolve(target);
        return resolved.startsWith(ROOT) ? resolved : null;
    },

    formatListing(dir, flags) {
        const items = fs.readdirSync(dir);
        const showHidden = flags.includes('-a');
        const recursive = flags.includes('-r');

        let output = `Directory: ${dir.replace(ROOT, '~')}\n\n`;
        
        const list = (currentDir, prefix = '', isRecursive = false) => {
            const files = fs.readdirSync(currentDir);
            let str = '';

            const filtered = showHidden ? files : files.filter(f => !f.startsWith('.'));

            filtered.forEach((file, index) => {
                const isLast = index === filtered.length - 1;
                const fullPath = path.join(currentDir, file);
                const stats = fs.statSync(fullPath);
                const isDir = stats.isDirectory();

                str += `${prefix}${isLast ? '└── ' : '├── '}${file}${isDir ? '/' : ''}\n`;

                if (isRecursive && isDir) {
                    str += list(fullPath, `${prefix}${isLast ? '    ' : '│   '}`, true);
                }
            });
            return str;
        };

        return output + (list(dir, '', recursive) || 'Empty directory');
    }
};

Command({
    pattern: 'file ?(.*)',
    desc: 'Professional File System Manager',
    type: 'utility',
    sudo: true
}, async (message, match) => {
    // FIX: Add null coalescing check for match
    const input = match || ""; 
    const args = input.trim().split(/\s+/);
    
    // If no sub-command is provided, show usage
    const cmd = args[0]?.toLowerCase();
    if (!cmd || cmd === "") {
        return await message.send('Usage: .file <get|add|rename|view|make|rm|ls> [flags] <path>');
    }

    const flags = args.filter(a => a.startsWith('-'));
    const params = args.filter(a => !a.startsWith('-')).slice(1);
    
    // Resolve target path (default to ROOT if no path provided)
    const target = FSM.resolve(params[0] || "");

    if (!target) return await message.send('Error: Access Denied or Path Invalid');

    switch (cmd) {
        case 'ls':
        case 'tree':
            if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
                return await message.send('Error: Target is not a directory');
            }
            const treeView = FSM.formatListing(target, flags);
            return await message.send(`\`\`\`\n${treeView}\n\`\`\``.slice(0, 4000));

        case 'get':
            if (!fs.existsSync(target)) return await message.send('Error: Not found');
            // Sending file as a document
            return await message.send({ 
                document: fs.readFileSync(target), 
                fileName: path.basename(target),
                mimetype: 'application/octet-stream' 
            });

        case 'add':
            if (!message.quoted && !message.hasMedia) {
                return await message.send('Error: Please reply to a media/file or upload one.');
            }
            try {
                const dl = await downLoad(message.raw, "buffer_info");
                const finalPath = fs.existsSync(target) && fs.statSync(target).isDirectory() 
                    ? path.join(target, dl.fileName || 'file') : target;
                
                if (flags.includes('-b') && fs.existsSync(finalPath)) {
                    fs.renameSync(finalPath, `${finalPath}.${Date.now()}.bak`);
                }
                
                if (fs.existsSync(finalPath) && !flags.includes('-f') && !flags.includes('-b')) {
                    return await message.send('Error: File exists. Use -f to overwrite or -b to backup.');
                }

                fs.mkdirSync(path.dirname(finalPath), { recursive: true });
                fs.writeFileSync(finalPath, dl.buffer);
                return await message.send(`Success: Saved to ${finalPath.replace(ROOT, '~')}`);
            } catch (e) { 
                return await message.send(`Error: ${e.message}`); 
            }

        case 'view':
            if (!fs.existsSync(target)) return await message.send('Error: Not found');
            try {
                let lines = fs.readFileSync(target, 'utf-8').split('\n');
                if (flags.includes('-l')) {
                    const lIndex = args.indexOf('-l');
                    const range = args[lIndex + 1]?.split('-').map(Number) || [1, 50];
                    lines = lines.slice(range[0] - 1, range[1] || range[0] + 50);
                }
                return await message.send(`\`\`\`\n${lines.join('\n').slice(0, 4000)}\n\`\`\``);
            } catch (e) {
                return await message.send('Error: Could not read file as text.');
            }

        case 'rm':
            if (!fs.existsSync(target)) return await message.send('Error: Path does not exist');
            fs.rmSync(target, { recursive: true, force: true });
            return await message.send('Success: Deleted');

        case 'rename':
            if (params.length < 2) return await message.send('Usage: .file rename <old> <new>');
            const dest = FSM.resolve(params[1]);
            if (!dest) return await message.send('Error: Invalid destination');
            fs.renameSync(target, dest);
            return await message.send('Success: Moved/Renamed');

        default:
            return await message.send('Error: Unknown sub-command');
    }
});