//source code by @hiyaok programmer
//telegram @hiyaok
//harga script Rp.600.000+

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
import punycode from 'punycode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bot = new Telegraf('7656083647:AAGhh4TyRvfrkDo-AqaMUtDaHHuGF1f9_ts');
const adminId = '6634630359';  // Ganti dengan ID admin bot

// Fungsi untuk memuat sesi pengguna dari file JSON
const loadUserSession = (userId) => {
  const filePath = path.join(__dirname, `sessioncyaltt_${userId}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath));
  }
  return {};
};

// Fungsi untuk menyimpan sesi pengguna ke file JSON
const saveUserSession = (userId, sessionData) => {
  const filePath = path.join(__dirname, `sessionmeg_${userId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
};

// Fungsi untuk memuat data pengguna premium dari file JSON
const loadPremiumUsers = () => {
  const filePath = path.join(__dirname, 'premiummeg_users.json');
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath));
  }
  return {};
};

// Fungsi untuk menyimpan data pengguna premium ke file JSON
const savePremiumUsers = (data) => {
  const filePath = path.join(__dirname, 'premiummeg_users.json');
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

// ... (Sisa kode bot Anda)

// Fungsi untuk mengirim pesan ke pengguna yang tidak memiliki akses
const sendNoAccessMessage = (ctx) => {
  const username = ctx.from.username || ctx.from.first_name;
  const message = `🖐🏻 Halo @${username} Saya adalah Bot Convert File By [MGbrz](https://t.me/MGbrz)\n\nUntuk dapat akses fitur bot silahkan hubungi @MGbrz`;
  ctx.replyWithMarkdown(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Order Sewa Bot 💡', url: 'https://t.me/MGbrz' }]
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

  ctx.reply('🖐🏻 Haloo !\n\n💡 Pilih mode terlebih dahulu yuk\n\n1. TXT to VCF 🔥\n2. VCF to TXT\n3. XLSX to VCF\n4. VCF to XLSX\n\n➡️ Reply Bersama Pilihan mode kamu\n\n\nNote : Fitur Txt ke Vcf dan Vcf Ke Txt paling rekomendasi, fitur lain bekerja namun ada beberapa keterbatasan');
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
      ctx.reply('❗ Invalid mode bro\n\n💡 Pilih mode dulu brok\n\n1. TXT to VCF 🔥\n2. VCF to TXT\n3. XLSX to VCF\n4. VCF to XLSX');
    }
    return;
  }

  ctx.reply('Kirim File Buat Di Convert 📂');
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
    ctx.reply('❗ For TXT to VCF conversion, please provide a caption in the format: Section Name, Output File Name, Contact Limit per File.');
    return;
  }

  const fileLink = await ctx.telegram.getFileLink(ctx.message.document.file_id);
  const response = await fetch(fileLink.href);
  const fileBuffer = await response.buffer();

  ctx.reply('⌛ Prosess Bro!');

  switch (session.mode) {
    case '1':
      handleTxtToVcf(fileBuffer, ctx.message.caption, ctx);
      break;
    case '2':
      handleVcfToTxt(fileBuffer, ctx);
      break;
    case '3':
      handleXlsxToVcf(fileBuffer, ctx);
      break;
    case '4':
      handleVcfToXlsx(fileBuffer, ctx);
      break;
    default:
      ctx.reply('Invalid mode.');
      break;
  }
});

const handleTxtToVcf = (buffer, caption, ctx) => {
  const content = buffer.toString('utf-8');
  const sections = parseSections(content);
  const [sectionNames, outputFileName, contactLimitStr] = caption.split(',');
  const contactLimit = parseInt(contactLimitStr, 10);

  if (!sectionNames || !outputFileName || isNaN(contactLimit)) {
    ctx.reply('Invalid caption format. Use: Section Name, Output File Name, Contact Limit per File ❗');
    return;
  }

  const targetSections = getTargetSections(sections, sectionNames.split('+'));
  if (targetSections.length === 0) {
    ctx.reply(`Sections ${sectionNames} not found.`);
    return;
  }

  const contacts = targetSections.flatMap(section => 
    section.contacts.map(contact => ({ name: section.name, phone: contact }))
  );

  const outputFiles = splitContactsIntoVcfFiles(contacts, outputFileName, contactLimit);
  outputFiles.forEach(file => {
    ctx.replyWithDocument({ source: Buffer.from(file.content), filename: file.filename });
  });
};

const parseSections = (content) => {
  const sections = [];
  let currentSection = null;

  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line) return;

    if (isNaN(line)) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = { name: line, contacts: [] };
    } else if (currentSection) {
      currentSection.contacts.push(line.startsWith('+') ? line : `+${line}`);
    }
  });

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
};

const getTargetSections = (sections, targetNames) => {
  return sections.filter(section => {
    const sectionName = section.name.toLowerCase();
    return targetNames.some(targetName => {
      const targetLower = targetName.toLowerCase();
      return sectionName.includes(targetLower) || stringSimilarity.compareTwoStrings(sectionName, targetLower) > 0.8;
    });
  });
};

const splitContactsIntoVcfFiles = (contacts, baseName, limit) => {
  const outputFiles = [];

  for (let i = 0; i < contacts.length; i += limit) {
    const chunk = contacts.slice(i, i + limit);
    const chunkVcf = chunk.map((contact, index) => `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name}_${i + index + 1}\nTEL;TYPE=CELL:${contact.phone}\nEND:VCARD`).join('\n');

    outputFiles.push({ filename: `${baseName}_${Math.floor(i / limit) + 1}.vcf`, content: chunkVcf });
  }

  return outputFiles;
};

const handleVcfToTxt = (buffer, ctx) => {
  const content = buffer.toString('utf-8');
  const contacts = parseVcf(content);
  const outputFile = createTxtFile(contacts);
  ctx.replyWithDocument({ source: Buffer.from(outputFile), filename: 'DoneConvert.txt' });
};

const createTxtFile = (contacts) => {
  return contacts.map(contact => `${contact.phone}`).join('\n');
};

const handleXlsxToVcf = (buffer, ctx) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const contacts = parseXlsx(workbook);
  const outputFile = createVcfFile(contacts);
  ctx.replyWithDocument({ source: Buffer.from(outputFile), filename: 'ConvertDone.vcf' });
};

const parseVcf = (content) => {
  const contacts = [];
  const lines = content.split('\n');
  let currentContact = null;

  lines.forEach(line => {
    if (line.startsWith('BEGIN:VCARD')) {
      currentContact = {};
    } else if (line.startsWith('FN:')) {
      currentContact.name = line.replace('FN:', '').trim();
    } else if (line.startsWith('TEL;TYPE=CELL:')) {
      currentContact.phone = line.replace('TEL;TYPE=CELL:', '').trim();
    } else if (line.startsWith('END:VCARD')) {
      if (currentContact) {
        contacts.push(currentContact);
      }
      currentContact = null;
    }
  });

  return contacts;
};

const handleVcfToXlsx = (buffer, ctx) => {
  const content = buffer.toString('utf-8');
  const contacts = parseVcf(content);
  const workbook = createXlsx(contacts);
  const outputBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  ctx.replyWithDocument({ source: outputBuffer, filename: 'ConvertDone.xlsx' });
};

const createVcfFile = (contacts) => {
  return contacts.map(contact => `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name}\nTEL;TYPE=CELL:${contact.phone}\nEND:VCARD`).join('\n');
};

const parseXlsx = (workbook) => {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet).map(row => ({
    name: row.Name || row.name || row[0],
    phone: row.Phone || row.phone || row[1]
  }));
};

const createXlsx = (contacts) => {
  const sheet = XLSX.utils.json_to_sheet(contacts);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Contacts');
  return workbook;
};

bot.launch();
