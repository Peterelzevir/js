const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

// Ganti TOKEN dengan token bot Anda
const TOKEN = '7804320004:AAFPV-2_OtdKMhEXhTPbScuNo6RVNmhls2A';
const bot = new TelegramBot(TOKEN, { polling: true });

// Catat waktu bot mulai
const botStartTime = Date.now();

// ID Admin (Ganti dengan ID Telegram admin bot)
const ADMIN_ID = [5988451717]; // Masukkan ID admin sebagai array

// Fungsi untuk mendapatkan waktu saat ini (WIB)
const getCurrentTime = () => {
  const date = new Date();
  const options = { timeZone: 'Asia/Jakarta', hour12: false };
  return {
    date: date.toLocaleDateString('id-ID', options),
    time: date.toLocaleTimeString('id-ID', options),
  };
};

// Fungsi untuk membuat ID invoice random
const generateInvoiceID = () => `#INV-${Date.now().toString().slice(-6)}`;

// Fungsi untuk menghitung uptime bot
const getUptime = () => {
  const seconds = Math.floor(process.uptime());
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours} jam, ${minutes} menit, ${secs} detik ✅`;
};

// Respon untuk perintah /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  // Pesan awal dengan foto
  const photoPath = path.resolve(__dirname, 'hiyaok.jpg');
  const caption = `*Bot ini adalah asisten @hiyaok dan diprogram oleh [@hiyaok](https://t.me/hiyaok).*\n\n` +
                  `_Jika Anda ingin bot seperti ini, silakan chat admin!_`;

  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔔 ping', callback_data: 'ping' }],
        [{ text: '👀 back', callback_data: 'back' }]
      ],
    },
  };

  bot.sendPhoto(chatId, photoPath, { caption, ...options });
});

// Respon untuk tombol inline
bot.on('callback_query', async (callbackQuery) => {
  const { data, message, id } = callbackQuery;

  if (data === 'ping') {
    // Waktu awal untuk menghitung kecepatan respons
    const startTime = Date.now();

    // Perbarui pesan menjadi "pinging..." dengan foto
    const photoPath = path.resolve(__dirname, 'ping.jpg');
    const options = {
      chat_id: message.chat.id,
      message_id: message.message_id,
      parse_mode: 'Markdown',
      caption: '`pinging...`',
    };

    await bot.editMessageMedia(
      {
        type: 'photo',
        media: { source: photoPath },
        caption: options.caption,
        parse_mode: options.parse_mode,
      },
      {
        chat_id: options.chat_id,
        message_id: options.message_id,
      }
    );

    // Hitung latency
    const latency = Date.now() - startTime;

    // Perbarui pesan dengan hasil ping dan uptime
    const newCaption = `*ping sukses!*\n\n` +
                       `*waktu aktif ✅ :* \`${getUptime()}\`\n` +
                       `*kecepatan 👀:* \`${latency} ms\``;

    await bot.editMessageMedia(
      {
        type: 'photo',
        media: { source: photoPath },
        caption: newCaption,
        parse_mode: 'Markdown',
      },
      {
        chat_id: options.chat_id,
        message_id: options.message_id,
      }
    );

    // Jawab callback query
    bot.answerCallbackQuery(id, { text: 'ping berhasil !' });
  } else if (data === 'back') {
    // Kembalikan pesan awal dengan foto
    const photoPath = path.resolve(__dirname, 'hiyaok.jpg');
    const caption = `*Bot ini adalah asisten @hiyaok dan di program oleh [@hiyaok](https://t.me/hiyaok).*\n\n` +
                    `_Jika Anda ingin bot seperti ini silakan chat admin !_`;

    await bot.editMessageMedia(
      {
        type: 'photo',
        media: { source: photoPath },
        caption,
        parse_mode: 'Markdown',
      },
      {
        chat_id: message.chat.id,
        message_id: message.message_id,
      }
    );

    // Jawab callback query
    bot.answerCallbackQuery(id, { text: 'Back Berhasil 👀' });
  }
});

// Inline query handler
bot.on('inline_query', async (query) => {
  const { query: input, from } = query;

  // Periksa jika admin
  const isAdmin = ADMIN_ID.includes(from.id);

  // Parsing input
  const args = input.split(' ');
  if (args[0] === 'payment' && args.length === 3 && isAdmin) {
    const username = args[1];
    const amount = parseInt(args[2], 10);

    if (!isNaN(amount)) {
      // Gunakan foto QRIS
      const qrisPath = path.resolve(__dirname, 'qris.jpg');
      
      const article = {
        type: 'article',
        id: 'payment',
        title: 'Payment Desk - Payment Asisten Hiyaok',
        description: `Invoice untuk @${username} sebesar Rp.${amount}`,
        thumb_url: path.resolve(__dirname, 'asis.jpg'),
        input_message_content: {
          message_text: `Processing payment...`, // Temporary text that will be replaced
          parse_mode: 'Markdown',
        },
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ sukses', callback_data: `success|${username}` }],
          ],
        },
      };

      await bot.answerInlineQuery(query.id, [article], { cache_time: 0 });

      // After answering inline query, send the QRIS photo with invoice details
      const inlineMessageId = query.id;
      const caption = `
\`\`\`
⚡️━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⚡️
┏━━━━━━᭒᭕━━━━━━┓
     💫 **PAYMENT INVOICE** 💫
┗━━━━━━᭒᭕━━━━━━┛

▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂

██╗  ██╗██╗██╗   ██╗ █████╗  ██████╗ ██╗  ██╗
██║  ██║██║╚██╗ ██╔╝██╔══██╗██╔═══██╗██║ ██╔╝
███████║██║ ╚████╔╝ ███████║██║   ██║█████╔╝ 
██╔══██║██║  ╚██╔╝  ██╔══██║██║   ██║██╔═██╗ 
██║  ██║██║   ██║   ██║  ██║╚██████╔╝██║  ██╗
╚═╝  ╚═╝╚═╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝
                 PREMIUM SERVICE

❯❯ 🌟 INVOICE DETAILS 🌟 ❮❮
╭────────────────────────╮
│ 📋 ID    :  ${generateInvoiceID()} │
│ 👑 User  : @${username} │
│ 📅 Date  : ${getCurrentTime().date} │
│ ⏰ Time  : ${getCurrentTime().time} │
╰────────────────────────╯

⚜️━━━━━━━ PAYMENT DETAILS ━━━━━━━⚜️

  💰 Price   : Rp.${amount}

┏━━━━━━━━ PAYMENT METHOD ━━━━━━━┓
  **QRIS : SCAN QR DIATAS**
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

🌟 STATUS: *PENDING 💬*

•────────•°•❀•°•────────•
     ✨ Thank You for Choosing Us! ✨
         (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧
   
   🔥 Support : @hiyaok 🔥
•────────•°•❀•°•────────•

⚡️━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⚡️
\`\`\``;

      return;
    }
  }

  // Jika bukan admin atau salah input
  const errorArticle = {
    type: 'article',
    id: 'not_admin',
    title: 'Anda bukan admin',
    description: 'Maaf, Anda bukan admin.',
    input_message_content: {
      message_text: '❗Sorry ya, kamu bukan admin!',
    },
  };

  bot.answerInlineQuery(query.id, [errorArticle], { cache_time: 0 });
});

// Callback query untuk tombol "Sukses"
bot.on('callback_query', async (callbackQuery) => {
  const { data, from, message, id } = callbackQuery;
  const [action, username] = data.split('|');

  // Periksa admin
  const isAdmin = ADMIN_ID.includes(from.id);

  if (action === 'success') {
    if (isAdmin) {
      // Ganti foto dan caption menjadi selesai
      const photoPath = path.resolve(__dirname, 'sukses.jpg');
      const caption = `
\`\`\`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
█░█ █ █▄█ ▄▀█ █▀█ █▄▀   █▀█ █▀█ █▀▀
█▀█ █ ░█░ █▀█ █▄█ █░█   █▀▀ █▄█ ██▄
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

        𝙏𝙍𝘼𝙉𝙎𝘼𝙆𝙎𝙄 𝙎𝙀𝙇𝙀𝙎𝘼𝙄
          ✨ COMPLETED ✨

•❅──────✧❅✦❅✧──────❅•

 Thank you for your transaction! @${username}

•❅──────✧❅✦❅✧──────❅•

▄▀█ █▀ █ █▀ ▀█▀ ▄▀█ █▄░█
█▀█ ▄█ █ ▄█ ░█░ █▀█ █░▀█

█░█ █ █▄█ ▄▀█ █▀█ █▄▀
█▀█ █ ░█░ █▀█ █▄█ █░█

by @asistenhiyaokbot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
\`\`\`
`;

      await bot.editMessageMedia(
        {
          type: 'photo',
          media: { source: photoPath },
          caption,
          parse_mode: 'Markdown',
        },
        {
          chat_id: message.chat.id,
          message_id: message.message_id,
        }
      );

      bot.answerCallbackQuery(id, { text: 'Transaksi selesai!' });
    } else {
      bot.answerCallbackQuery(id, { text: 'Bukan admin, jancok!', show_alert: true });
    }
  }
});

console.log('Bot berjalan...');
