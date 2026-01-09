import { Command, lang, config, calculate, Translate } from '../lib/index.js';
const tr = new Translate();


Command({
    pattern: 'calculate ?(.*)',
    aliases: ['calc', 'c'],
    desc: lang.plugins.calculate.desc,
    type: 'tools'
}, async (message, match) => {
    if (!match) return message.send(lang.plugins.calculate.usage.format(config.PREFIX));
    
    const expr = match.trim();
    const result = calculate(expr);
    
    await message.send(lang.plugins.calculate.result.format(expr, result));
});

Command({
    pattern: 'discount ?(.*)',
    aliases: ['dis'],
    desc: lang.plugins.discount.desc,
    type: 'tools'
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
    type: 'tools'
}, async (message, match) => {
    if (!match) return message.send(lang.plugins.percentage.usage.format(config.PREFIX));
    
    const args = match.trim().split(' ');
    const total = parseFloat(args[0]);
    const part = parseFloat(args[1]);
    
    if (isNaN(total) || isNaN(part)) return message.send(lang.plugins.percentage.usage.format(config.PREFIX));
    
    const percentage = (part / total) * 100;
    
    await message.send(lang.plugins.percentage.result.format(part, total, percentage.toFixed(2)));
});

Command({
    pattern: 'translate ?(.*)',
    aliases: ['trt'],
    desc: lang.plugins.translate.desc,
    type: 'tools'
}, async (message, match) => {
    let from = 'auto', to = 'en', targetText = message.quoted?.text || match;

    if (!targetText) return await message.reply(lang.plugins.translate.no_text);

    const args = match?.split(' ');
    const firstArg = args?.[0];

    if (match) {
        firstArg?.includes('-') 
            ? ([from, to] = firstArg.split('-'), targetText = args.slice(1).join(' ') || message.quoted?.text || targetText)
            : firstArg?.length === 2 
                ? (to = firstArg, targetText = args.slice(1).join(' ') || message.quoted?.text || targetText) 
                : null;
    }

    if (!targetText || (targetText === firstArg && firstArg.includes('-'))) 
        return await message.reply(lang.plugins.translate.no_target);

    const result = await tr.exec(targetText, { from, to });
    await message.reply(result);
});