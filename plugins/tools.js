import { Command, lang, config } from '../lib/index.js';

const calc = (expr) => {
    try {
        const clean = expr
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/√(\d+)/g, 'Math.sqrt($1)')
            .replace(/(\d+)\^(\d+)/g, 'Math.pow($1,$2)')
            .replace(/(\d+)²/g, 'Math.pow($1,2)')
            .replace(/π/g, 'Math.PI')
            .replace(/sin\(([^)]+)\)/g, 'Math.sin($1)')
            .replace(/cos\(([^)]+)\)/g, 'Math.cos($1)')
            .replace(/tan\(([^)]+)\)/g, 'Math.tan($1)')
            .replace(/log\(([^)]+)\)/g, 'Math.log10($1)')
            .replace(/ln\(([^)]+)\)/g, 'Math.log($1)');
        
        if (!/^[0-9+\-*/.()Mathsincotanlgpwr\s,]+$/.test(clean)) throw new Error('Invalid');
        
        const result = Function(`"use strict"; return (${clean})`)();
        return isFinite(result) ? result : 'Error';
    } catch {
        return 'Invalid expression';
    }
};

Command({
    pattern: 'calculate ?(.*)',
    aliases: ['calc', 'c'],
    desc: lang.plugins.calculate.desc,
    type: 'utility'
}, async (message, match) => {
    if (!match) return message.send(lang.plugins.calculate.usage.format(config.PREFIX));
    
    const result = calc(match.trim());
    const expr = match.trim();
    
    await message.send(lang.plugins.calculate.result.format(expr, result));
});

Command({
    pattern: 'discount ?(.*)',
    aliases: ['dis'],
    desc: lang.plugins.discount.desc,
    type: 'utility'
}, async (message, match) => {
    if (!match) return message.send(lang.plugins.discount.usage.format(config.PREFIX));
    
    const args = match.trim().split(' ');
    const price = parseFloat(args[0]);
    const discount = parseFloat(args[1]);
    
    if (isNaN(price) || isNaN(discount)) return message.send(lang.plugins.discount.usage);
    
    const discountAmount = (price * discount) / 100;
    const finalPrice = price - discountAmount;
    
    await message.send(lang.plugins.discount.result.format(price, discount, discountAmount, finalPrice));
});

Command({
    pattern: 'percentage ?(.*)',
    aliases: ['per'],
    desc: lang.plugins.percentage.desc,
    type: 'utility'
}, async (message, match) => {
    if (!match) return message.send(lang.plugins.percentage.usage.format(config.PREFIX));
    
    const args = match.trim().split(' ');
    const total = parseFloat(args[0]);
    const part = parseFloat(args[1]);
    
    if (isNaN(total) || isNaN(part)) return message.send(lang.plugins.percentage.usage.format(config.PREFIX));
    
    const percentage = (part / total) * 100;
    
    await message.send(lang.plugins.percentage.result.format(part, total, percentage.toFixed(2)));
});