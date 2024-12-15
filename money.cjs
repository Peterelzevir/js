const TelegramBot = require("node-telegram-bot-api");

// Masukkan token bot Anda di sini
const BOT_TOKEN = "6382437432:AAHA_GcEWeATBfDNLB8OCq5Knbk_6thx5xU";
const ADMIN_ID = "5988451717"; // Ganti dengan ID admin bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Penyimpanan sementara di memori
const userBalances = {};
const pendingWithdrawals = {};
const pendingMedia = {};

// Fungsi untuk format angka
const formatCurrency = (num) => new Intl.NumberFormat("id-ID").format(num);

// Fungsi start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (!userBalances[chatId]) {
        userBalances[chatId] = { balance: 0, history: [] };
    }

    bot.sendMessage(
        chatId,
        "👋 Selamat datang cantik di bot @cantikmoneybot\n\n1.🔔 setiap foto/video/audio 18+ yang kamu kirim akan di berikan saldo 🤩\n\n2.👀 full body + face untuk video/foto bagus dihargai lebih tinggi!\n\n3.👁‍🗨 vn desah terbaik akan dibayar lumayan!😘\n\n\n✅ notes : foto/video/audio kamu 100% privasi dijaga!\n\n🤩 silakan pilih jenis yg kamu kirim cantik ❤",
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "📸 Kirim Foto 18+ 🤩", callback_data: "send_photo" },
                        { text: "🎥 Kirim Video 😋", callback_data: "send_video" },
                    ],
                    [
                        { text: "🎵 Kirim Audio d****", callback_data: "send_audio" },
                        { text: "💰 Saldo Saya", callback_data: "check_balance" },
                    ],
                    [
                        { text: "🏧 Withdraw saldo", callback_data: "withdraw" },
                        { text: "📜 Riwayat Saldo", callback_data: "history" },
                    ],
                ],
            },
        }
    );
});

// Callback untuk inline button
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    // Hapus tombol setelah diklik
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });

    switch (data) {
        case "send_photo":
            bot.sendMessage(
                chatId,
                "📸 Silakan kirim foto mantep kamu beb disini. Kalau mau kirim yang lain, klik 'Cancel' ya! ❤",
                {
                    reply_markup: {
                        inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel" }]],
                    },
                }
            );
            pendingMedia[chatId] = "photo";
            break;

        case "send_video":
            bot.sendMessage(
                chatId,
                "🎥 Silakan kirim video mantep kamu beb disini. Kalau mau kirim yang lain, klik 'Cancel' ya! 😘",
                {
                    reply_markup: {
                        inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel" }]],
                    },
                }
            );
            pendingMedia[chatId] = "video";
            break;

        case "send_audio":
            bot.sendMessage(
                chatId,
                "🎵 Silakan kirim audio d**** nikmat kamu beb disini. Kalau mau kirim yang lain, klik 'Cancel' ya! 😋",
                {
                    reply_markup: {
                        inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel" }]],
                    },
                }
            );
            pendingMedia[chatId] = "audio";
            break;

        case "cancel":
            // Hapus status pending
            delete pendingMedia[chatId];
            bot.sendMessage(
                chatId,
                "✅ Kamu bisa pilih media lain untuk dikirim: 😍",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "📸 Kirim Foto 18+ 🤩", callback_data: "send_photo" },
                                { text: "🎥 Kirim Video 😋", callback_data: "send_video" },
                            ],
                            [{ text: "🎵 Kirim Audio d****", callback_data: "send_audio" }],
                        ],
                    },
                }
            );
            break;

        case "check_balance":
            const balance = userBalances[chatId]?.balance || 0;
            bot.sendMessage(chatId, `💰 Saldo cantik saat ini: Rp ${formatCurrency(balance)}`);
            break;

        case "withdraw":
            handleWithdraw(chatId);
            break;

        case "history":
            const history = userBalances[chatId]?.history || [];
            if (history.length === 0) {
                bot.sendMessage(chatId, "📜 Tidak ada riwayat transaksi.");
            } else {
                const formattedHistory = history.map((item, index) => `${index + 1}. ${item}`).join("\n");
                bot.sendMessage(chatId, `📜 Riwayat Transaksi Kamu:\n\n${formattedHistory}`);
            }
            break;
    }
});

// Proses media
bot.on("message", (msg) => {
    const chatId = msg.chat.id;

    if (pendingMedia[chatId]) {
        const mediaType = pendingMedia[chatId];

        if (
            (mediaType === "photo" && msg.photo) ||
            (mediaType === "video" && msg.video) ||
            (mediaType === "audio" && msg.audio)
        ) {
            bot.sendMessage(chatId, "📤 Media kamu sedang diverifikasi oleh admin saat ini, tunggu ya! 🤩");

            // Kirim ke admin
            const caption = `📤 Media baru dari pengguna @${msg.from.username || msg.from.id}:\n\nStatus: *Menunggu Verifikasi*`;
            const options = {
                caption,
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "💲 Hargai Media",
                                callback_data: `price_media_${chatId}`,
                            },
                        ],
                    ],
                },
            };

            if (mediaType === "photo") {
                bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, options);
            } else if (mediaType === "video") {
                bot.sendVideo(ADMIN_ID, msg.video.file_id, options);
            } else if (mediaType === "audio") {
                bot.sendAudio(ADMIN_ID, msg.audio.file_id, options);
            }

            delete pendingMedia[chatId];
        } else {
            bot.sendMessage(chatId, `⚠️ Silakan kirim media berupa ${mediaType} dong cantik ❤`);
        }
    }
});

// Fitur withdraw
function handleWithdraw(chatId) {
    const userBalance = userBalances[chatId]?.balance || 0;

    if (userBalance < 100000) {
        bot.sendMessage(
            chatId,
            "⚠️ Saldo Anda belum mencukupi untuk withdraw (minimal Rp 100,000)."
        );
        return;
    }

    bot.sendMessage(chatId, "🏧 Pilih metode withdraw:", {
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
            ],
        },
    });

    bot.on("callback_query", (callbackQuery) => {
        const method = callbackQuery.data.split("_")[1];

        pendingWithdrawals[chatId] = { method, amount: userBalance };
        bot.sendMessage(chatId, "✅ Permintaan withdraw Anda sedang diproses.");

        // Kirim ke admin
        bot.sendMessage(
            ADMIN_ID,
            `💵 Permintaan withdraw baru:\n\n👤 User: @${callbackQuery.from.username || chatId}\n💰 Jumlah: Rp ${formatCurrency(
                userBalance
            )}\n📌 Metode: ${method.toUpperCase()}`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "✅ Terima", callback_data: `accept_wd_${chatId}` }],
                        [{ text: "❌ Tolak", callback_data: `reject_wd_${chatId}` }],
                    ],
                },
            }
        );
    });
}

// Admin menerima/menolak withdraw
bot.on("callback_query", (callbackQuery) => {
    const data = callbackQuery.data;

    if (data.startsWith("accept_wd_")) {
        const userId = data.split("_")[2];
        const amount = pendingWithdrawals[userId]?.amount;

        if (amount) {
            userBalances[userId].balance -= amount;
            delete pendingWithdrawals[userId];

            bot.sendMessage(userId, "✅ Withdraw Anda telah berhasil diproses!");
            bot.sendMessage(ADMIN_ID, "✅ Withdraw telah diterima.");
        }
    } else if (data.startsWith("reject_wd_")) {
        const userId = data.split("_")[2];

        delete pendingWithdrawals[userId];
        bot.sendMessage(
            userId,
            "❌ Withdraw Anda telah ditolak. Silakan hubungi admin untuk informasi lebih lanjut."
        );
        bot.sendMessage(ADMIN_ID, "❌ Withdraw telah ditolak.");
    }
});
