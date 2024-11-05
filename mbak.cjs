const TelegramBot = require('node-telegram-bot-api');
const moment = require('moment-timezone');

// Ganti dengan token bot Anda
const token = '8152108745:AAE7_yI5xs4hARy-cEm_4Vh4Mo4VPiVgHaM';
const bot = new TelegramBot(token, { polling: true });

// Menyimpan data statistik per grup
let groupStats = {};

// Reset statistik harian pada tengah malam WIB
function scheduleReset() {
    const now = moment().tz('Asia/Jakarta');
    const midnight = moment().tz('Asia/Jakarta').endOf('day');
    const msUntilMidnight = midnight.diff(now);

    setTimeout(() => {
        for (let groupId in groupStats) {
            groupStats[groupId] = {
                messages: {},
                deletedMessages: 0,
                warningCount: {}
            };
        }
        scheduleReset();
    }, msUntilMidnight);
}

// Inisialisasi reset harian
scheduleReset();

// Handler untuk perintah /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🌟 Join Our Group 🌟', url: 'https://t.me/hiyaok' }]
            ]
        },
        parse_mode: 'HTML'
    };

    bot.sendMessage(
        chatId,
        '🤖 <b>Halo user aku adalah asisten bot!</b>\n\n' +
        '<i>Saya siap membantu mengelola grup Anda dengan fitur-fitur canggih!</i>',
        opts
    );
});

// Handler untuk new member
bot.on('new_chat_members', async (msg) => {
    const chatId = msg.chat.id;
    const newMembers = msg.new_chat_members;

    for (const member of newMembers) {
        if (!member.username || member.is_bot) {
            try {
                await bot.restrictChatMember(chatId, member.id, {
                    can_send_messages: false,
                    can_send_media_messages: false,
                    can_send_other_messages: false,
                    can_add_web_page_previews: false
                });

                const warningMsg = `🚫 <b>Peringatan Keamanan!</b>\n\n` +
                    `📢 User <code>${member.first_name}</code> telah dibatasi karena:\n` +
                    `${!member.username ? '• Tidak memiliki username Telegram\n' : ''}` +
                    `${member.is_bot ? '• Terdeteksi sebagai bot\n' : ''}\n` +
                    `<b>Akibat:</b>\n` +
                    `• Tidak dapat mengirim pesan\n` +
                    `• Tidak dapat mengirim media\n` +
                    `• Tidak dapat menambahkan link\n\n` +
                    `<i>Untuk membuka batasan, user harus:\n` +
                    `1. Memiliki username\n` +
                    `2. Menghubungi admin grup</i>`;

                bot.sendMessage(chatId, warningMsg, { parse_mode: 'HTML' });
            } catch (error) {
                console.error('Error restricting member:', error);
            }
        }
    }
});

// Handler untuk pesan
bot.on('message', async (msg) => {
    if (msg.chat.type !== 'private') {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const messageLines = msg.text ? msg.text.split('\n').length : 0;

        // Inisialisasi statistik grup jika belum ada
        if (!groupStats[chatId]) {
            groupStats[chatId] = {
                messages: {},
                deletedMessages: 0,
                warningCount: {}
            };
        }

        // Cek status admin
        const chatMember = await bot.getChatMember(chatId, userId);
        const isAdmin = ['creator', 'administrator'].includes(chatMember.status);

        // Update statistik pesan
        if (!groupStats[chatId].messages[userId]) {
            groupStats[chatId].messages[userId] = {
                count: 0,
                characters: 0,
                username: msg.from.username || msg.from.first_name
            };
        }
        groupStats[chatId].messages[userId].count++;
        groupStats[chatId].messages[userId].characters += msg.text ? msg.text.length : 0;

        // Cek jumlah baris (skip untuk admin)
        if (!isAdmin && messageLines > 4) {
            try {
                await bot.deleteMessage(chatId, msg.message_id);
                groupStats[chatId].deletedMessages++;

                if (!groupStats[chatId].warningCount[userId]) {
                    groupStats[chatId].warningCount[userId] = 0;
                }
                groupStats[chatId].warningCount[userId]++;

                if (groupStats[chatId].warningCount[userId] >= 2) {
                    const warningMessage = `⚠️ <b>Peringatan!</b>\n\n` +
                        `👤 User: <a href="tg://user?id=${userId}">${msg.from.first_name}</a>\n` +
                        `📝 Pelanggaran: Mengirim pesan lebih dari 4 baris\n` +
                        `🔄 Jumlah Peringatan: ${groupStats[chatId].warningCount[userId]}\n\n` +
                        `<i>Mohon untuk tidak mengirim pesan yang terlalu panjang!</i>`;

                    bot.sendMessage(chatId, warningMessage, { parse_mode: 'HTML' });
                }
            } catch (error) {
                console.error('Error deleting message:', error);
            }
        }
    }
});

// Handler untuk perintah statistik
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (msg.chat.type === 'private') {
        bot.sendMessage(chatId, '❌ Perintah ini hanya bisa digunakan di dalam grup!');
        return;
    }

    if (!groupStats[chatId]) {
        bot.sendMessage(chatId, '📊 Belum ada statistik untuk grup ini.');
        return;
    }

    const currentTime = moment().tz('Asia/Jakarta').format('HH:mm:ss');
    let statsMessage = `📊 <b>Statistik Grup (24 Jam Terakhir)</b>\n` +
                      `⏰ Update terakhir: ${currentTime} WIB\n\n`;

    // Total statistik
    const totalMessages = Object.values(groupStats[chatId].messages)
        .reduce((sum, user) => sum + user.count, 0);
    const totalCharacters = Object.values(groupStats[chatId].messages)
        .reduce((sum, user) => sum + user.characters, 0);

    statsMessage += `📑 Total Pesan: <code>${totalMessages.toLocaleString()}</code>\n`;
    statsMessage += `📝 Total Karakter: <code>${totalCharacters.toLocaleString()}</code>\n`;
    statsMessage += `🚫 Pesan Dihapus: <code>${groupStats[chatId].deletedMessages}</code>\n\n`;
    
    // Top 25 users
    statsMessage += `👥 <b>Top 25 Pengirim Pesan:</b>\n\n`;
    const topUsers = Object.entries(groupStats[chatId].messages)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 25);

    topUsers.forEach(([, stats], index) => {
        const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
        statsMessage += `${medal} @${stats.username}\n` +
            `   ┗━ 💬 <code>${stats.count}</code> pesan | 📝 <code>${stats.characters}</code> karakter\n`;
    });

    bot.sendMessage(chatId, statsMessage, { parse_mode: 'HTML' });
});

console.log('Bot telah dijalankan!');
