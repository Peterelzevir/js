const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// Token from BotFather
const token = '7354627036:AAGwOUhPZz5-bomZcsTw9K_KAZJjzMYRbgk';
const bot = new TelegramBot(token, { polling: true });
const adminId = '5988451717'; // Admin ID

let data = { users: {}, banned: [] }; // Default initialization

// Try reading the data from 'data.json'
try {
    const rawData = fs.readFileSync('data.json', 'utf8');
    data = rawData ? JSON.parse(rawData) : data;
} catch (error) {
    console.error("Error reading or parsing data.json:", error);
}

// Middleware to check banned users
bot.on('message', (msg) => {
    if (data && data.banned && Array.isArray(data.banned) && data.banned.includes(msg.from.id)) {
        bot.sendMessage(msg.chat.id, '❌ Anda telah di-*banned* oleh admin\n\n👀 chat admin now!');
        return;
    }

    // Check for `/start` command
    if (msg.text === '/start') {
        const userId = msg.from.id;
        if (!data.users[userId]) {
            data.users[userId] = { id: userId, gender: null, partner: null };
            saveData();
        }

        bot.sendMessage(
            msg.chat.id,
            `👋 *Selamat datang di Anonymous Chat! ✅*\n\n` +
            `Gunakan perintah berikut untuk memulai:\n` +
            `👉 \`/next\` - Cari pasangan lain 👀\n` +
            `👉 \`/stop\` - Akhiri chat 🙏🏻\n` +
            `👉 \`/setgender\` - Atur gender 😎\n` +
            `👉 \`/help\` - Bantuan 👀`,
            { parse_mode: 'Markdown' }
        );
    }
});

// /setgender command
bot.onText(/\/setgender/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        '⚙️ Pilih gender Anda:',
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👨 Pria', callback_data: 'gender_male' }],
                    [{ text: '👩 Wanita', callback_data: 'gender_female' }],
                ],
            },
        }
    );
});

bot.on('callback_query', (callbackQuery) => {
    const { data, message } = callbackQuery;
    const userId = message.from.id;

    if (data === 'gender_male' || data === 'gender_female') {
        const gender = data === 'gender_male' ? 'Pria' : 'Wanita';
        data.users[userId].gender = gender;
        saveData();
        bot.editMessageText(`✅ Gender Anda telah diatur ke *${gender}*.`, { parse_mode: 'Markdown', chat_id: message.chat.id, message_id: message.message_id });
    }
});

// /next (Cari Pasangan)
bot.onText(/\/next/, async (msg) => {
    const userId = msg.from.id;
    const user = data.users[userId];

    if (user.partner) {
        bot.sendMessage(msg.chat.id, '⚠️ Anda sudah terhubung, gunakan `/stop` untuk mengakhiri.');
        return;
    }

    const searchMsg = await bot.sendMessage(msg.chat.id, '🔍 _Mencari pasangan..._', { parse_mode: 'Markdown' });

    const partnerId = await findPartner(userId); // You need to implement this function
    if (partnerId) {
        await bot.deleteMessage(msg.chat.id, searchMsg.message_id);
        bot.sendMessage(msg.chat.id, '✨ *Pasangan ditemukan! Mulailah mengobrol.*', { parse_mode: 'Markdown' });
        bot.sendMessage(partnerId, '✨ *Pasangan ditemukan! Mulailah mengobrol.*', { parse_mode: 'Markdown' });
        
        // Update partners in the data structure
        user.partner = partnerId;
        data.users[partnerId].partner = userId;
        saveData();
    } else {
        bot.sendMessage(msg.chat.id, '❌ Tidak ada pasangan yang tersedia saat ini. Coba lagi nanti.');
    }
});

// /stop (Hentikan Chat)
bot.onText(/\/stop/, (msg) => {
    const userId = msg.from.id;
    const user = data.users[userId];

    if (user.partner) {
        const partnerId = user.partner;
        
        // Reset partners
        user.partner = null;
        data.users[partnerId].partner = null;
        
        saveData();

        bot.sendMessage(msg.chat.id, '❌ Chat dihentikan.');
        bot.sendMessage(partnerId, '❌ Pasangan Anda menghentikan chat.');

        // Display report options
        bot.sendMessage(
            msg.chat.id,
            '🚨 Apakah Anda ingin melaporkan pasangan chat ini?',
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⚠️ Kekerasan', callback_data: `report_${partnerId}_kekerasan` }],
                        [{ text: '🔞 Pornografi', callback_data: `report_${partnerId}_pornografi` }],
                        [{ text: '💰 Pemerasan', callback_data: `report_${partnerId}_pemerasan` }],
                        [{ text: '❌ Scamming', callback_data: `report_${partnerId}_scamming` }],
                        [{ text: '✏️ Custom Report', callback_data: `report_${partnerId}_custom` }],
                    ],
                },
            }
        );
    } else {
        bot.sendMessage(msg.chat.id, '⚠️ Anda tidak sedang terhubung dengan siapa pun.');
    }
});

// Handle Report
bot.on('callback_query', (callbackQuery) => {
    const [, reportedId, reason] = callbackQuery.data.split('_');
    
    // Ensure the reason is valid
    if (!reason) return;

    const reporterId = callbackQuery.from.id;

    bot.sendMessage(
        adminId,
        `📣 *Laporan Pengguna*\n\n` +
        `👤 *Pelapor:* ${reporterId}\n` +
        `👤 *Dilaporkan:* ${reportedId}\n` +
        `⚠️ *Alasan:* ${reason}`,
        { parse_mode: 'Markdown' }
    );

    bot.answerCallbackQuery(callbackQuery.id, { text: '✅ Laporan Anda telah dikirim ke admin.' });
});

// /totaluser
bot.onText(/\/totaluser/, (msg) => {
    const totalUsers = Object.keys(data.users).length;
    
    // Prepare user details for response
    const userDetails = Object.values(data.users)
        .map((u) => `👤 *ID:* ${u.id}\n💡 *Gender:* ${u.gender || 'Belum diatur'}\n🔗 *Status:* ${u.partner ? 'Terhubung' : 'Tidak terhubung'}`)
        .join('\n\n');

    bot.sendMessage(
        msg.chat.id,
        `📊 *Total Pengguna:*\n\n` +
        `📌 Jumlah Pengguna: ${totalUsers} orang\n\n` +
        `${userDetails}`,
        { parse_mode: 'Markdown' }
    );
});

// /broadcast
bot.onText(/\/broadcast/, async (msg) => {
    if (msg.from.id.toString() !== adminId) {
        bot.sendMessage(msg.chat.id, '❌ Perintah ini hanya untuk admin.');
        return;
    }

    const message = msg.reply_to_message;
    
    if (!message) {
        bot.sendMessage(msg.chat.id, '❌ Balas pesan yang ingin Anda broadcast.');
        return;
    }

    const userIds = Object.keys(data.users);
    
    let sent = 0;
    let failed = 0;
    
    const progressMsg = await bot.sendMessage(msg.chat.id, `🔄 *Proses Broadcast...*\n📤 Berhasil: ${sent}\n❌ Gagal: ${failed}`, { parse_mode: 'Markdown' });

    for (const id of userIds) {
        
         try {
             if (message.text) {
                 await bot.sendMessage(id, message.text);
             } else if (message.photo) {
                 await bot.sendPhoto(id, message.photo[0].file_id, { caption: message.caption });
             } else if (message.video) {
                 await bot.sendVideo(id, message.video.file_id, { caption: message.caption });
             }
             sent++;
         } catch (error) {
             console.error(`Failed to send message to ${id}:`, error);
             failed++;
         }

         await bot.editMessageText(
             progressMsg.chat.id,
             progressMsg.message_id,
             null,
             `🔄 *Proses Broadcast...*\n📤 Berhasil: ${sent}\n❌ Gagal: ${failed}`,
             { parse_mode: 'Markdown' }
         );
     }

     await bot.editMessageText(
         progressMsg.chat.id,
         progressMsg.message_id,
         null,
         `✅ *Broadcast selesai!*\n📤 Berhasil: ${sent}\n❌ Gagal: ${failed}`,
         { parse_mode: 'Markdown' }
     );
});

bot.on("polling_error", (error) => {
    console.error("Polling error:", error);
});
