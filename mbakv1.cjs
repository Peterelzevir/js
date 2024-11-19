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

                await bot.sendMessage(chatId, warningMsg, { parse_mode: 'HTML' });
            } catch (error) {
                console.error('Error restricting member:', error);
            }
        } else {
            // Kirim kata sambutan untuk anggota baru
            const welcomeMessage = `Halo, @${member.username}! 🎉\n` +
                `Selamat datang di grup teman IG & ING tempat asyik untuk Instagram dan belajar dan berlatih bahasa Inggris bersama!\n\n` +
                `Kami senang banget kamu bergabung. Jangan ragu untuk mulai memperkenalkan diri, bertanya, atau ikut diskusi. Di sini, kita semua belajar bareng, jadi jangan takut buat mencoba!\n\n` +
                `Beberapa tips untuk member baru:\n` +
                `1. Perkenalkan diri kamu dulu, biar kita makin kenal! (Nama, hobi, atau kenapa tertarik belajar bahasa Inggris).\n` +
                `2. Gunakan bahasa Inggris sebanyak mungkin, nggak apa-apa kalau masih campur-campur. Kami di sini siap bantu!\n` +
                `3. Nikmati proses belajar, dan jangan takut bikin kesalahan—itu bagian dari perjalanan!\n\n` +
                `Sekali lagi, welcome aboard, dan semoga perjalanan belajar kamu di sini menyenangkan dan bermanfaat! 🚀\n\n` +
                `Cheers, Prabu08`;

            const welcomeMsgResponse = await bot.sendMessage(chatId, welcomeMessage);
            
            // Hapus pesan sambutan setelah 20 menit
            setTimeout(() => {
                bot.deleteMessage(chatId, welcomeMsgResponse.message_id).catch(err => console.error('Error deleting welcome message:', err));
            }, 20 * 60 * 1000); // 20 menit dalam milidetik
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
            `👤 <code>${username}</code> lewat 4 baris\n` +
            `⚠️ Alasan: ${reason}\n` +
            `⏱ Durasi: 24 jam\n\n` +
            `<b>Riwayat Pelanggaran:</b>\n` +
            `└ Mengirim pesan >4 baris sebanyak 4 kali\n\n` +
            `<i>Silakan hubungi admin grup untuk informasi lebih lanjut.</i>`;

        await bot.sendMessage(chatId, muteMessage, { parse_mode: 'HTML' });
    } catch (error) {
        console.error('Error muting user:', error);
    }
}

// Handler untuk pesan
bot.on('message', async (msg) => {
    if (msg.chat.type !== 'private') { // Hanya proses pesan dalam grup
        const chatId = msg.chat.id;
        const userId = msg.from.id;

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

        // Update statistik pesan jika pengguna belum terdaftar
        if (!groupStats[chatId].messages[userId]) {
            groupStats[chatId].messages[userId] = {
                count: 0,
                characters: 0,
                voiceNoteDuration: 0,
                username: msg.from.username || msg.from.first_name
            };
        }

        // Hitung waktu voice note jika ada
        if (msg.voice) { // Pastikan objek msg memiliki properti voice
           groupStats[chatId].messages[userId].voiceNoteDuration += msg.voice.duration; // durasi dalam detik
       }

       // Update jumlah pesan dan karakter
       groupStats[chatId].messages[userId].count++;
       groupStats[chatId].messages[userId].characters += msg.text ? msg.text.length : 0; // Hanya tambahkan jika ada teks

       // Cek jumlah baris untuk non-admin
       const messageLines = msg.text ? msg.text.split('\n').length : 0; // Hitung baris pesan

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
                   const warningMessage = `⚠️ <b>PERINGATAN!</b> ⚠️\n` +
                       `👤 ${username} lewat 4 baris` +
                       `📌 Peringatan ${groupStats[chatId].warningCount[userId]}/4 ( tersisa ${warningsLeft} )\n` +
                       `• 4 peringatan = Dibisukan\n`;
                   await bot.sendMessage(chatId, warningMessage, { parse_mode: 'HTML' });
               }
           } catch (error) {
               console.error('Error handling message:', error);
           }
       }

       // Cek apakah pengguna sudah mengundang dua anggota baru sebelum bisa mengirim pesan
       if (!isAdmin && Object.keys(groupStats[chatId].messages).length < 3) { // minimal ada admin + 2 anggota baru
           await bot.deleteMessage(chatId, msg.message_id); // Hapus pesan

           const warningMessage = 
             `▫️Akses Chat\n👋 Halo, ${msg.from.username || msg.from.first_name}! Untuk mulai chat, tambahkan 2 kontak ke grup ini.\n\nMalas menambahkan?\nBayar Rp20.000 ke admin dan nikmati chat gratis 2 bulan ke pemilik grup @prabu08 !\nPilih yang nyaman untukmu. Terima kasih! 😊`;
             
           await bot.sendMessage(chatId, warningMessage);
       }
   }
});

// Handler untuk perintah statistik
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (msg.chat.type === 'private') {
        await bot.sendMessage(chatId, '❌ Perintah ini hanya bisa digunakan di dalam grup!');
        return;
    }

    if (!groupStats[chatId]) {
        await bot.sendMessage(chatId, '📊 Belum ada statistik untuk grup ini.');
        return;
    }

    try {
		// Mengambil daftar member grup secara real-time
		const chatMembers = await bot.getChatAdministrators(chatId);
		const adminIds = new Set(chatMembers.map(member => member.user.id));

		// Update waktu real-time
		const currentTime = moment().tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss');
		
		let statsMessage = `📊 <b>Statistik Grup</b>\n⏰ <code>${currentTime} WIB</code>\n\n`;

		// Hitung total statistik real-time
		const totalMessages = Object.values(groupStats[chatId].messages)
			.reduce((sum, user) => sum + user.count, 0);
		const totalCharacters = Object.values(groupStats[chatId].messages)
			.reduce((sum, user) => sum + user.characters, 0);
		const totalVoiceNoteDuration = Object.values(groupStats[chatId].messages)
			.reduce((sum, user) => sum + user.voiceNoteDuration, 0); // Total durasi voice note

		statsMessage += `📋 <b>RINGKASAN AKTIVITAS:</b>\n├ 📨 Total Pesan: <code>${totalMessages.toLocaleString()}</code>\n├ 📝 Total Karakter: <code>${totalCharacters.toLocaleString()}</code>\n└ ⏰ Total Durasi Voice Note: <code>${totalVoiceNoteDuration} detik</code>\n└ 🚫 Pesan Dihapus: <code>${groupStats[chatId].deletedMessages}</code>\n\n`;
        
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

		for (let i = 0; i < topUsers.length; i++) {
			const user = topUsers[i];
			const isAdmin = adminIds.has(parseInt(user.userId));
			const medal = i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`;
			const adminBadge = isAdmin ? ' 👑' : '';
			const username = user.username || 'Anonymous';
			const messageCount = user.count.toLocaleString();
			const charCount = user.characters.toLocaleString();
            
			statsMessage += `${medal} @${username}${adminBadge}\n├ 💬 Pesan: <code>${messageCount}</code>\n├ 📝 Karakter: <code>${charCount}</code>\n└ ⏰ Durasi Voice Note: <code>${user.voiceNoteDuration} detik</code>\n\n`;
		}

		statsMessage += `\n<i>💡 Statistik diperbarui secara real-time\n📅 Reset otomatis setiap tengah malam WIB</i>`;
		
		await bot.sendMessage(chatId, statsMessage, { 
			parse_mode: 'HTML',
			disable_web_page_preview: true 
		});

    } catch (error) {
	    console.error('Error generating stats:', error);
	    await bot.sendMessage(
		    chatId,
		    '❌ Terjadi kesalahan saat mengambil statistik.\nSilakan coba lagi nanti.',
		    { parse_mode: 'HTML' }
	    );
    }
});

console.log('Bot telah dijalankan!');
