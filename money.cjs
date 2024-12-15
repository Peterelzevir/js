const TelegramBot = require("node-telegram-bot-api");

// Masukkan token bot Anda di sini
const BOT_TOKEN = "YOUR_BOT_TOKEN";
const ADMIN_ID = "YOUR_ADMIN_ID"; // Ganti dengan ID admin bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Penyimpanan sementara di memori
const userBalances = {};
const pendingWithdrawals = {};
const pendingMedia = {};

// Fungsi untuk format angka
const formatCurrency = (num) => new Intl.NumberFormat("id-ID").format(num);

// Fungsi menu utama
const sendMainMenu = (chatId, messageId = null) => {
    const text =
        "👋 *Selamat datang cantik di bot @cantikmoneybot*\n\n" +
        "1. 🔔 Setiap foto/video/audio 18+ yang kamu kirim akan diberikan saldo 🤩\n" +
        "2. 👀 Full body + face untuk video/foto bagus dihargai lebih tinggi!\n" +
        "3. 👁‍🗨 VN desah terbaik akan dibayar lumayan! 😘\n\n" +
        "✅ _Notes_: Foto/Video/Audio kamu 100% *privasi dijaga!*\n\n" +
        "🤩 Silakan pilih jenis yang kamu kirim cantik ❤";

    const options = {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "📸 Kirim Foto 18+ 🤩", callback_data: "send_photo" },
                    { text: "🎥 Kirim Video 😋", callback_data: "send_video" },
                ],
                [
                    { text: "🎵 Kirim Audio/VN", callback_data: "send_audio" },
                    { text: "💰 Saldo Saya", callback_data: "check_balance" },
                ],
                [
                    { text: "🏧 Withdraw Saldo", callback_data: "withdraw" },
                    { text: "📜 Riwayat Mutasi", callback_data: "view_history" },
                ],
            ],
        },
    };

    if (messageId) {
        bot.editMessageText(text, { chat_id: chatId, message_id: messageId, ...options });
    } else {
        bot.sendMessage(chatId, text, options);
    }
};

// Fungsi start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (!userBalances[chatId]) {
        userBalances[chatId] = { balance: 0, history: [] };
    }
    sendMainMenu(chatId);
});

// Callback Query (semua interaksi inline button)
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    if (data === "send_photo") {
        bot.editMessageText("📸 *Silakan kirim foto mantep kamu di sini, cantik!*", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_to_main" }]],
            },
        });
        pendingMedia[chatId] = "photo";
    } else if (data === "send_video") {
        bot.editMessageText("🎥 *Silakan kirim video mantep kamu di sini, cantik!*", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_to_main" }]],
            },
        });
        pendingMedia[chatId] = "video";
    } else if (data === "send_audio") {
        bot.editMessageText("🎤 *Silakan kirim audio/VN nikmat kamu di sini, cantik!*", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_to_main" }]],
            },
        });
        pendingMedia[chatId] = "audio";
    } else if (data === "check_balance") {
        const balance = userBalances[chatId]?.balance || 0;
        bot.editMessageText(`💰 *Saldo cantik saat ini:* \`Rp ${formatCurrency(balance)}\``, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_to_main" }]],
            },
        });
    } else if (data === "view_history") {
        const history = userBalances[chatId]?.history || [];
        const historyText = history.length
            ? history.map((item, index) => `_${index + 1}. ${item}_`).join("\n")
            : "_Belum ada riwayat saldo._";
        bot.editMessageText(`📜 *Riwayat Mutasi Saldo:*\n\n${historyText}`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_to_main" }]],
            },
        });
    } else if (data === "withdraw") {
        handleWithdraw(chatId, messageId);
    } else if (data.startsWith("wd_")) {
        const method = data.split("_")[1];
        const userBalance = userBalances[chatId]?.balance || 0;

        pendingWithdrawals[chatId] = { method, amount: userBalance };

        bot.editMessageText("✅ *Permintaan withdraw sedang diproses admin.*", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
        });

        bot.sendMessage(
            ADMIN_ID,
            `💵 *Permintaan Withdraw Baru:*\n\n👤 Pengguna: [@${callbackQuery.from.username || chatId}](tg://user?id=${chatId})\n💰 Jumlah: \`Rp ${formatCurrency(
                userBalance
            )}\`\n📌 Metode: *${method.toUpperCase()}*`,
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "✅ Terima", callback_data: `accept_wd_${chatId}` }],
                        [{ text: "❌ Tolak", callback_data: `reject_wd_${chatId}` }],
                    ],
                },
            }
        );
    } else if (data.startsWith("accept_wd_")) {
        const userId = data.split("_")[2];
        const amount = pendingWithdrawals[userId]?.amount;

        if (amount) {
            userBalances[userId].balance -= amount;
            delete pendingWithdrawals[userId];

            bot.sendMessage(userId, "✅ *Withdraw Anda telah berhasil diproses!*", { parse_mode: "Markdown" });
            bot.sendMessage(ADMIN_ID, "✅ *Withdraw telah diterima.*", { parse_mode: "Markdown" });
        }
    } else if (data.startsWith("reject_wd_")) {
        const userId = data.split("_")[2];
        delete pendingWithdrawals[userId];

        bot.sendMessage(userId, "❌ *Withdraw Anda telah ditolak.*", { parse_mode: "Markdown" });
        bot.sendMessage(ADMIN_ID, "❌ *Withdraw telah ditolak.*", { parse_mode: "Markdown" });
    } else if (data.startsWith("price_media_")) {
        const userId = data.split("_")[2];
        bot.sendMessage(ADMIN_ID, "💰 *Masukkan harga untuk media ini (contoh: 50000):*", { parse_mode: "Markdown" });

        bot.once("message", (msg) => {
            const price = parseInt(msg.text);

            if (isNaN(price)) {
                bot.sendMessage(ADMIN_ID, "⚠️ *Mohon masukkan angka yang valid.*", { parse_mode: "Markdown" });
                return;
            }

            if (!userBalances[userId]) {
                userBalances[userId] = { balance: 0, history: [] };
            }

            userBalances[userId].balance += price;
            userBalances[userId].history.push(`Media dihargai Rp ${formatCurrency(price)}`);

            bot.sendMessage(
                userId,
                `💵 *Media Anda telah dihargai sebesar:* \`Rp ${formatCurrency(price)}\`\n\n🤩 _Saldo Anda telah diperbarui, cantik!_`,
                { parse_mode: "Markdown" }
            );

            bot.sendMessage(ADMIN_ID, "✅ *Harga telah dikirim ke pengguna.*", { parse_mode: "Markdown" });
        });
    } else if (data === "back_to_main") {
        sendMainMenu(chatId, messageId);
    }
});

// Proses media dari pengguna
bot.on("message", (msg) => {
    const chatId = msg.chat.id;

    if (pendingMedia[chatId]) {
        const mediaType = pendingMedia[chatId];

        if (
            (mediaType === "photo" && msg.photo) ||
            (mediaType === "video" && msg.video) ||
            (mediaType === "audio" && (msg.audio || msg.voice))
        ) {
            bot.sendMessage(chatId, "📤 Media kamu sedang diverifikasi oleh admin saat ini, tunggu ya! 🤩");

            const caption = `📤 Media baru dari pengguna @${msg.from.username || msg.from.id}:\n\nStatus: *Menunggu Verifikasi*`;
            const options = {
                caption,
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "💲 Hargai Media", callback_data: `price_media_${chatId}` }],
                    ],
                },
            };

            if (mediaType === "photo") {
                bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, options);
            } else if (mediaType === "video") {
                bot.sendVideo(ADMIN_ID, msg.video.file_id, options);
            } else if (mediaType === "audio") {
                const audioFile = msg.audio || msg.voice;
                bot.sendAudio(ADMIN_ID, audioFile.file_id, options);
            }

            delete pendingMedia[chatId];
        } else {
            bot.sendMessage(chatId, `⚠️ Silakan kirim media berupa ${mediaType} dong cantik ❤`);
        }
    }
});

// Fitur withdraw
function handleWithdraw(chatId, messageId) {
    const userBalance = userBalances[chatId]?.balance || 0;

    if (userBalance < 100000) {
        bot.editMessageText(
            "⚠️ *Saldo Anda belum mencukupi untuk withdraw (minimal Rp 100,000).*",
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_to_main" }]],
                },
            }
        );
        return;
    }

    bot.editMessageText("🏧 *Pilih metode withdraw:*", {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "📱 Dana", callback_data: "wd_dana" },
                    { text: "📱 OVO", callback_data: "wd_ovo" },
                ],
                [
                    { text: "🏦 Bank", callback_data: "wd_bank" },
                    { text: "₿ Crypto", callback_data: "wd_crypto" },
                ],
                [{ text: "🔙 Kembali", callback_data: "back_to_main" }],
            ],
        },
    });
}
