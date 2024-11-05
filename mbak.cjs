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
                    `User <code>${member.first_name}</code> telah dibatasi karena:\n` +
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

// Function untuk mute user
async function muteUser(chatId, userId, username, reason) {
    try {
        await bot.restrictChatMember(chatId, userId, {
            can_send_messages: false,
            can_send_media_messages: false,
            can_send_other_messages: false,
            can_add_web_page_previews: false,
            until_date: Math.floor(Date.now() / 1000) + 24 * 3600 // Mute selama 24 jam
        });

        const muteMessage = `⛔️ <b>PENGGUNA DIBISUKAN</b> ⛔️\n\n` +
            `👤 User: <code>${username}</code>\n` +
            `⚠️ Alasan: ${reason}\n` +
            `⏱ Durasi: 24 jam\n\n` +
            `<b>Riwayat Pelanggaran:</b>\n` +
            `└ Mengirim pesan >4 baris sebanyak 4 kali\n\n` +
            `<i>Silakan hubungi admin grup untuk informasi lebih lanjut.</i>`;

        bot.sendMessage(chatId, muteMessage, { parse_mode: 'HTML' });
    } catch (error) {
        console.error('Error muting user:', error);
    }
}

// Handler untuk pesan
bot.on('message', async (msg) => {
    if (msg.chat.type !== 'private' && msg.text) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const messageLines = msg.text.split('\n').length;

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
        groupStats[chatId].messages[userId].characters += msg.text.length;

        // Cek jumlah baris untuk non-admin
        if (!isAdmin && messageLines > 4) {
            try {
                // Hapus pesan yang melanggar
                await bot.deleteMessage(chatId, msg.message_id);
                groupStats[chatId].deletedMessages++;

                // Update hitungan peringatan
                if (!groupStats[chatId].warningCount[userId]) {
                    groupStats[chatId].warningCount[userId] = 0;
                }
                groupStats[chatId].warningCount[userId]++;

                const warningsLeft = 4 - groupStats[chatId].warningCount[userId];
                const username = msg.from.username ? 
                    `@${msg.from.username}` : 
                    `<a href="tg://user?id=${userId}">${msg.from.first_name}</a>`;

                if (groupStats[chatId].warningCount[userId] >= 4) {
                    // Mute user setelah 4 peringatan
                    await muteUser(chatId, userId, username, 'Melewati batas maksimum peringatan');
                } else {
                    // Kirim pesan peringatan
                    const warningMessage = `⚠️ <b>PERINGATAN!</b> ⚠️\n\n` +
                        `👤 ${username}\n` +
                        `⛔ Mengirim pesan lebih dari 4 baris\n` +
                        `📌 Peringatan ${groupStats[chatId].warningCount[userId]}/4 ( tersisa ${warningsLeft} )\n\n` +
                        `• Pesan >4 baris akan dihapus\n• 4 peringatan = Dibisukan\n\n` +
                        `<i>Mohon untuk mematuhi peraturan grup!</i>`;

                    bot.sendMessage(chatId, warningMessage, { parse_mode: 'HTML' });
                }
            } catch (error) {
                console.error('Error handling message:', error);
            }
        }
    }
});

// ... (kode sebelumnya tetap sama sampai handler stats)

// ... (kode sebelumnya tetap sama sampai handler stats)

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

    try {
        // Mengambil daftar member grup secara real-time
        const chatMembers = await bot.getChatAdministrators(chatId);
        const adminIds = new Set(chatMembers.map(member => member.user.id));

        // Update waktu real-time
        const currentTime = moment().tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss');
        let statsMessage = `📊 <b>Statistik Grup</b>\n` +
                        `⏰ <code>${currentTime} WIB</code>\n\n`;

        // Hitung total statistik real-time
        const totalMessages = Object.values(groupStats[chatId].messages)
            .reduce((sum, user) => sum + user.count, 0);
        const totalCharacters = Object.values(groupStats[chatId].messages)
            .reduce((sum, user) => sum + user.characters, 0);

        statsMessage += `📋 <b>RINGKASAN AKTIVITAS:</b>\n` +
                       `├ 📨 Total Pesan: <code>${totalMessages.toLocaleString()}</code>\n` +
                       `├ 📝 Total Karakter: <code>${totalCharacters.toLocaleString()}</code>\n` +
                       `└ 🚫 Pesan Dihapus: <code>${groupStats[chatId].deletedMessages}</code>\n\n`;
        
        // Top 25 users dengan status real-time
        statsMessage += `👥 <b>TOP 25 PENGIRIM PESAN AKTIF:</b>\n\n`;
        
        // Sort dan filter users
        const topUsers = Object.entries(groupStats[chatId].messages)
            .map(([userId, stats]) => ({
                userId: userId,
                ...stats
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 25);

        // Generate pesan untuk setiap user
        for (let i = 0; i < topUsers.length; i++) {
            const user = topUsers[i];
            const isAdmin = adminIds.has(parseInt(user.userId));
            const medal = i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`;
            const adminBadge = isAdmin ? ' 👑' : '';
            const username = user.username || 'Anonymous';
            const messageCount = user.count.toLocaleString();
            const charCount = user.characters.toLocaleString();
            
            // Hitung rata-rata karakter per pesan
            const avgCharsPerMsg = (user.characters / user.count).toFixed(1);

            statsMessage += `${medal} @${username}${adminBadge}\n` +
                          `    ├ 💬 Pesan: <code>${messageCount}</code>\n` +
                          `    ├ 📝 Karakter: <code>${charCount}</code>\n` +
                          `    └ 📊 Rata-rata: <code>${avgCharsPerMsg}</code> kar/pesan\n\n`;
        }

        // Tambahkan footer
        statsMessage += `\n<i>💡 Statistik diperbarui secara real-time\n` +
                       `📅 Reset otomatis setiap tengah malam WIB</i>`;

        // Kirim statistik dengan mode HTML
        await bot.sendMessage(chatId, statsMessage, { 
            parse_mode: 'HTML',
            disable_web_page_preview: true 
        });

    } catch (error) {
        console.error('Error generating stats:', error);
        bot.sendMessage(
            chatId, 
            '❌ Terjadi kesalahan saat mengambil statistik.\nSilakan coba lagi nanti.',
            { parse_mode: 'HTML' }
        );
    }
});

// ... (kode setelahnya tetap sama)
console.log('Bot telah dijalankan!');
