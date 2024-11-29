const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

// Konfigurasi Bot
const bot = new Telegraf('7354627036:AAFXG281EqpBwFkx7HIZ-y32e-DmfrshqxM');
const adminId = '5988451717'; // ID Admin

let data;

try {
    const rawData = fs.readFileSync('data.json', 'utf8');
    data = rawData ? JSON.parse(rawData) : { users: {}, banned: [] }; // Default structure if empty
} catch (error) {
    console.error("Error reading or parsing data.json:", error);
    data = { users: {}, banned: [] }; // Initialize with default structure on error
}
// Fungsi Simpan Data
function saveData() {
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

// Middleware Cek Banned
bot.use((ctx, next) => {
    if (data.banned.includes(ctx.from.id)) {
        return ctx.reply('❌ Anda telah di-*banned* oleh admin\n\n👀 chat admin now!');
    }
    return next();
});

// Fungsi Cari Pasangan
async function findPartner(userId) {
    const user = data.users[userId];
    const potentialPartnerId = Object.keys(data.users).find((id) => {
        const partner = data.users[id];
        return (
            id !== userId.toString() && // Bukan diri sendiri
            !partner.partner && // Tidak sedang terhubung
            partner.gender && // Sudah set gender
            partner.gender !== user.gender && // Lawan jenis
            !data.banned.includes(Number(id)) // Tidak di-banned
        );
    });

    if (potentialPartnerId) {
        user.partner = potentialPartnerId;
        data.users[potentialPartnerId].partner = userId;
        saveData();
        return potentialPartnerId;
    }
    return null;
}

// /start
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (!data.users[userId]) {
        data.users[userId] = { id: userId, gender: null, partner: null };
        saveData();
    }

    ctx.reply(
        `👋 *selamat datang di Anonymous Chat! ✅*\n\n` +
        `gunakan perintah berikut untuk memulai:\n` +
        `👉 \`/next\` - Cari pasangan lain 👀\n` +
        `👉 \`/stop\` - Akhiri chat 🙏🏻\n` +
        `👉 \`/setgender\` - Atur gender 😎\n` +
        `👉 \`/help\` - Bantuan 👀`,
        { parse_mode: 'Markdown' }
    );
});

// /setgender
bot.command('setgender', (ctx) => {
    ctx.reply(
        '⚙️ Pilih gender Anda:',
        Markup.inlineKeyboard([
            [Markup.button.callback('👨 Pria', 'gender_male')],
            [Markup.button.callback('👩 Wanita', 'gender_female')],
        ])
    );
});

bot.action('gender_male', (ctx) => {
    data.users[ctx.from.id].gender = 'Pria';
    saveData();
    ctx.editMessageText('✅ Gender Anda telah diatur ke *Pria*.', { parse_mode: 'Markdown' });
});

bot.action('gender_female', (ctx) => {
    data.users[ctx.from.id].gender = 'Wanita';
    saveData();
    ctx.editMessageText('✅ Gender Anda telah diatur ke *Wanita*.', { parse_mode: 'Markdown' });
});

// /next (Cari Pasangan)
bot.command('next', async (ctx) => {
    const userId = ctx.from.id;
    const user = data.users[userId];

    if (user.partner) {
        ctx.reply('⚠️ Anda sudah terhubung, gunakan `/stop` untuk mengakhiri.');
        return;
    }

    const searchMsg = await ctx.reply('🔍 _Mencari pasangan..._', { parse_mode: 'Markdown' });
    const partnerId = await findPartner(userId);

    if (partnerId) {
        await ctx.deleteMessage(searchMsg.message_id); // Hapus pesan pencarian
        ctx.reply('✨ *Pasangan ditemukan! Mulailah mengobrol.*', { parse_mode: 'Markdown' });
        bot.telegram.sendMessage(partnerId, '✨ *Pasangan ditemukan! Mulailah mengobrol.*', { parse_mode: 'Markdown' });
    } else {
        ctx.reply('❌ Tidak ada pasangan yang tersedia saat ini. Coba lagi nanti.');
    }
});

// /stop (Hentikan Chat)
bot.command('stop', (ctx) => {
    const userId = ctx.from.id;
    const user = data.users[userId];

    if (user.partner) {
        const partnerId = user.partner;
        user.partner = null;
        data.users[partnerId].partner = null;
        saveData();

        ctx.reply('❌ Chat dihentikan.');
        bot.telegram.sendMessage(partnerId, '❌ Pasangan Anda menghentikan chat.');

        // Tampilkan pilihan laporan
        ctx.reply(
            '🚨 Apakah Anda ingin melaporkan pasangan chat ini?',
            Markup.inlineKeyboard([
                [Markup.button.callback('⚠️ Kekerasan', `report_${partnerId}_kekerasan`)],
                [Markup.button.callback('🔞 Pornografi', `report_${partnerId}_pornografi`)],
                [Markup.button.callback('💰 Pemerasan', `report_${partnerId}_pemerasan`)],
                [Markup.button.callback('❌ Scamming', `report_${partnerId}_scamming`)],
                [Markup.button.callback('✏️ Custom Report', `report_${partnerId}_custom`)],
            ])
        );
    } else {
        ctx.reply('⚠️ Anda tidak sedang terhubung dengan siapa pun.');
    }
});

// Handle Report
bot.action(/report_(\d+)_(.+)/, (ctx) => {
    const [, reportedId, reason] = ctx.match;
    const reporterId = ctx.from.id;

    bot.telegram.sendMessage(
        adminId,
        `📣 *Laporan Pengguna*\n\n` +
        `👤 *Pelapor:* ${reporterId}\n` +
        `👤 *Dilaporkan:* ${reportedId}\n` +
        `⚠️ *Alasan:* ${reason}`,
        { parse_mode: 'Markdown' }
    );
    ctx.reply('✅ Laporan Anda telah dikirim ke admin.');
});

// /totaluser
bot.command('totaluser', (ctx) => {
    const totalUsers = Object.keys(data.users).length;
    const userDetails = Object.values(data.users)
        .map((u) => `👤 *ID:* ${u.id}\n💡 *Gender:* ${u.gender || 'Belum diatur'}\n🔗 *Status:* ${u.partner ? 'Terhubung' : 'Tidak terhubung'}`)
        .join('\n\n');

    ctx.reply(
        `📊 *Total Pengguna:*\n\n` +
        `📌 Jumlah Pengguna: ${totalUsers} orang\n\n` +
        `${userDetails}`,
        { parse_mode: 'Markdown' }
    );
});

// /broadcast
bot.command('broadcast', async (ctx) => {
    if (ctx.from.id.toString() !== adminId) {
        ctx.reply('❌ Perintah ini hanya untuk admin.');
        return;
    }

    const message = ctx.message.reply_to_message;
    if (!message) {
        ctx.reply('❌ Balas pesan yang ingin Anda broadcast.');
        return;
    }

    const userIds = Object.keys(data.users);
    let sent = 0;
    let failed = 0;
    const progressMsg = await ctx.reply(`🔄 *Proses Broadcast...*\n📤 Berhasil: ${sent}\n❌ Gagal: ${failed}`, { parse_mode: 'Markdown' });

    for (const id of userIds) {
        try {
            if (message.text) {
                await bot.telegram.sendMessage(id, message.text);
            } else if (message.photo) {
                await bot.telegram.sendPhoto(id, message.photo[0].file_id, { caption: message.caption });
            } else if (message.video) {
                await bot.telegram.sendVideo(id, message.video.file_id, { caption: message.caption });
            }
            sent++;
        } catch {
            failed++;
        }
        await bot.telegram.editMessageText(
            progressMsg.chat.id,
            progressMsg.message_id,
            null,
            `🔄 *Proses Broadcast...*\n📤 Berhasil: ${sent}\n❌ Gagal: ${failed}`,
            { parse_mode: 'Markdown' }
        );
    }

    await bot.telegram.editMessageText(
        progressMsg.chat.id,
        progressMsg.message_id,
        null,
        `✅ *Broadcast selesai!*\n📤 Berhasil: ${sent}\n❌ Gagal: ${failed}`,
        { parse_mode: 'Markdown' }
    );
});

// Jalankan Bot
bot.launch();
console.log('Bot berjalan...');
