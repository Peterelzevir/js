const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const vCard = require('vcards-js');
const path = require('path');
const axios = require('axios');

// Replace 'YOUR_BOT_TOKEN' with your actual bot token
const bot = new TelegramBot('7329081018:AAH56cF2bm5O9nxfOFJHAM4nIkEr9BMyfzE', { polling: true });

const userStates = {};
const ADMIN_ID = '7281335942'; // Replace with your admin's Telegram ID

// Function to send formatted message
function sendFormattedMessage(chatId, text) {
  return bot.sendMessage(chatId, `*\`${text}\`*`, { parse_mode: 'MarkdownV2' });
}

// Function to save user ID
async function saveUserId(userId) {
  const userIdsPath = path.join(__dirname, 'dataidj.txt');
  try {
    const data = await fs.readFile(userIdsPath, 'utf8');
    const userIds = data.split('\n').filter(Boolean);
    if (!userIds.includes(userId.toString())) {
      await fs.appendFile(userIdsPath, `${userId}\n`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(userIdsPath, `${userId}\n`);
    } else {
      console.error('Error saving user ID:', error);
    }
  }
}

// Middleware to check if user is an admin
function isAdmin(msg) {
  return msg.from.id.toString() === ADMIN_ID;
}

// Start command handler
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || 'pengguna';

  if (!isAdmin(msg)) {
    await bot.sendMessage(chatId, '📢 Halo Kak Bot Fast Cv Permanent / Bulanan Ready\n\nSilakan hubungi admin untuk membeli bot seperti ini\n📢 Permanent Bot Hanya 320rb [ bisa nego! ]\n\n\nNotes : Keuntungan Bot Cv Rapih - Super Fast - Anti Delay & Bisa Cv File Banyak Sekaligus ✅', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Beli', url: 'https://t.me/hiyaok' }]
        ]
      }
    });
    return;
  }

  await saveUserId(chatId);

  const keyboard = {
    inline_keyboard: [
      [{ text: 'CV FILE TXT TO VCF', callback_data: 'txt_to_vcf' }],
      [{ text: 'VCF TO TXT', callback_data: 'vcf_to_txt' }],
      [{ text: 'BAGI VCF', callback_data: 'split_vcf' }],
      [{ text: 'CV LEWAT TEXT / ADMIN', callback_data: 'admin_cv' }]
    ]
  };

  await sendFormattedMessage(chatId, `😁 Halo @${username}, saya adalah bot cv file by @hiyaok`);
  await bot.sendMessage(chatId, '😡 Pilih mode:', { reply_markup: keyboard });
});

// Callback query handler
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;

  if (!isAdmin(callbackQuery)) {
    await bot.sendMessage(chatId, '📢 Halo Kak Bot Fast Cv Permanent / Bulanan Ready\n\nSilakan hubungi admin untuk membeli bot seperti ini\n\n📢 Permanent Bot Hanya 320rb [ bisa nego! ]\n\n\nNotes : Keuntungan Beli Bot Bisa Tanyakan Kepada Dev ✅', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Beli ✅', url: 'https://t.me/hiyaok' }]
        ]
      }
    });
    return;
  }

  const data = callbackQuery.data;
  userStates[chatId] = { mode: data, files: [] };

  let responseText = '';
  switch (data) {
    case 'txt_to_vcf':
      responseText = 'Kamu sudah memilih mode CV FILE TXT TO VCF. Sekarang kirim file txt kamu ke sini.';
      break;
    case 'vcf_to_txt':
      responseText = 'Silahkan kirim file vcf nya brow!';
      break;
    case 'split_vcf':
      responseText = 'Silahkan kirim file vcf yang ingin di bagi coy';
      break;
    case 'admin_cv':
      responseText = 'Sip. Sekarang kirim nomornya cok';
      userStates[chatId].waitingFor = 'numbers';
      break;
  }

  await sendFormattedMessage(chatId, responseText);
});

// File and other handlers...

// File handler
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;
  const fileName = msg.document.file_name;

  if (!userStates[chatId]) {
    await sendFormattedMessage(chatId, '😡 Pilih mode dulu blok! kirim pesan /start buat pilih mode');
    return;
  }

  const mode = userStates[chatId].mode;

  if ((mode === 'txt_to_vcf' && !fileName.endsWith('.txt')) ||
      ((mode === 'vcf_to_txt' || mode === 'split_vcf') && !fileName.endsWith('.vcf'))) {
    await sendFormattedMessage(chatId, 'Nih orang aneh ya, Pilih nya mode apa, Kirim file nya apa 🙂');
    return;
  }

  try {
    const fileLink = await bot.getFileLink(fileId);
    const filePath = path.join(__dirname, fileName);
    const response = await axios({
      method: 'get',
      url: fileLink,
      responseType: 'arraybuffer'
    });

    await fs.writeFile(filePath, response.data);
    userStates[chatId].files.push(filePath);
    await sendFormattedMessage(chatId, '✅ File diterima. Kirim pesan /done jika sudah selesai mengirim file.');
  } catch (error) {
    console.error('File download error:', error);
    await sendFormattedMessage(chatId, '😡 Terjadi kesalahan saat mengunduh file.');
  }
});

// Done command handler
bot.onText(/\/done/, async (msg) => {
  const chatId = msg.chat.id;

  if (!userStates[chatId] || userStates[chatId].files.length === 0) {
    await sendFormattedMessage(chatId, '😌 Anda belum mengirim file!');
    return;
  }

  const mode = userStates[chatId].mode;

  switch (mode) {
    case 'txt_to_vcf':
      await sendFormattedMessage(chatId, 'Oke terimakasih, sekarang silahkan kirim nama kontak yang diinginkan');
      userStates[chatId].waitingFor = 'contactName';
      break;
    case 'vcf_to_txt':
      await sendFormattedMessage(chatId, 'Mau nama file nya apa?');
      userStates[chatId].waitingFor = 'fileName';
      break;
    case 'split_vcf':
      await sendFormattedMessage(chatId, 'Mau nama file hasil pecahan nya apa?');
      userStates[chatId].waitingFor = 'fileName';
      break;
  }
});

// Message handler
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!userStates[chatId] || !userStates[chatId].waitingFor) return;

  switch (userStates[chatId].waitingFor) {
    case 'fileName':
      userStates[chatId].fileName = text;
      if (userStates[chatId].mode === 'split_vcf') {
        await sendFormattedMessage(chatId, 'Oke bro! Sekarang mau pecah berapa kontak per file?');
        userStates[chatId].waitingFor = 'ctcPerFile';
      } else if (userStates[chatId].mode === 'vcf_to_txt') {
        await processConversion(chatId);
      }
      break;
    case 'contactName':
      userStates[chatId].contactName = text;
      await sendFormattedMessage(chatId, 'Bentar lagi siap! Sekarang kirimkan jumlah kontak per file yang kamu mau');
      userStates[chatId].waitingFor = 'ctcPerFile';
      break;
    case 'ctcPerFile':
      userStates[chatId].ctcPerFile = parseInt(text);
      if (userStates[chatId].mode === 'txt_to_vcf') {
        await sendFormattedMessage(chatId, 'Bagus! Sekarang, apa nama file yang kamu inginkan untuk hasil konversi?');
        userStates[chatId].waitingFor = 'outputFileName';
      } else {
        await processConversion(chatId);
      }
      break;
    case 'outputFileName':
      userStates[chatId].outputFileName = text;
      await processConversion(chatId);
      break;
    case 'numbers':
      userStates[chatId].numbers = text.split('\n').map(num => num.trim());
      await sendFormattedMessage(chatId, 'Nama kontak mau apa?');
      userStates[chatId].waitingFor = 'adminContactName';
      break;
    case 'adminContactName':
      userStates[chatId].adminContactName = text;
      await sendFormattedMessage(chatId, 'Nama file nya mau apa?');
      userStates[chatId].waitingFor = 'adminFileName';
      break;
    case 'adminFileName':
      userStates[chatId].adminFileName = text;
      await processAdminCV(chatId);
      break;
  }
});

async function processConversion(chatId) {
  const state = userStates[chatId];
  await sendFormattedMessage(chatId, 'memproses coy..');

  try {
    switch (state.mode) {
      case 'txt_to_vcf':
        await txtToVcf(chatId);
        break;
      case 'vcf_to_txt':
        await vcfToTxt(chatId);
        break;
      case 'split_vcf':
        await splitVcf(chatId);
        break;
    }
  } catch (error) {
    console.error('Error during conversion:', error);
    await sendFormattedMessage(chatId, '😡 Terjadi kesalahan saat konversi. Silakan coba lagi.');
  }

  delete userStates[chatId];
}

async function txtToVcf(chatId) {
  const state = userStates[chatId];
  
  for (let fileIndex = 0; fileIndex < state.files.length; fileIndex++) {
    const filePath = state.files[fileIndex];
    const content = await fs.readFile(filePath, 'utf8');
    const numbers = content.split('\n').map(num => num.trim()).filter(Boolean);

    const vcards = [];
    let currentVcard = [];
    let fileCounter = 1;

    for (let i = 0; i < numbers.length; i++) {
      let number = numbers[i];
      if (!number.startsWith('+')) {
        number = '+' + number;
      }

      const vcardContent = `BEGIN:VCARD
VERSION:3.0
FN:${state.contactName} ${i + 1}
TEL;TYPE=CELL:${number}
END:VCARD
`;
      currentVcard.push(vcardContent);

      if ((i + 1) % state.ctcPerFile === 0 || i === numbers.length - 1) {
        const vcfFilePath = path.join(__dirname, `${state.outputFileName} ${fileCounter}.vcf`);
        await fs.writeFile(vcfFilePath, currentVcard.join('\n'));
        vcards.push(vcfFilePath);
        currentVcard = [];
        fileCounter++;
      }
    }

    await sendFormattedMessage(chatId, `✅ Konversi file yang ke ${fileIndex + 1} selesai!`);
    for (const vcfFilePath of vcards) {
      await bot.sendDocument(chatId, vcfFilePath);
    }
  }
}

async function vcfToTxt(chatId) {
  const state = userStates[chatId];

  for (let fileIndex = 0; fileIndex < state.files.length; fileIndex++) {
    const filePath = state.files[fileIndex];
    const content = await fs.readFile(filePath, 'utf8');
    const numbers = content.match(/TEL;TYPE=CELL:\+?\d+/g);
    
    if (numbers) {
      const resultText = numbers.map(num => num.replace('TEL;TYPE=CELL:', '')).join('\n');
      const txtFilePath = path.join(__dirname, `${state.fileName} ${fileIndex + 1}.txt`);
      await fs.writeFile(txtFilePath, resultText);
      
      await sendFormattedMessage(chatId, `✅ Konversi file yang ke ${fileIndex + 1} selesai!`);
      await bot.sendDocument(chatId, txtFilePath);
    } else {
      await sendFormattedMessage(chatId, `❌ Tidak ada nomor telepon ditemukan di file ${fileIndex + 1}.`);
    }
  }

  await sendFormattedMessage(chatId, '✅ Semua konversi selesai!');
}

async function splitVcf(chatId) {
  const state = userStates[chatId];

  for (let fileIndex = 0; fileIndex < state.files.length; fileIndex++) {
    const filePath = state.files[fileIndex];
    const content = await fs.readFile(filePath, 'utf8');
    const contacts = content.split('END:VCARD').map(vcf => vcf.trim()).filter(Boolean);

    let currentVcard = [];
    let fileCounter = 1;
    const vcards = [];

    for (let i = 0; i < contacts.length; i++) {
      currentVcard.push(`${contacts[i]}\nEND:VCARD`);
      
      if ((i + 1) % state.ctcPerFile === 0 || i === contacts.length - 1) {
        const vcfFilePath = path.join(__dirname, `${state.fileName} ${fileIndex + 1}-${fileCounter}.vcf`);
        await fs.writeFile(vcfFilePath, currentVcard.join('\n'));
        vcards.push(vcfFilePath);
        currentVcard = [];
        fileCounter++;
      }
    }

    await sendFormattedMessage(chatId, `✅ Proses split file yang ke ${fileIndex + 1} selesai!`);
    for (const vcfFilePath of vcards) {
      await bot.sendDocument(chatId, vcfFilePath);
    }
  }

  await sendFormattedMessage(chatId, '✅ Semua proses split selesai!');
}

async function processAdminCV(chatId) {
  const state = userStates[chatId];
  const vcards = [];

  let currentVcard = [];

  for (let i = 0; i < state.numbers.length; i++) {
    const number = state.numbers[i];
    const vcardContent = `BEGIN:VCARD
VERSION:3.0
FN:${state.adminContactName} ${i + 1}
TEL;TYPE=CELL:${number.startsWith('+') ? number : '+' + number}
END:VCARD
`;
    currentVcard.push(vcardContent);

    if ((i + 1) % 100 === 0 || i === state.numbers.length - 1) {
      const vcfFilePath = path.join(__dirname, `${state.adminFileName} ${vcards.length + 1}.vcf`);
      await fs.writeFile(vcfFilePath, currentVcard.join('\n'));
      vcards.push(vcfFilePath);
      currentVcard = [];
    }
  }

  await sendFormattedMessage(chatId, '✅ CV via text selesai ye!');
  for (const vcfFilePath of vcards) {
    await bot.sendDocument(chatId, vcfFilePath);
  }
}

bot.on('polling_error', (error) => {
  console.error(error);
});
