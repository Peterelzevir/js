//modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Telegraf } from 'telegraf';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import XLSX from 'xlsx';
import stringSimilarity from 'string-similarity';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bot = new Telegraf('7037157690:AAFJ7u3B-S1uiIu79jxeUGQxvPG-cIzf8G0');
const adminId = '5988451717';  // Ganti dengan ID admin bot

// Fungsi untuk memuat sesi pengguna dari file JSON
const loadUserSession = (userId) => {
  const filePath = path.join(__dirname, `session_${userId}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath));
  }
  return {};
};

// Fungsi untuk menyimpan sesi pengguna ke file JSON
const saveUserSession = (userId, sessionData) => {
  const filePath = path.join(__dirname, `session_${userId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
};

// Fungsi untuk memuat data pengguna premium dari file JSON
const loadPremiumUsers = () => {
  const filePath = path.join(__dirname, 'premium_users.json');
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath));
  }
  return {};
};

// Fungsi untuk menyimpan data pengguna premium ke file JSON
const savePremiumUsers = (data) => {
  const filePath = path.join(__dirname, 'premium_users.json');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Fungsi untuk memeriksa apakah pengguna adalah premium atau admin
const isPremiumOrAdmin = (ctx) => {
  const userId = ctx.from.id.toString();
  const premiumUsers = loadPremiumUsers();
  const now = new Date();
  if (userId === adminId) {
    return true;
  }
  if (premiumUsers[userId] && new Date(premiumUsers[userId].expiryDate) > now) {
    return true;
  }
  return false;
};

// Fungsi untuk mengirim pesan ke pengguna yang tidak memiliki akses
const sendNoAccessMessage = (ctx) => {
  const username = ctx.from.username || ctx.from.first_name;
  const message = `🖐🏻 Halo @${username} Saya adalah Bot Convert File By [hiyaok](https://t.me/hiyaok)\n\nUntuk dapat akses fitur bot silahkan hubungi @hiyaok`;
  ctx.replyWithMarkdown(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Chat', url: 'https://t.me/hiyaok' }]
      ]
    }
  });
};

// Handler untuk perintah /start
bot.start((ctx) => {
  if (!isPremiumOrAdmin(ctx)) {
    sendNoAccessMessage(ctx);
    return;
  }

  const userId = ctx.from.id;
  const session = loadUserSession(userId);
  session.mode = null;
  saveUserSession(userId, session);

  ctx.reply('🖐🏻 Welcome!\n\n💡 Please choose a mode:\n1. TXT to VCF\n2. VCF to TXT\n3. XLSX to VCF\n4. VCF to XLSX\n\n➡️ Reply with the number of your choice.');
});

// Admin commands
bot.command('premium', (ctx) => {
  if (ctx.from.id.toString() !== adminId) {
    return;
  }

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    ctx.reply('💡 Usage: /premium <user_id> <days>');
    return;
  }

  const userId = args[0];
  const days = parseInt(args[1], 10);
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);

  const premiumUsers = loadPremiumUsers();
  premiumUsers[userId] = { expiryDate: expiryDate.toISOString() };
  savePremiumUsers(premiumUsers);

  ctx.reply(`✅ User ${userId} has been granted premium access for ${days} days.`);
  ctx.telegram.sendMessage(userId, `💡 You have been granted premium access for ${days} days ✅`);
});

bot.command('delpremium', (ctx) => {
  if (ctx.from.id.toString() !== adminId) {
    return;
  }

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 1) {
    ctx.reply('💡 Usage: /delpremium <user_id>');
    return;
  }

  const userId = args[0];
  const premiumUsers = loadPremiumUsers();
  delete premiumUsers[userId];
  savePremiumUsers(premiumUsers);

  ctx.reply(`💡 User ${userId} has been removed from premium access.`);
});

bot.command('listprem', (ctx) => {
  if (ctx.from.id.toString() !== adminId) {
    return;
  }

  const premiumUsers = loadPremiumUsers();
  const now = new Date();
  const list = Object.entries(premiumUsers).map(([userId, { expiryDate }]) => {
    const expiry = new Date(expiryDate);
    const remainingDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return `💡 User ID: ${userId}\n➡️ Expiry Date: ${expiryDate}\n🕓 Remaining Days: ${remainingDays}`;
  }).join('\n\n');

  ctx.reply(`⚡ List Premium Users:\n${list}`);
});

// Handler untuk pesan teks
bot.on('text', async (ctx) => {
  if (!isPremiumOrAdmin(ctx)) {
    sendNoAccessMessage(ctx);
    return;
  }
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return; 

  const userId = ctx.from.id;
  const session = loadUserSession(userId);

  if (!session.mode) {
    const mode = ctx.message.text.trim();
    if (['1', '2', '3', '4'].includes(mode)) {
      session.mode = mode;
      saveUserSession(userId, session);
      ctx.reply('✅ Mode set. Please send the file to convert 🔥');
    } else {
      ctx.reply('❗ Invalid mode\n💡 Please choose a mode:\n1. TXT to VCF\n2. VCF to TXT\n3. XLSX to VCF\n4. VCF to XLSX');
    }
    return;
  }

  ctx.reply('Please send a file to convert 📂');
});

bot.on('document', async (ctx) => {
  if (!isPremiumOrAdmin(ctx)) {
    sendNoAccessMessage(ctx);
    return;
  }

  const userId = ctx.from.id;
  const session = loadUserSession(userId);

  if (!session.mode) {
    ctx.reply('Please choose a mode first ❗');
    return;
  }

  const fileType = ctx.message.document.mime_type;
  let validFile = false;

  switch (session.mode) {
    case '1':
      if (fileType === 'text/plain') validFile = true;
      break;
    case '2':
      if (ctx.message.document.file_name.endsWith('.vcf')) validFile = true;
      break;
    case '3':
      if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') validFile = true;
      break;
    case '4':
      if (ctx.message.document.file_name.endsWith('.vcf')) validFile = true;
      break;
  }

  if (!validFile) {
    ctx.reply('❗ The document you uploaded does not match the selected mode. Please upload the correct document or change the mode.');
    return;
  }

    if (session.mode === '1' && !ctx.message.caption) {
    ctx.reply('❗ For TXT to VCF conversion, please provide the format names in the caption.');
    return;
  }

  const fileId = ctx.message.document.file_id;
  const fileName = ctx.message.document.file_name;
  const filePath = await ctx.telegram.getFileLink(fileId);

  const downloadPath = path.join(__dirname, fileName);
  const response = await axios.get(filePath.href, { responseType: 'stream' });
  response.data.pipe(fs.createWriteStream(downloadPath));

  response.data.on('end', async () => {
    ctx.reply('⚡ File downloaded successfully! Processing...');

    try {
      let convertedFile;
      switch (session.mode) {
        case '1':
          const formatNames = ctx.message.caption.split(',');
          convertedFile = await convertTXTtoVCF(downloadPath, formatNames);
          break;
        case '2':
          convertedFile = await convertVCFtoTXT(downloadPath);
          break;
        case '3':
          convertedFile = await convertXLSXtoVCF(downloadPath);
          break;
        case '4':
          convertedFile = await convertVCFtoXLSX(downloadPath);
          break;
      }

      ctx.replyWithDocument({ source: convertedFile, filename: `converted_${fileName}` });
      fs.unlinkSync(downloadPath);
      fs.unlinkSync(convertedFile);
    } catch (error) {
      ctx.reply(`❗ Error during conversion: ${error.message}`);
      console.error(error);
    }
  });

  response.data.on('error', (err) => {
    ctx.reply(`❗ Error downloading file: ${err.message}`);
    console.error(err);
  });
});

// Functions for conversion logic
const convertTXTtoVCF = async (filePath, formatNames) => {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  const vcfContacts = lines.map((line, index) => {
    const contactData = line.split(',');
    const vcfContact = formatNames.map((name, i) => {
      return `BEGIN:VCARD\nVERSION:3.0\nN:;${contactData[i]};;;\nTEL:${contactData[i + 1]}\nEND:VCARD`;
    }).join('\n');
    return vcfContact;
  }).join('\n');
  const vcfPath = filePath.replace('.txt', '.vcf');
  fs.writeFileSync(vcfPath, vcfContacts);
  return vcfPath;
};

const convertVCFtoTXT = async (filePath) => {
  const vcfData = fs.readFileSync(filePath, 'utf-8');
  const contacts = vcfData.split('END:VCARD').filter(Boolean);
  const txtContacts = contacts.map(contact => {
    const name = contact.match(/N:(.*?);/)[1];
    const tel = contact.match(/TEL:(.*?)/)[1];
    return `${name},${tel}`;
  }).join('\n');
  const txtPath = filePath.replace('.vcf', '.txt');
  fs.writeFileSync(txtPath, txtContacts);
  return txtPath;
};

const convertXLSXtoVCF = async (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const vcfContacts = rows.map(row => {
    return `BEGIN:VCARD\nVERSION:3.0\nN:;${row[0]};;;\nTEL:${row[1]}\nEND:VCARD`;
  }).join('\n');
  const vcfPath = filePath.replace('.xlsx', '.vcf');
  fs.writeFileSync(vcfPath, vcfContacts);
  return vcfPath;
};

const convertVCFtoXLSX = async (filePath) => {
  const vcfData = fs.readFileSync(filePath, 'utf-8');
  const contacts = vcfData.split('END:VCARD').filter(Boolean);
  const rows = contacts.map(contact => {
    const name = contact.match(/N:(.*?);/)[1];
    const tel = contact.match(/TEL:(.*?)/)[1];
    return [name, tel];
  });
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Contacts');
  const xlsxPath = filePath.replace('.vcf', '.xlsx');
  XLSX.writeFile(workbook, xlsxPath);
  return xlsxPath;
};

// Start the bot
bot.launch();
