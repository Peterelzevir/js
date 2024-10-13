const TelegramBot = require('node-telegram-bot-api');

// Ganti dengan token bot Anda
const token = '7517026994:AAE9Hp2p2alN50oqe9F1H_Rtvb1hv506DLk';

// Buat bot dengan mode polling
const bot = new TelegramBot(token, { polling: true });

let chatSessions = {};
let queue = [];
let activeAdminSession = false;
let blacklist = {}; // Penyimpanan blacklist

// Fungsi untuk memulai sesi live chat
function startChatSession(userId, chatId) {
  if (!chatSessions[userId]) {
    chatSessions[userId] = {
      chatId: chatId,
      startTime: Date.now(),
      timeout: setTimeout(() => {
        endChatSession(userId, false); // Akhiri sesi setelah 10 menit jika tidak ada aktivitas
      }, 10 * 60 * 1000) // Timeout 10 menit
    };
  }
}

// Fungsi untuk mengakhiri sesi live chat
function endChatSession(userId, manual = false) {
  const session = chatSessions[userId];
  if (session) {
    clearTimeout(session.timeout);
    delete chatSessions[userId];

    // Beritahu user bahwa sesi telah berakhir
    bot.sendMessage(session.chatId, manual ? '🚫 Sesi live chat telah dihentikan oleh admin.' : '⏲️ Sesi live chat berakhir setelah 10 menit tidak ada aktivitas.');

    // Jika ada user lain di antrian, mulai sesi mereka
    manageQueue();
  }
}

// Fungsi untuk menambahkan user ke blacklist
function blacklistUser(userId, chatId) {
  blacklist[userId] = true; // Tambahkan user ke daftar blacklist
  endChatSession(userId, true); // Hentikan sesi live chat

  // Beritahu user bahwa mereka masuk daftar blacklist
  bot.sendMessage(chatId, '⚠️ Anda telah masuk daftar blacklist dan tidak bisa lagi mengakses live chat.');
}

// Fungsi untuk memeriksa apakah user di-blacklist
function isBlacklisted(userId) {
  return blacklist[userId];
}

// Fungsi untuk mengelola antrian
function manageQueue() {
  if (queue.length > 0) {
    const nextUser = queue.shift(); // Ambil user pertama dari antrian
    const adminId = '5988451717';
    
    // Beritahu admin bahwa ada user baru yang membutuhkan perhatian
    bot.sendMessage(adminId, formatMessageToAdmin(nextUser.user, nextUser.message), {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Hentikan Sesi', callback_data: `end_chat_${nextUser.user.id}` }],
          [{ text: '🚫 Blacklist User', callback_data: `blacklist_${nextUser.user.id}` }]
        ]
      }
    });
    
    // Mulai sesi live chat user tersebut
    startChatSession(nextUser.user.id, nextUser.message.chat.id);
    
    // Update status antrian ke user yang sedang menunggu
    queue.forEach((userInQueue, index) => {
      bot.editMessageText(`⏳ Anda sekarang berada di posisi antrian ke-${queue.length + 1}\n\n🙂 Mohon tunggu dan jangan khawatir pesan anda akan otomatis terkirim ke admin ketika anda sudah memasuki sesi livechat`, {
        chat_id: userInQueue.message.chat.id,
        message_id: userInQueue.queueMessageId
      });
    });
  } else {
    activeAdminSession = false; // Tidak ada sesi yang aktif
  }
}

// Fungsi untuk memformat laporan ke admin dengan emoji dan gaya teks
function formatMessageToAdmin(user, message) {
  return `
  📥 *Pesan Baru dari User*: 
  *Nama*: ${user.first_name || ''} ${user.last_name || ''}
  *Username*: @${user.username || 'N/A'}
  *User ID*: ${user.id}

  💬 *Pesan*: 
  \`${message.text}\`
  
  🔄 *Balas untuk memulai percakapan live chat*.
  `;
}

// Menangani pesan dari user
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (isBlacklisted(userId)) {
    bot.sendMessage(chatId, '⚠️ Anda tidak bisa mengakses live chat karena Anda telah di-blacklist');
    return;
  }

  if (msg.text === '/start') {
    // Pesan untuk user saat memulai bot
    const welcomeMessage = `
    *Selamat datang di Bot Live Chat 🙂!*\n🙏🏻 Saya di sini untuk membantu Anda terhubung dengan admin.\n\n📢 _Silakan kirim pesan Anda, dan admin kami akan segera merespons._\n\n✅ Tekan tombol di bawah ini untuk mulai chatting atau mencari bantuan lainnya.
    `;
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💬 Mulai Live Chat", callback_data: 'live_chat' }],
          [{ text: "❓ Bantuan Live Chat", callback_data: 'help' }]
        ]
      },
      parse_mode: 'Markdown'
    };
    bot.sendMessage(chatId, welcomeMessage, options);
  } else {
    // Jika user mengirim pesan selain /start
    if (!chatSessions[userId]) {
      if (activeAdminSession) {
        // Jika admin sedang aktif dalam sesi, masukkan user ke antrian
        const queueMessage = `⏳ Anda berada di posisi antrian ke-${queue.length + 1}\n\n🙂 Mohon tunggu dan jangan khawatir pesan anda akan otomatis terkirim ke admin ketika anda sudah memasuki sesi livechat 🙏🏻`;
        bot.sendMessage(chatId, queueMessage).then((queueMessageData) => {
          queue.push({
            user: msg.from,
            message: msg,
            queueMessageId: queueMessageData.message_id
          });
        });
      } else {
        // Jika tidak ada sesi yang aktif, langsung mulai sesi baru
        startChatSession(userId, chatId);
        activeAdminSession = true;
        const adminId = '5988451717';
        bot.sendMessage(adminId, formatMessageToAdmin(msg.from, msg), {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Hentikan Sesi', callback_data: `end_chat_${msg.from.id}` }],
              [{ text: '🚫 Blacklist User', callback_data: `blacklist_${msg.from.id}` }]
            ]
          }
        });
      }
    } else {
      // Jika ada sesi live chat yang sedang berjalan, kirim pesan ke admin
      const adminId = '5988451717';
      bot.sendMessage(adminId, `💬 Pesan dari ${msg.from.first_name}: ${msg.text}`);
    }
  }
});

// Menangani balasan admin ke user
bot.on('text', (msg) => {
  if (msg.reply_to_message) {
    const userId = msg.reply_to_message.text.match(/User ID: (\d+)/)[1];
    if (chatSessions[userId]) {
      const userChatId = chatSessions[userId].chatId;
      bot.sendMessage(userChatId, `👤 Admin : ${msg.text}`);
    }
  }
});

// Menangani callback dari inline button
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === 'live_chat') {
    bot.sendMessage(chatId, '📢 Anda sekarang berada di mode Live Chat Kak ✅\n\n🙏🏻Silakan kirim pesan kamu');
  } else if (data === 'help') {
    bot.sendMessage(chatId, '❓ Bantuan : Kirim pesan Anda dan admin akan segera merespons.');
  } else if (data.startsWith('end_chat_')) {
    const userId = data.split('_')[2];
    endChatSession(userId, true);
  } else if (data.startsWith('blacklist_')) {
    const userId = data.split('_')[1];
    blacklistUser(userId, chatId);
  }

  bot.answerCallbackQuery(callbackQuery.id);
});
