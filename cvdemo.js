const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const vCard = require('vcards-js');
const path = require('path');
const axios = require('axios');

// Replace 'YOUR_BOT_TOKEN' with your actual bot token
const bot = new TelegramBot('7193213688:AAHtAJguLNpcJPfEPuyTZXMcLc2MZekrQ_Q', { polling: true });

const userStates = {};
const ADMIN_ID = '5896345049'; // Replace with your admin's Telegram ID

// Function to send formatted message
function sendFormattedMessage(chatId, text) {
  return bot.sendMessage(chatId, `*\`${text}\`*`, { parse_mode: 'MarkdownV2' });
}

// Function to save user ID
async function saveUserId(userId) {
  const userIdsPath = path.join(__dirname, 'dataid.txt');
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

// Start command handler
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || 'pengguna';
  await saveUserId(chatId);

  const keyboard = {
    inline_keyboard: [
      [{ text: 'CV FILE TXT TO VCF', callback_data: 'txt_to_vcf' }],
      [{ text: 'VCF TO TXT', callback_data: 'vcf_to_txt' }],
      [{ text: 'BAGI VCF', callback_data: 'split_vcf' }],
      [{ text: 'CV FILE ADMIN', callback_data: 'admin_cv' }]
    ]
  };

  await sendFormattedMessage(chatId, `Halo @${username}, saya adalah bot cv file by @hiyaok`);
  await bot.sendMessage(chatId, 'Pilih mode:', { reply_markup: keyboard });
});

// Callback query handler
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  userStates[chatId] = { mode: data, files: [] };

  let responseText = '';
  switch (data) {
    case 'txt_to_vcf':
      responseText = 'Kamu sudah memilih mode CV FILE TXT TO VCF. Sekarang kirim file txt kamu ke sini.';
      break;
    case 'vcf_to_txt':
    case 'split_vcf':
      responseText = 'Silahkan kirim file vcf nya brow!';
      break;
    case 'admin_cv':
      responseText = 'Sip. Sekarang kirim nomornya.';
      userStates[chatId].waitingFor = 'numbers';
      break;
  }

  await sendFormattedMessage(chatId, responseText);
});

// File handler
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;
  const fileName = msg.document.file_name;

  if (!userStates[chatId]) {
    await sendFormattedMessage(chatId, 'Pilih mode terlebih dahulu!');
    return;
  }

  const mode = userStates[chatId].mode;

  if ((mode === 'txt_to_vcf' && !fileName.endsWith('.txt')) ||
      ((mode === 'vcf_to_txt' || mode === 'split_vcf') && !fileName.endsWith('.vcf'))) {
    await sendFormattedMessage(chatId, 'File tidak sesuai dengan mode yang dipilih.');
    return;
  }

  const fileStream = fs.createWriteStream(filePath);
  userStates[chatId].files.push(filePath);
  await sendFormattedMessage(chatId, 'File diterima. Kirim pesan /done jika sudah selesai mengirim file.');
});

// Done command handler
bot.onText(/\/done/, async (msg) => {
  const chatId = msg.chat.id;

  if (!userStates[chatId] || userStates[chatId].files.length === 0) {
    await sendFormattedMessage(chatId, 'Paansi sok asik, aneh anjir');
    return;
  }

  const mode = userStates[chatId].mode;

  switch (mode) {
    case 'txt_to_vcf':
      await sendFormattedMessage(chatId, 'Oke terimakasih, sekarang silahkan kirim nama file yang diinginkan');
      userStates[chatId].waitingFor = 'fileName';
      break;
    case 'vcf_to_txt':
      await sendFormattedMessage(chatId, 'Mau nama file nya apa?');
      userStates[chatId].waitingFor = 'fileName';
      break;
    case 'split_vcf':
      await sendFormattedMessage(chatId, 'Oke bro! Sekarang mau pecah berapa ctc per file?');
      userStates[chatId].waitingFor = 'ctcPerFile';
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
      if (userStates[chatId].mode === 'txt_to_vcf') {
        await sendFormattedMessage(chatId, 'Baik, sekarang silahkan kirim pesan untuk nama kontak nya');
        userStates[chatId].waitingFor = 'contactName';
      } else {
        await processConversion(chatId);
      }
      break;
    case 'contactName':
      userStates[chatId].contactName = text;
      await sendFormattedMessage(chatId, 'Bentar lagi siap! Sekarang kirimkan jumlah ctc per file yang kamu mau');
      userStates[chatId].waitingFor = 'ctcPerFile';
      break;
    case 'ctcPerFile':
      userStates[chatId].ctcPerFile = parseInt(text);
      await processConversion(chatId);
      break;
    case 'numbers':
      userStates[chatId].numbers = text.split('\n').map(num => num.trim());
      await sendFormattedMessage(chatId, 'Nama ctc mau apa?');
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
  await sendFormattedMessage(chatId, 'Proses yeee!');

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
    await sendFormattedMessage(chatId, 'Terjadi kesalahan saat konversi. Silakan coba lagi.');
  }

  delete userStates[chatId];
}

async function txtToVcf(chatId) {
  const state = userStates[chatId];
  const numbers = [];
  
  for (const filePath of state.files) {
    const content = await fs.readFile(filePath, 'utf8');
    numbers.push(...content.split('\n').map(num => num.trim()).filter(Boolean));
  }

  const vcards = [];
  let currentVcard = [];
  let fileCounter = 1;

  for (let i = 0; i < numbers.length; i++) {
    let number = numbers[i];
    if (!number.startsWith('+')) {
      number = '+' + number;
    }

    const vcard = vCard();
    vcard.firstName = `${state.contactName} ${fileCounter}`;
    vcard.cellPhone = number;

    currentVcard.push(vcard.getFormattedString());

    if (currentVcard.length === state.ctcPerFile || i === numbers.length - 1) {
      const vcfContent = currentVcard.join('\n');
      const fileName = `${state.fileName} - ${fileCounter}.vcf`;
      const filePath = path.join(__dirname, fileName);
      await fs.writeFile(filePath, vcfContent);
      vcards.push(filePath);
      currentVcard = [];
      fileCounter++;
    }
  }

  for (const vcardPath of vcards) {
    await bot.sendDocument(chatId, vcardPath);
    await fs.unlink(vcardPath);
  }

  await sendFormattedMessage(chatId, 'Konversi TXT ke VCF selesai!');
}

async function vcfToTxt(chatId) {
  const state = userStates[chatId];
  const numbers = [];

  for (const filePath of state.files) {
    const content = await fs.readFile(filePath, 'utf8');
    const vcards = content.split('BEGIN:VCARD');
    for (const vcard of vcards) {
      const match = vcard.match(/TEL.*?:(.+)/);
      if (match) {
        numbers.push(match[1].trim());
      }
    }
  }

  const txtContent = numbers.join('\n');
  const fileName = `${state.fileName}.txt`;
  const filePath = path.join(__dirname, fileName);
  await fs.writeFile(filePath, txtContent);

  await bot.sendDocument(chatId, filePath);
  await fs.unlink(filePath);

  await sendFormattedMessage(chatId, 'Konversi VCF ke TXT selesai!');
}

async function splitVcf(chatId) {
  const state = userStates[chatId];
  const vcards = [];

  for (const filePath of state.files) {
    const content = await fs.readFile(filePath, 'utf8');
    vcards.push(...content.split('BEGIN:VCARD').filter(Boolean).map(card => 'BEGIN:VCARD' + card));
  }

  const splitVcards = [];
  let currentVcard = [];
  let fileCounter = 1;

  for (let i = 0; i < vcards.length; i++) {
    currentVcard.push(vcards[i]);

    if (currentVcard.length === state.ctcPerFile || i === vcards.length - 1) {
      const vcfContent = currentVcard.join('\n');
      const fileName = `${state.fileName} - ${fileCounter}.vcf`;
      const filePath = path.join(__dirname, fileName);
      await fs.writeFile(filePath, vcfContent);
      splitVcards.push(filePath);
      currentVcard = [];
      fileCounter++;
    }
  }

  for (const vcardPath of splitVcards) {
    await bot.sendDocument(chatId, vcardPath);
    await fs.unlink(vcardPath);
  }

  await sendFormattedMessage(chatId, 'Pemecahan VCF selesai!');
}

async function processAdminCV(chatId) {
  const state = userStates[chatId];
  await sendFormattedMessage(chatId, 'Memproses CV admin...');

  const vcards = [];

  for (const number of state.numbers) {
    let formattedNumber = number;
    if (!formattedNumber.startsWith('+')) {
      formattedNumber = '+' + formattedNumber;
    }

    const vcard = vCard();
    vcard.firstName = state.adminContactName;
    vcard.cellPhone = formattedNumber;
    vcards.push(vcard.getFormattedString());
  }

  const vcfContent = vcards.join('\n');
  const fileName = `${state.adminFileName}.vcf`;
  const filePath = path.join(__dirname, fileName);
  await fs.writeFile(filePath, vcfContent);

  await bot.sendDocument(chatId, filePath);
  await fs.unlink(filePath);

  await sendFormattedMessage(chatId, 'CV admin selesai!');
  delete userStates[chatId];
}

// Broadcast command handler
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (chatId.toString() !== ADMIN_ID) {
    sendFormattedMessage(chatId, 'Anda tidak memiliki izin untuk menggunakan perintah ini.');
    return;
  }

  const broadcastMessage = match[1];
  const userIdsPath = path.join(__dirname, 'dataid.txt');
  const userIds = fs.existsSync(userIdsPath) 
    ? fs.readFileSync(userIdsPath, 'utf8').split('\n').filter(Boolean) 
    : [];

  let successCount = 0;
  let failCount = 0;

  for (const userId of userIds) {
    try {
      await bot.sendMessage(userId, broadcastMessage);
      successCount++;
    } catch (error) {
      console.error(`Failed to send message to ${userId}:`, error);
      failCount++;
    }
  }

  sendFormattedMessage(chatId, `Broadcast selesai. Berhasil: ${successCount}, Gagal: ${failCount}`);
});

async function downloadFile(fileId) {
  const file = await bot.getFile(fileId);
  const filePath = path.join(__dirname, `temp_${Date.now()}_${path.basename(file.file_path)}`);
  const fileStream = fs.createWriteStream(filePath);

  const response = await axios({
    method: 'get',
    url: `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`,
    responseType: 'stream'
  });

  response.data.pipe(fileStream);

  return new Promise((resolve, reject) => {
    fileStream.on('finish', () => resolve(filePath));
    fileStream.on('error', reject);
  });
}

console.log('Bot is running...');
