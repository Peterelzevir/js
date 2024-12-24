const TelegramBot = require('node-telegram-bot-api');
const token = '7804320004:AAHWaYDm-CJ7fAur-_S7CxIBehrmVn45u1w';
const bot = new TelegramBot(token, {polling: true});
const os = require('os');
const startTime = Date.now();

// Format duration function
function formatUptime(uptime) {
    const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
    const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((uptime % (60 * 1000)) / 1000);
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Command handler for /start or .start
bot.onText(/^[\/\.]start$/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || 'user';
    
    try {
        await bot.sendPhoto(chatId, 'hiyaok.png', {
            caption: `*halo ka* @${username} _aku adalah bot asisten_ @hiyaok\n\n` +
                    `\`click button dibawah ini untuk bantuan\`\n\n` +
                    `[@asistenhiyaokbot](https://t.me/asistenhiyaokbot)`,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👀 Bantuan', callback_data: 'bantuan' }],
                    [{ text: '💳 Payment', callback_data: 'payment' }],
                    [{ text: '💡 Status Bot', callback_data: 'status' }]
                ]
            }
        });
    } catch (error) {
        console.error('Error sending photo:', error);
    }
});

// Callback query handler
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const username = callbackQuery.from.username || 'user';
    
    switch(callbackQuery.data) {
        case 'bantuan':
            try {
                await bot.editMessageCaption(
                    `*halo ka* @${username} _mungkin saat ini_ @hiyaok _sedang sibuk, chat kamu sudah di sampaikan dan akan segera di balas secepatnya, terimakasih sudah menunggu_\n\n` +
                    `[@asistenhiyaokbot](https://t.me/asistenhiyaokbot)`,
                    {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '🔙', callback_data: 'back' }
                            ]]
                        }
                    }
                );
            } catch (error) {
                console.error('Error editing message:', error);
            }
            break;

        case 'payment':
            try {
                await bot.editMessageMedia({
                    type: 'photo',
                    media: 'qris.png',
                    caption: `✅ *payment* @hiyaok\n\n` +
                            `👉 _jika sudah payment mohon kirimkan screenshot bukti nya kesini ya_\n\n` +
                            `[@asistenhiyaokbot](https://t.me/asistenhiyaokbot)`,
                }, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔙', callback_data: 'back' }
                        ]]
                    }
                });
            } catch (error) {
                console.error('Error editing message:', error);
            }
            break;

        case 'status':
            const uptime = formatUptime(Date.now() - startTime);
            const freeMemory = (os.freemem() / (1024 * 1024 * 1024)).toFixed(2);
            const totalMemory = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2);
            const responseTime = Date.now() - callbackQuery.message.date * 1000;
            
            // Get current time in WIB (UTC+7)
            const currentTime = new Date();
            currentTime.setHours(currentTime.getHours() + 7);
            const timeWIB = currentTime.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

            try {
                await bot.editMessageCaption(
                    `👀 *Bot Status Information*\n\n` +
                    `📊 *Storage Usage:*\n` +
                    `\`🟢 Free: ${freeMemory}GB\n` +
                    `👁‍🗨 Total: ${totalMemory}GB\`\n\n` +
                    `⏱ *Uptime:* \`${uptime}\`\n` +
                    `🚀 *Response Time:* \`${responseTime}ms\`\n` +
                    `🕒 *Current Time (WIB):* \`${timeWIB}\`\n\n` +
                    `[@asistenhiyaokbot](https://t.me/asistenhiyaokbot)`,
                    {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '🔙', callback_data: 'back' }
                            ]]
                        }
                    }
                );
            } catch (error) {
                console.error('Error editing message:', error);
            }
            break;

        case 'back':
            try {
                await bot.editMessageMedia({
                    type: 'photo',
                    media: 'hiyaok.png',
                    caption: `*halo ka* @${username} _aku adalah bot asisten_ @hiyaok\n\n` +
                    `\`click button dibawah ini untuk bantuan\`\n\n` +
                    `[@asistenhiyaokbot](https://t.me/asistenhiyaokbot)`,
                }, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '👀 Bantuan', callback_data: 'bantuan' }],
                            [{ text: '💳 Payment', callback_data: 'payment' }],
                            [{ text: '💡 Status Bot', callback_data: 'status' }]
                        ]
                    }
                });
            } catch (error) {
                console.error('Error editing message:', error);
            }
            break;
    }
});

// Error handling
bot.on('error', (error) => {
    console.error('Telegram bot error:', error);
});

console.log('Bot is running...');
