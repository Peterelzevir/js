const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// Token from BotFather
const token = '7354627036:AAGwOUhPZz5-bomZcsTw9K_KAZJjzMYRbgk';
const bot = new TelegramBot(token, { polling: true });
const adminId = 5988451717; // Tetap sebagai number

// Path file data
const DATA_FILE = path.join(__dirname, 'data.json');

// Fungsi untuk membaca data
function readData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const rawData = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(rawData);
        }
    } catch (error) {
        console.error("Error reading data.json:", error);
    }
    
    // Default data jika file tidak ada atau error
    return { 
        users: {}, 
        banned: [],
        version: '1.0' 
    };
}

// Inisialisasi data global
let data = readData();

// Fungsi untuk menyimpan data
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error saving data:", error);
    }
}

// Fungsi untuk mencari pasangan
async function findPartner(userId) {
    const user = data.users[userId];
    
    if (!user || !user.gender) return null;

    const availableUsers = Object.values(data.users)
        .filter(u => 
            u.id !== userId && 
            u.gender && 
            !u.partner && 
            u.gender !== user.gender
        );

    return availableUsers.length > 0 ? availableUsers[0].id : null;
}



// Pastikan proses exit tidak terjadi karena error
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

bot.on('message', async (msg) => {
    // Cek apakah pesan valid
    if (!msg || !msg.from) return; // Abaikan pesan sistem atau tanpa pengirim

    const userId = msg.from.id.toString();

    // Inisialisasi objek pengguna jika belum ada
    if (!data.users) data.users = {};
    if (!data.users[userId]) {
        data.users[userId] = {
            id: userId,
            gender: null,
            partner: null
        };
        saveData();
    }
    const user = data.users[userId];

    // Handler untuk laporan custom
    if (userReportState[userId] && userReportState[userId].awaitingCustomReport) {
        const reportedUserId = userReportState[userId].reportedUserId;
        const customReportMessage = msg.text;

        try {
            // Kirim laporan custom ke admin
            await bot.sendMessage(
                adminId,
                `📣 *Laporan Custom Pengguna*\n\n` +
                `👤 Pelapor: \`${userId}\`\n` +
                `👤 Dilaporkan: \`${reportedUserId}\`\n` +
                `⚠️ Alasan: *Custom Report*\n` +
                `📄 Pesan: "${customReportMessage}"\n` +
                `⏰ Waktu: ${new Date().toLocaleString()}`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '🚫 Blokir Pengguna', callback_data: `admin_ban_${reportedUserId}` },
                                { text: '✅ Abaikan', callback_data: 'admin_ignore_report' }
                            ]
                        ]
                    }
                }
            );

            // Hapus pesan laporan
            await bot.deleteMessage(msg.chat.id, msg.message_id);

            // Konfirmasi ke pengguna
            await bot.sendMessage(msg.chat.id, '✅ Laporan custom berhasil dikirim');

            // Reset state
            delete userReportState[userId];

            // Kembalikan dari fungsi untuk mencegah pemrosesan lebih lanjut
            return;
        } catch (error) {
            console.error('Error processing custom report:', error);
            await bot.sendMessage(msg.chat.id, '❌ Gagal mengirim laporan');
            
            // Reset state
            delete userReportState[userId];
            
            // Kembalikan dari fungsi untuk mencegah pemrosesan lebih lanjut
            return;
        }
    }

    // Cek apakah pesan adalah perintah (command)
    if (msg.text && msg.text.startsWith('/')) {
        console.log(`Command ${msg.text} diterima dari user ${userId}.`);

        // Tangani perintah /start
        if (msg.text === '/start') {
            bot.sendMessage(
                msg.chat.id,
                `👋 Selamat datang di Anonymous Chat @anontelerobot! ✅\n\n` +
                `👀 Gunakan perintah berikut untuk memulai:\n` +
                `👉 \`/next\` - Cari pasangan lain 👀\n` +
                `👉 \`/stop\` - Akhiri chat 🙏🏻\n` +
                `👉 \`/setgender\` - Atur gender 😎\n` +
                `👉 \`/help\` - Bantuan 👀`,
                { parse_mode: 'Markdown' }
            );
            return;
        }
    }

    // Cek apakah pengguna diblokir
    if (data.banned && data.banned.includes(userId)) {
        bot.sendMessage(msg.chat.id, '❌ Anda telah di-*banned* oleh admin', { parse_mode: 'Markdown' });
        return;
    }

    // Kirim pesan ke pasangan jika ada
    if (user && user.partner) {
        try {
            // Kirim berbagai jenis media
            if (msg.text) {
                await bot.sendMessage(user.partner, msg.text);
            } else if (msg.photo) {
                await bot.sendPhoto(user.partner, msg.photo[msg.photo.length - 1].file_id, {
                    caption: msg.caption || ''
                });
            } else if (msg.sticker) {
                await bot.sendSticker(user.partner, msg.sticker.file_id);
            } else if (msg.document) {
                await bot.sendDocument(user.partner, msg.document.file_id, {
                    caption: msg.caption || ''
                });
            } else if (msg.voice) {
                await bot.sendVoice(user.partner, msg.voice.file_id);
            } else if (msg.video) {
                await bot.sendVideo(user.partner, msg.video.file_id, {
                    caption: msg.caption || ''
                });
            } else if (msg.audio) {
                await bot.sendAudio(user.partner, msg.audio.file_id, {
                    caption: msg.caption || ''
                });
            } else if (msg.video_note) {
                await bot.sendVideoNote(user.partner, msg.video_note.file_id);
            } else if (msg.location) {
                await bot.sendLocation(user.partner, msg.location.latitude, msg.location.longitude);
            } else if (msg.contact) {
                await bot.sendContact(user.partner, msg.contact.phone_number, msg.contact.first_name);
            } else if (msg.animation) {
                await bot.sendAnimation(user.partner, msg.animation.file_id, {
                    caption: msg.caption || ''
                });
            }
        } catch (error) {
            console.error('Gagal mengirim pesan ke pasangan:', error);
            bot.sendMessage(userId, '❌ Gagal mengirim pesan, mungkin pasangan telah keluar.');
        }
    }
});

// Sisanya dari script sebelumnya tetap sama... (tidak berubah)

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

bot.on('callback_query', async (callbackQuery) => {
    const { data: callbackData, message, from } = callbackQuery;
    const userId = from.id.toString();

    // Pastikan data.users ada
    if (!data.users) data.users = {};
    if (!data.users[userId]) data.users[userId] = {}; // Buat objek baru jika belum ada

    switch (true) {
        // Gender Selection
        case callbackData === 'gender_male' || callbackData === 'gender_female': {
            const gender = callbackData === 'gender_male' ? 'Pria' : 'Wanita';
            data.users[userId].gender = gender;

            saveData(); // Pastikan fungsi saveData() berfungsi

            bot.editMessageText(`✅ Gender Anda telah diatur ke *${gender}*\n\n👀 sekarang mulailah chatting!`, {
                parse_mode: 'Markdown',
                chat_id: message.chat.id,
                message_id: message.message_id
            });
            break;
        }

// Report Handling
case callbackData.startsWith('report_'): {
    const [, reportedId, reason] = callbackData.split('_');
    const reporterId = callbackQuery.from.id.toString();

    // Validasi alasan dan ID pelapor
    if (!reason || !reportedId) {
        bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Laporan tidak valid' });
        return;
    }

    // Cek apakah pengguna sudah pernah melaporkan pengguna ini
    if (data.reports && data.reports[reporterId] && data.reports[reporterId].includes(reportedId)) {
        bot.answerCallbackQuery(callbackQuery.id, { text: '⚠️ Anda sudah pernah melaporkan pengguna ini' });
        return;
    }

    // Tambahkan logika untuk laporan custom
    if (reason === 'custom') {
        // Set state untuk laporan custom
        userReportState[reporterId] = {
            reportedUserId: reportedId,
            awaitingCustomReport: true
        };

        // Kirim pesan meminta detail laporan
        await bot.sendMessage(
            callbackQuery.message.chat.id, 
            '📝 Silakan tulis alasan laporan secara detail:'
        );

        // Hapus pesan inline keyboard
        await bot.deleteMessage(
            callbackQuery.message.chat.id, 
            callbackQuery.message.message_id
        );

        await bot.answerCallbackQuery(callbackQuery.id);
        return;
    }

    // Proses laporan standar
    try {
        // Simpan laporan
        if (!data.reports) data.reports = {};
        if (!data.reports[reporterId]) {
            data.reports[reporterId] = [];
        }
        data.reports[reporterId].push(reportedId);

        // Kirim laporan ke admin
        await bot.sendMessage(
            adminId,
            `📣 *Laporan Pengguna Baru*\n\n` +
            `👤 Pelapor: \`${reporterId}\`\n` +
            `👤 Dilaporkan: \`${reportedId}\`\n` +
            `⚠️ Alasan: *${reason}*\n` +
            `⏰ Waktu: ${new Date().toLocaleString()}`,
            { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🚫 Blokir Pengguna', callback_data: `admin_ban_${reportedId}` },
                            { text: '✅ Abaikan', callback_data: 'admin_ignore_report' }
                        ]
                    ]
                }
            }
        );

        // Konfirmasi ke pengguna
        await bot.answerCallbackQuery(callbackQuery.id, { 
            text: '✅ Laporan Anda telah dikirim ke admin' 
        });

        // Hapus pesan inline keyboard laporan
        await bot.deleteMessage(
            callbackQuery.message.chat.id, 
            callbackQuery.message.message_id
        );

        // Simpan perubahan data
        saveData();

    } catch (error) {
        console.error('Error processing report:', error);
        bot.answerCallbackQuery(callbackQuery.id, { 
            text: '❌ Gagal mengirim laporan' 
        });
    }
    break;
}
        // Quick Help
        case callbackData === 'quick_help': {
            const quickHelp = `
*✳️ Panduan Singkat Anonymous Chat @anontelerobot*

1️⃣ Atur gender dengan \`/setgender\` 🔔
2️⃣ Temukan pasangan dengan \`/next\` 👁‍🗨
3️⃣ Mulai mengobrol! 💬
4️⃣ Gunakan \`/stop\` untuk mengakhiri 🛑

*👁‍🗨 Tips :*
• Selalu bersikap sopan ❤
• Chat bersifat anonim ✅
• Nikmatilah pengalaman chatting! 🤩
`;
            bot.editMessageText(quickHelp, {
                parse_mode: 'Markdown',
                chat_id: message.chat.id,
                message_id: message.message_id
            });
            break;
        }

        // Full Rules
        case callbackData === 'full_rules': {
            const fullRules = `
*⚖️ Peraturan Lengkap Anonymous Chat @anontelerobot*

🔹 *👀 Ketentuan Umum:*
• Wajib mengatur gender sebelum chat ❕
• Satu kali pengaturan gender✅
• Dilarang mengirim konten pornografi 🔞
• Dilarang melakukan pemerasan/scamming 🚫
• Hormati privasi pasangan chat 🙏🏻

🔹 *❗Konsekuensi Pelanggaran:*
• Pelanggaran ringan: Peringatan ✅
• Pelanggaran berat: Banned permanen ✅
• Admin berhak memblokir tanpa pemberitahuan ‼️

🔹 *🚫 Etika Chatting:*
• Gunakan bahasa santun ❤
• Tidak boleh meminta data pribadi ❌
• Tidak boleh menghina/melecehkan 🔞
• Fokus pada percakapan yang sehat 💯

🔹 *👁‍🗨 Privasi:*
• Hanya gender yang terlihat ✅
• Identitas asli tidak pernah dibagikan ✅
• Percakapan bersifat sementara ✅
`;
            bot.editMessageText(fullRules, {
                parse_mode: 'Markdown',
                chat_id: message.chat.id,
                message_id: message.message_id
            });
            break;
        }

        default: {
            bot.answerCallbackQuery(callbackQuery.id, { text: '⚠️ Callback tidak dikenali.' });
            break;
        }
    }
});

const searchingQueue = []; // Queue untuk menyimpan ID pengguna yang sedang mencari

bot.onText(/\/next/, async (msg) => {
    const userId = msg.from.id.toString();
    const user = data.users[userId];

    if (!user.gender) {
        bot.sendMessage(msg.chat.id, '⚠️ Silakan atur gender Anda terlebih dahulu dengan /setgender');
        return;
    }

    if (user.partner) {
        bot.sendMessage(msg.chat.id, '⚠️ Yey! kamu sudah terhubung\n\n👀 gunakan `/stop` untuk mengakhiri chat 👌');
        return;
    }

    if (searchingQueue.includes(userId)) {
        bot.sendMessage(msg.chat.id, '⚠️ Anda sudah dalam antrean pencarian, mohon tunggu 👀');
        return;
    }

    searchingQueue.push(userId);

    const searchMsg = await bot.sendMessage(msg.chat.id, '🔍 _Mencari pasangan..._', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🛑 Berhenti Mencari', callback_data: 'stop_searching' }]
            ]
        }
    });

    try {
        const partnerId = await findPartner(userId);

        if (partnerId) {
            await bot.deleteMessage(msg.chat.id, searchMsg.message_id);
            bot.sendMessage(msg.chat.id, '✨ *Pasangan ditemukan! Mulailah mengobrol\n\n👀 /stop untuk akhiri chat*', { parse_mode: 'Markdown' });
            bot.sendMessage(partnerId, '✨ *Pasangan ditemukan! Mulailah mengobrol\n\n👀 /stop untuk akhiri chat*', { parse_mode: 'Markdown' });

            data.users[userId].partner = partnerId;
            data.users[partnerId].partner = userId;

            removeFromQueue(userId);
            removeFromQueue(partnerId);

            saveData();
        } else {
            setTimeout(async () => {
                const stillSearching = searchingQueue.includes(userId);

                if (stillSearching && !data.users[userId].partner) {
                    await bot.deleteMessage(msg.chat.id, searchMsg.message_id);
                    bot.sendMessage(msg.chat.id, '❌ Tidak ada pasangan yang tersedia, Pencarian dihentikan 😔\n\n💬 /next untuk mencari kembali ✅');
                    removeFromQueue(userId);
                }
            }, 5 * 60 * 1000);
        }
    } catch (error) {
        console.error('Error mencari pasangan:', error);
        bot.sendMessage(msg.chat.id, '❌ Terjadi kesalahan saat mencari pasangan, silakan coba lagi.');
        removeFromQueue(userId);
    }
});


// Handler untuk callback tombol berhenti mencari
bot.on('callback_query', async (callbackQuery) => {
    const userId = callbackQuery.from.id.toString();
    
    if (callbackQuery.data === 'stop_searching') {
        removeFromQueue(userId);
        await bot.answerCallbackQuery(callbackQuery.id, '✅ Pencarian dihentikan');
        await bot.deleteMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id);
        await bot.sendMessage(callbackQuery.message.chat.id, '❌ Pencarian dihentikan');
    }
});

    const partnerId = await findPartner(userId);

    if (partnerId) {
        await bot.deleteMessage(msg.chat.id, searchMsg.message_id);
        bot.sendMessage(msg.chat.id, '✨ *Pasangan ditemukan! Mulailah mengobrol\n\n👀 /stop untuk akhiri chat*', { parse_mode: 'Markdown' });
        bot.sendMessage(partnerId, '✨ *Pasangan ditemukan! Mulailah mengobrol\n\n👀 /stop untuk akhiri chat*', { parse_mode: 'Markdown' });

        // Update pasangan
        data.users[userId].partner = partnerId;
        data.users[partnerId].partner = userId;

        // Hapus kedua pengguna dari antrean pencarian
        removeFromQueue(userId);
        removeFromQueue(partnerId);

        saveData();
    } else {
        // Tunggu selama 5 menit
        setTimeout(async () => {
            const stillSearching = searchingQueue.includes(userId);

            if (stillSearching && !data.users[userId].partner) {
                await bot.deleteMessage(msg.chat.id, searchMsg.message_id);
                bot.sendMessage(msg.chat.id, '❌ Tidak ada pasangan yang tersedia, Pencarian dihentikan 😔\n\n💬 /next untuk mencari kembali ✅');
                removeFromQueue(userId); // Hapus dari antrean
            }
        }, 5 * 60 * 1000); // 5 menit
    }
});

async function findPartner(userId) {
    const user = data.users[userId];
    const searchingUsers = searchingQueue.filter(queuedUserId => {
        const queuedUser = data.users[queuedUserId];
        // Prioritaskan pencarian berdasarkan urutan antrian
        // Utamakan beda gender
        return queuedUserId !== userId && 
               queuedUser.gender !== user.gender &&
               !queuedUser.partner;
    });

    // Jika tidak ada pasangan beda gender, cari pasangan apa pun
    if (searchingUsers.length === 0) {
        return searchingQueue.find(queuedUserId => 
            queuedUserId !== userId && !data.users[queuedUserId].partner
        );
    }

    // Kembalikan pasangan pertama yang sesuai kriteria
    return searchingUsers[0];
}

// Fungsi untuk menghapus pengguna dari antrean
function removeFromQueue(userId) {
    const index = searchingQueue.indexOf(userId);
    if (index !== -1) searchingQueue.splice(index, 1);
}

bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;

    if (data.startsWith('admin_ban_')) {
        const userId = data.split('_')[2];
        // Logika blokir pengguna
        if (!data.banned) data.banned = [];
        data.banned.push(userId);
        saveData();

        await bot.answerCallbackQuery(callbackQuery.id, { text: '🚫 Pengguna berhasil diblokir' });
    }

    if (data === 'admin_ignore_report') {
        await bot.answerCallbackQuery(callbackQuery.id, { text: '✅ Laporan diabaikan' });
    }
});

// /stop (Hentikan Chat)
bot.onText(/\/stop/, (msg) => {
    const userId = msg.from.id.toString();
    const user = data.users[userId];

    if (user.partner) {
        const partnerId = user.partner;

        // Reset partners
        user.partner = null;
        data.users[partnerId].partner = null;

        saveData();

        // Pesan untuk pengguna yang menghentikan chat
        bot.sendMessage(msg.chat.id, '❌ Chat berhasil dihentikan ✅\n\n👀 /next untuk mencari lagi 💬');
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

        // Pesan untuk pasangan yang dihentikan chat-nya
        bot.sendMessage(partnerId, '❌ yahh dia sudah menghentikan chat dengan kamu 😔\n\n👀 /next untuk mencari lagi 💬');
        bot.sendMessage(
            partnerId,
            '🚨 Apakah Anda ingin melaporkan pasangan chat ini?',
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⚠️ Kekerasan', callback_data: `report_${userId}_kekerasan` }],
                        [{ text: '🔞 Pornografi', callback_data: `report_${userId}_pornografi` }],
                        [{ text: '💰 Pemerasan', callback_data: `report_${userId}_pemerasan` }],
                        [{ text: '❌ Scamming', callback_data: `report_${userId}_scamming` }],
                        [{ text: '✏️ Custom Report', callback_data: `report_${userId}_custom` }],
                    ],
                },
            }
        );
    } else {
        bot.sendMessage(msg.chat.id, '⚠️ Anda tidak sedang terhubung dengan siapa pun.');
    }
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

// /help command
bot.onText(/\/help/, (msg) => {
    const helpMessage = `
*🤖 Anonymous Chat Bot - Panduan Lengkap* 

*👤 Pengaturan Akun :*
• \`/start\` - Memulai bot dan melihat petunjuk dasar ✅
• \`/setgender\` - Atur gender Anda (hanya sekali) ‼️

*💬 Fitur Chat :*
• \`/next\` - Temukan pasangan chat acak dengan gender berbeda ✅
• \`/stop\` - Akhiri percakapan saat ini ‼️
   - Akan menawarkan opsi pelaporan setelah mengakhiri chat 💬

*🚨 Pelaporan :*
• Saat menggunakan \`/stop\`, Anda dapat melaporkan pasangan dengan berbagai alasan:
   - Kekerasan ⚠️
   - Pornografi 🔞
   - Pemerasan 💰
   - Scamming ❌
   - Alasan Lainnya 💬

*ℹ️ Informasi :*
• \`/totaluser\` - Lihat statistik total pengguna [ admin only ] ✅
• 👀 Fitur rahasia : Chat Anda dijamin anonim! 🤩

*⚠️ Peraturan Penting :*
1. Hormati pasangan chat Anda ❕
2. Dilarang mengirim konten tidak pantas 🔞
3. Satu kali pengaturan gender ✅
4. Admin dapat memblokir pengguna yang melanggar ‼️

*🔒 Privasi :*
• Tidak ada identitas pribadi yang tersimpan ✅
• Chat dijamin anonim 👁‍🗨
• Hanya gender yang diketahui✅

*🆘 Bantuan Tambahan :*
• 👀 Jika mengalami masalah, hubungi admin 🤩
• 🚫 Pelanggaran dapat berakibat banned ✅
`;

    bot.sendMessage(msg.chat.id, helpMessage, { 
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '❓ Panduan Singkat', callback_data: 'quick_help' }],
                [{ text: '⚖️ Peraturan Lengkap', callback_data: 'full_rules' }]
            ]
        }
    });
});

// Admin Command: /banned
bot.onText(/\/banned (.+)/, (msg, match) => {
    // Pastikan hanya admin yang bisa menggunakan perintah ini
    if (msg.from.id.toString() !== adminId.toString()) {
        bot.sendMessage(msg.chat.id, '❌ Anda tidak memiliki izin untuk menggunakan perintah ini.');
        return;
    }

    const userId = match[1].trim();

    // Cek apakah user ID valid
    if (!data.users[userId]) {
        bot.sendMessage(msg.chat.id, `❌ Pengguna dengan ID ${userId} tidak ditemukan.`);
        return;
    }

    // Tambahkan ke daftar banned
    if (!data.banned.includes(userId)) {
        data.banned.push(userId);
        saveData();

        // Putuskan koneksi jika sedang dalam chat
        if (data.users[userId].partner) {
            const partnerId = data.users[userId].partner;
            data.users[userId].partner = null;
            data.users[partnerId].partner = null;
            bot.sendMessage(partnerId, '❌ Pasangan Anda telah diblokir oleh admin.');
        }

        bot.sendMessage(msg.chat.id, `✅ Pengguna ${userId} berhasil dibanned.`);
        
        // Kirim notifikasi ke pengguna yang dibanned
        try {
            bot.sendMessage(userId, '❌ Anda telah diblokir oleh admin. Hubungi tim support untuk informasi lebih lanjut.');
        } catch (error) {
            console.log(`Tidak dapat mengirim pesan ke ${userId}`);
        }
    } else {
        bot.sendMessage(msg.chat.id, `⚠️ Pengguna ${userId} sudah ada dalam daftar banned.`);
    }
});

// Admin Command: /unban
bot.onText(/\/unban (.+)/, (msg, match) => {
    // Pastikan hanya admin yang bisa menggunakan perintah ini
    if (msg.from.id.toString() !== adminId.toString()) {
        bot.sendMessage(msg.chat.id, '❌ Anda tidak memiliki izin untuk menggunakan perintah ini.');
        return;
    }

    const userId = match[1].trim();

    // Cek apakah user ID ada di daftar banned
    const bannedIndex = data.banned.indexOf(userId);
    if (bannedIndex > -1) {
        // Hapus dari daftar banned
        data.banned.splice(bannedIndex, 1);
        saveData();

        bot.sendMessage(msg.chat.id, `✅ Pengguna ${userId} berhasil diunban.`);
        
        // Kirim notifikasi ke pengguna yang diunban
        try {
            bot.sendMessage(userId, '✅ Anda telah diunban oleh admin. Anda dapat menggunakan bot kembali.');
        } catch (error) {
            console.log(`Tidak dapat mengirim pesan ke ${userId}`);
        }
    } else {
        bot.sendMessage(msg.chat.id, `⚠️ Pengguna ${userId} tidak ada dalam daftar banned.`);
    }
});

// Tambahkan admin command untuk melihat daftar banned
bot.onText(/\/bannedlist/, (msg) => {
    // Pastikan hanya admin yang bisa menggunakan perintah ini
    if (msg.from.id.toString() !== adminId.toString()) {
        bot.sendMessage(msg.chat.id, '❌ Anda tidak memiliki izin untuk menggunakan perintah ini.');
        return;
    }

    if (data.banned.length === 0) {
        bot.sendMessage(msg.chat.id, '📋 Tidak ada pengguna yang di-banned.');
        return;
    }

    const bannedList = data.banned.map(userId => {
        const user = data.users[userId];
        return `👤 ID: ${userId}, Gender: ${user ? user.gender || 'Tidak diatur' : 'Data tidak tersedia'}`;
    }).join('\n');

    bot.sendMessage(
        msg.chat.id, 
        '🚫 *Daftar Pengguna Banned:*\n\n' + bannedList, 
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
            `🔄 *Proses Broadcast...*\n📤 Berhasil: ${sent}\n❌ Gagal: ${failed}`,
            { 
                parse_mode: 'Markdown', 
                chat_id: progressMsg.chat.id, 
                message_id: progressMsg.message_id 
            }
        );
    }

    await bot.editMessageText(
        `✅ *Broadcast selesai!*\n📤 Berhasil: ${sent}\n❌ Gagal: ${failed}`,
        { 
            parse_mode: 'Markdown', 
            chat_id: progressMsg.chat.id, 
            message_id: progressMsg.message_id 
        }
    );
});

//cek
bot.on("polling_error", (error) => {
    console.error("Polling error:", error);
});
