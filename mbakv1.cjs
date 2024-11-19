const TelegramBot = require('node-telegram-bot-api');
const moment = require('moment-timezone');

// Ganti dengan token bot Anda
const token = '8152108745:AAE7_yI5xs4hARy-cEm_4Vh4Mo4VPiVgHaM';
const bot = new TelegramBot(token, { polling: true });

// Menyimpan data statistik per grup
let groupStats = {};
// Menyimpan data invite per user
let userInvites = {};
// Menyimpan durasi voice note per user
let voiceNoteDurations = {};

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
        // Reset invite tracking
        userInvites = {};
        // Reset voice note durations
        voiceNoteDurations = {};
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
                [{ text: '🌟 Buy Program Bot 🌟', url: 'https://t.me/hiyaok' }]
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
        // Fitur 1: Mute user tanpa username atau bot
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

        // Fitur 5: Kata sambutan untuk user baru
        const welcomeMessage = `Halo, ${member.first_name}! 🎉
Selamat datang di grup teman IG & ING tempat asyik untuk Instagram dan belajar dan berlatih bahasa Inggris bersama!

Kami senang banget kamu bergabung. Jangan ragu untuk mulai memperkenalkan diri, bertanya, atau ikut diskusi. Di sini, kita semua belajar bareng, jadi jangan takut buat mencoba!

Beberapa tips untuk member baru:
1. Perkenalkan diri kamu dulu, biar kita makin kenal! (Nama, hobi, atau kenapa tertarik belajar bahasa Inggris).
2. Gunakan bahasa Inggris sebanyak mungkin, nggak apa-apa kalau masih campur-campur. Kami di sini siap bantu!
3. Nikmati proses belajar, dan jangan takut bikin kesalahan—itu bagian dari perjalanan!

Sekali lagi, welcome aboard, dan semoga perjalanan belajar kamu di sini menyenangkan dan bermanfaat! 🚀

Cheers, Prabu08`;

        const welcomeMsg = await bot.sendMessage(chatId, welcomeMessage);

        // Hapus pesan sambutan setelah 20 menit
        setTimeout(() => {
            try {
                bot.deleteMessage(chatId, welcomeMsg.message_id);
            } catch (error) {
                console.error('Error deleting welcome message:', error);
            }
        }, 20 * 60 * 1000); // 20 menit
    }
});

// Handler untuk pelacakan invite
bot.on('message', async (msg) => {
    if (msg.new_chat_members) {
        const inviterId = msg.from.id;
        if (!userInvites[inviterId]) {
            userInvites[inviterId] = 0;
        }
        userInvites[inviterId] += msg.new_chat_members.length;
    }
});

// Handler untuk voice note
bot.on('voice', (msg) => {
    const userId = msg.from.id;
    const duration = msg.voice.duration; // durasi dalam detik

    if (!voiceNoteDurations[userId]) {
        voiceNoteDurations[userId] = 0;
    }
    voiceNoteDurations[userId] += duration;
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

    try {
        const chatMembers = await bot.getChatAdministrators(chatId);
        const adminIds = new Set(chatMembers.map(member => member.user.id));

        const currentTime = moment().tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss');
        let statsMessage = `📊 <b>Statistik Grup</b>\n` +
                        `⏰ <code>${currentTime} WIB</code>\n\n`;

        const totalMessages = Object.values(groupStats[chatId].messages)
            .reduce((sum, user) => sum + user.count, 0);

        statsMessage += `📋 <b>RINGKASAN AKTIVITAS:</b>\n` +
                       `├ 📨 Total Pesan: <code>${totalMessages.toLocaleString()}</code>\n` +
                       `└ 🚫 Pesan Dihapus: <code>${groupStats[chatId].deletedMessages}</code>\n\n`;
        
        statsMessage += `👥 <b>TOP 25 PENGIRIM PESAN AKTIF:</b>\n\n`;
        
        const topUsers = Object.entries(groupStats[chatId].messages)
            .map(([userId, stats]) => ({
                userId: userId,
                ...stats,
                voiceMinutes: (voiceNoteDurations[userId] || 0) / 60
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 25);

        for (let i = 0; i < topUsers.length; i++) {
            const user = topUsers[i];
            const isAdmin = adminIds.has(parseInt(user.userId));
            const medal = i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`;
            const adminBadge = isAdmin ? ' 👑' : '';
            const username = user.username || 'Anonymous';
            const messageCount = user.count.toLocaleString();
            const voiceMinutes = user.voiceMinutes.toFixed(1);
            
            statsMessage += `${medal} @${username}${adminBadge}\n` +
                          `    ├ 💬 Pesan: <code>${messageCount}</code>\n` +
                          `    └ 🎙 Durasi Voice Note: <code>${voiceMinutes}</code> menit\n\n`;
        }

        statsMessage += `\n<i>💡 Statistik diperbarui secara real-time\n` +
                       `📅 Reset otomatis setiap tengah malam WIB</i>`;

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

// Handler untuk pesan
bot.on('message', async (msg) => {
    if (msg.chat.type !== 'private' && msg.text) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const messageLines = msg.text.split('\n').length;

        // Inisialisasi statistik
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

        // Fitur 3: Cek invite untuk non-admin
        if (!isAdmin) {
            const inviteCount = userInvites[userId] || 0;
            
            if (inviteCount < 2) {
                try {
                    // Hapus pesan
                    await bot.deleteMessage(chatId, msg.message_id);
                    groupStats[chatId].deletedMessages++;

                    // Kirim peringatan
                    const username = msg.from.username || msg.from.first_name;
                    const warningMessage = `▫️Akses Chat
👋 Halo, "${username}"! Untuk mulai chat, tambahkan 2 kontak ke grup ini.

Malas menambahkan?
Bayar Rp20.000 ke admin dan nikmati chat gratis 2 bulan ke pemilik grup @prabu08 !

Pilih yang nyaman untukmu. Terima kasih! 😊`;

                    bot.sendMessage(chatId, warningMessage);
                } catch (error) {
                    console.error('Error handling invite requirement:', error);
                }
            }
        }

        // Fitur 4: Cek jumlah baris untuk non-admin
        if (!isAdmin && messageLines > 4) {
            try {
                // Hapus pesan yang melanggar
                await bot.deleteMessage(chatId, msg.message_id);
                groupStats[chatId].deletedMessages++;

                // Pesan peringatan
                const username = msg.from.username ? 
                    `@${msg.from.username}` : 
                    `<a href="tg://user?id=${userId}">${msg.from.first_name}</a>`;

                const warningMessage = `⚠️ <b>PERINGATAN!</b> ⚠️\n\n` +
                    `👤 ${username} lewat 4 baris\n\n` +
                    `• Pesan dibatasi maksimal 4 baris`;
                
                bot.sendMessage(chatId, warningMessage, { parse_mode: 'HTML' });
            } catch (error) {
                console.error('Error handling message lines:', error);
            }
        }
    }
});

console.log('Bot telah dijalankan!');
