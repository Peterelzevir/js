const TelegramBot = require('node-telegram-bot-api');
const moment = require('moment');
moment.locale('id'); // Set bahasa Indonesia

// Token bot
const token = '6701025784:AAHsI42y2VeOsdreHVqO_WI-GQRhL6HdcQ4';
const bot = new TelegramBot(token, { polling: true });

// Fungsi untuk membuat kalender dalam bentuk teks monospace
function generateCalendar(month, year) {
  let calendar = `📅 *Kalender ${moment(month + '-' + year, 'MM-YYYY').format('MMMM YYYY')}*\n\n`;
  calendar += '```';
  calendar += 'Mo Tu We Th Fr Sa Su\n';
  const startOfMonth = moment(`${year}-${month}`, 'YYYY-MM').startOf('month');
  const endOfMonth = moment(`${year}-${month}`, 'YYYY-MM').endOf('month');
  let day = startOfMonth.day(); // Hari pertama bulan
  day = day === 0 ? 7 : day; // Ubah hari minggu (0) jadi 7
  calendar += '   '.repeat(day - 1);

  for (let date = 1; date <= endOfMonth.date(); date++) {
    calendar += (' ' + date).slice(-2) + ' ';
    if ((date + day - 1) % 7 === 0) calendar += '\n'; // Ganti baris setiap minggu
  }
  calendar += '```';

  return calendar;
}

// Fungsi untuk membuat inline keyboard button untuk navigasi
function generateInlineKeyboard(month, year) {
  return {
    inline_keyboard: [
      [
        { text: '⬅️ Bulan Sebelumnya', callback_data: `prev_month_${month}_${year}` },
        { text: 'Bulan Berikutnya ➡️', callback_data: `next_month_${month}_${year}` },
      ],
      [
        { text: '⬅️ Tahun Sebelumnya', callback_data: `prev_year_${month}_${year}` },
        { text: 'Tahun Berikutnya ➡️', callback_data: `next_year_${month}_${year}` },
      ],
    ],
  };
}

// Fungsi untuk mengirim kalender
function sendCalendar(chatId, month, year) {
  const calendar = generateCalendar(month, year);
  const keyboard = generateInlineKeyboard(month, year);
  bot.sendMessage(chatId, calendar, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

// Perintah /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const now = moment();
  sendCalendar(chatId, now.format('MM'), now.format('YYYY'));
});

// Tangani callback data dari inline keyboard
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  let [action, month, year] = data.split('_');
  month = parseInt(month);
  year = parseInt(year);

  if (action === 'next_month') {
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  } else if (action === 'prev_month') {
    month--;
    if (month < 1) {
      month = 12;
      year--;
    }
  } else if (action === 'next_year') {
    year++;
  } else if (action === 'prev_year') {
    year--;
  }

  // Edit pesan dengan kalender yang di-update
  bot.editMessageText(generateCalendar(month, year), {
    chat_id: chatId,
    message_id: callbackQuery.message.message_id,
    parse_mode: 'Markdown',
    reply_markup: generateInlineKeyboard(month, year),
  });
});
