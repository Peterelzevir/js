const TelegramBot = require('node-telegram-bot-api');

// Gantikan 'YOUR_TELEGRAM_BOT_TOKEN' dengan token bot kamu
const token = '7534541078:AAGm61ixlg0eAwxX_PV_Pn0xiN7t0XhlXgo';
const bot = new TelegramBot(token, { polling: true });

// Fungsi untuk memeriksa pertanyaan dan membalasnya
function checkMessage(msg) {
  const text = msg.text.toLowerCase();

  if (/cara.*bergabung.*grup/i.test(text)) {
    return 'Untuk bergabung, Anda hanya perlu klik tautan undangan yang telah dibagikan, atau minta admin untuk menambahkan Anda.';
  }

  if (/aturan.*grup/i.test(text)) {
    return 'Aturan utama biasanya meliputi: tidak ada spam, hormati sesama anggota, tidak ada konten SARA, dan hindari topik yang dapat memicu konflik.';
  }

  if (/siapa.*admin.*grup/i.test(text)) {
    return 'Untuk melihat daftar admin, tanyakan langsung di grup.';
  }

  if (/apa.*harus.*dilakukan.*jika.*anggota.*melanggar.*aturan/i.test(text)) {
    return 'Laporkan ke admin dengan mengirim pesan pribadi.';
  }

  if (/setelah.*bergabung.*grup/i.test(text)) {
    return 'A) Berbagi aplikasi.\nB) Mengobrol tentang berbagai hal yang positif.';
  }

  // Tambahkan ini untuk menangani pesan yang tidak dikenali
  return 'Pertanyaan Anda tidak dikenali. Silakan hubungi admin grup untuk informasi lebih lanjut.';
}

// Event listener untuk semua pesan masuk
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const response = checkMessage(msg);

  if (response) {
    // Membalas pesan yang di-detect dengan cara mereply
    bot.sendMessage(chatId, response, { reply_to_message_id: msg.message_id });
  }
});
