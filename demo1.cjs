const TelegramBot = require('node-telegram-bot-api');

// Ganti dengan token bot Anda
const token = '7534541078:AAGmAcTMfcmezzUPg8TgQJtSVqb_7XpDnnE';

// Ganti dengan ID admin
const adminId = '5988451717';  // ID admin yang akan menerima pesan pengguna

// Buat bot dengan mode polling
const bot = new TelegramBot(token, {polling: true});

// Balasan saat pengguna mengirimkan /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  // Buat pesan dengan teks yang indah dan inline button
  const welcomeMessage = `
    *Selamat datang di Bot Live Chat!*\n
    Saya di sini untuk membantu Anda terhubung dengan admin.\n
    _Silakan kirim pesan Anda, dan admin kami akan segera merespons._\n
    Tekan tombol di bawah ini untuk mulai chatting atau mencari bantuan lainnya.
  `;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💬 Mulai Live Chat", callback_data: 'live_chat' }],
        [{ text: "❓ Bantuan", callback_data: 'help' }]
      ]
    },
    parse_mode: 'Markdown'
  };

  // Kirim pesan sambutan beserta inline buttons
  bot.sendMessage(chatId, welcomeMessage, options);
});

// Inline query untuk mencari bantuan
bot.on('inline_query', (query) => {
  const results = [{
    type: 'article',
    id: '1',
    title: 'Live Chat dengan Admin',
    input_message_content: {
      message_text: '💬 Live chat dengan admin aktif.\nSilakan kirim pesan Anda untuk segera terhubung dengan admin kami.',
      parse_mode: 'Markdown'
    },
    description: 'Mulai percakapan dengan admin',
  }, {
    type: 'article',
    id: '2',
    title: 'Cara Menggunakan Bot',
    input_message_content: {
      message_text: '*Cara Menggunakan Bot*\n\n1. Kirim pesan atau pertanyaan Anda.\n2. Admin akan merespon secepatnya.\n3. Anda juga dapat melihat riwayat percakapan.',
      parse_mode: 'Markdown'
    },
    description: 'Informasi tentang cara menggunakan bot',
  }];

  bot.answerInlineQuery(query.id, results);
});

// Callback query handler untuk inline buttons
bot.on('callback_query', (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;

  if (callbackQuery.data === 'live_chat') {
    bot.sendMessage(chatId, '💬 *Anda sekarang berada di mode Live Chat!*\n\n_Silakan kirim pesan Anda dan admin kami akan segera merespons._', { parse_mode: 'Markdown' });
  } else if (callbackQuery.data === 'help') {
    bot.sendMessage(chatId, '❓ *Bantuan Bot*\n\n1. Kirim pesan atau pertanyaan.\n2. Admin akan merespons secepat mungkin.\n3. Nikmati pengalaman chatting langsung!', { parse_mode: 'Markdown' });
  }

  // Beri respon ke callback query (hilangkan loading di button)
  bot.answerCallbackQuery(callbackQuery.id);
});

// Menerima pesan pengguna dan meneruskan ke admin
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userName = msg.from.username || msg.from.first_name || 'Pengguna';
  
  if (msg.text !== '/start') {
    // Kirim pesan pengguna ke admin
    bot.sendMessage(adminId, `Pesan baru dari ${userName} (${userId}):\n${msg.text}`);
  
    // Kirim konfirmasi ke pengguna
    bot.sendMessage(chatId, '💬 *Pesan Anda telah diteruskan ke admin.*\n_Mohon tunggu balasan._', { parse_mode: 'Markdown' });
  }
});

// Mendengarkan pesan balasan dari admin
bot.on('message', (msg) => {
  if (msg.reply_to_message && msg.chat.id == adminId) {
    const originalUserId = msg.reply_to_message.text.match(/\((\d+)\)/)[1];  // Menangkap userId dari pesan admin

    // Kirim balasan dari admin ke pengguna
    bot.sendMessage(originalUserId, `📩 *Balasan dari admin:*\n${msg.text}`, { parse_mode: 'Markdown' });
    bot.sendMessage(adminId, `Balasan Anda telah dikirim ke pengguna.`);
  }
});
