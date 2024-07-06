// source code by @hiyaok programmer
// telegram @hiyaok
// harga script Rp.600.000+

// modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import telegraf from 'telegraf';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import XLSX from 'xlsx';
import stringSimilarity from 'string-similarity';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// initialize bot
const bot = new Telegraf('7406919687:AAGNLXrAWlNgN1_nz6MWevsBXvSM5klIQBI', { polling: true });
const adminId = '5988451717'; // Ganti dengan ID admin bot

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
const isPremiumOrAdmin = (msg) => {
  const userId = msg.from.id.toString();
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
const sendNoAccessMessage = (msg) => {
  const username = msg.from.username || msg.from.first_name;
  const message = `Halo @${username} Saya adalah Bot Convert File By [hiyaok](https://t.me/hiyaok)\n\nUntuk dapat akses fitur bot silahkan hubungi @hiyaok`;
  bot.sendMessage(msg.chat.id, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Chat', url: 'https://t.me/hiyaok' }]
      ]
    }
  });
};

// Handler untuk perintah /start
bot.onText(/\/start/, (msg) => {
  if (!isPremiumOrAdmin(msg)) {
    sendNoAccessMessage(msg);
    return;
  }

  const userId = msg.from.id;
  const session = loadUserSession(userId);
  session.mode = null;
  saveUserSession(userId, session);

  bot.sendMessage(msg.chat.id, '🖐🏻 Welcome! Please choose a mode:\n1. TXT to VCF\n2. VCF to TXT\n3. XLSX to VCF\n4. VCF to XLSX\n\nReply with the number of your choice.');
});

// Admin commands
bot.onText(/\/premium (.+)/, (msg, match) => {
  if (msg.from.id.toString() !== adminId) {
    return;
  }

  const args = match[1].split(' ');
  if (args.length < 2) {
    bot.sendMessage(msg.chat.id, 'Usage: /premium <user_id> <days>');
    return;
  }

  const userId = args[0];
  const days = parseInt(args[1], 10);
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);

  const premiumUsers = loadPremiumUsers();
  premiumUsers[userId] = { expiryDate: expiryDate.toISOString() };
  savePremiumUsers(premiumUsers);

  bot.sendMessage(msg.chat.id, `User ${userId} has been granted premium access for ${days} days.`);
  bot.sendMessage(userId, `You have been granted premium access for ${days} days.`);
});

bot.onText(/\/delpremium (.+)/, (msg, match) => {
  if (msg.from.id.toString() !== adminId) {
    return;
  }

  const userId = match[1];
  const premiumUsers = loadPremiumUsers();
  delete premiumUsers[userId];
  savePremiumUsers(premiumUsers);

  bot.sendMessage(msg.chat.id, `User ${userId} has been removed from premium access.`);
});

bot.onText(/\/listprem/, (msg) => {
  if (msg.from.id.toString() !== adminId) {
    return;
  }

  const premiumUsers = loadPremiumUsers();
  const now = new Date();
  const list = Object.entries(premiumUsers).map(([userId, { expiryDate }]) => {
    const expiry = new Date(expiryDate);
    const remainingDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return `User ID: ${userId}, Expiry Date: ${expiryDate}, Remaining Days: ${remainingDays}`;
  }).join('\n');

  bot.sendMessage(msg.chat.id, `Premium Users:\n${list}`);
});

// Handler untuk pesan teks
bot.on('message', async (msg) => {
  if (msg.text && msg.text.startsWith('/')) return;
  if (!isPremiumOrAdmin(msg)) {
    sendNoAccessMessage(msg);
    return;
  }
  const text = msg.text ? msg.text.trim() : '';
  const userId = msg.from.id;
  const session = loadUserSession(userId);

  if (!session.mode) {
    const mode = text;
    if (['1', '2', '3', '4'].includes(mode)) {
      session.mode = mode;
      saveUserSession(userId, session);
      bot.sendMessage(msg.chat.id, 'Mode set. Please send the file to convert 🔥');
    } else {
      bot.sendMessage(msg.chat.id, 'Invalid mode. Please choose a mode:\n1. TXT to VCF\n2. VCF to TXT\n3. XLSX to VCF\n4. VCF to XLSX');
    }
    return;
  }

  bot.sendMessage(msg.chat.id, 'Please send a file to convert 📂');
});

bot.on('document', async (msg) => {
  if (!isPremiumOrAdmin(msg)) {
    sendNoAccessMessage(msg);
    return;
  }

  const userId = msg.from.id;
  const session = loadUserSession(userId);

  if (!session.mode) {
    bot.sendMessage(msg.chat.id, 'Please choose a mode first ❗');
    return;
  }

  const fileType = msg.document.mime_type;
  let validFile = false;

  switch (session.mode) {
    case '1':
      if (fileType === 'text/plain') validFile = true;
      break;
    case '2':
      if (msg.document.file_name.endsWith('.vcf')) validFile = true;
      break;
    case '3':
      if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') validFile = true;
      break;
    case '4':
      if (msg.document.file_name.endsWith('.vcf')) validFile = true;
      break;
  }

  if (!validFile) {
    bot.sendMessage(msg.chat.id, 'The document you uploaded does not match the selected mode. Please upload the correct document or change the mode.');
    return;
  }

  const fileLink = await bot.getFileLink(msg.document.file_id);
  const response = await fetch(fileLink);
  const fileBuffer = await response.buffer();

  bot.sendMessage(msg.chat.id, 'Processing your file...');

  switch (session.mode) {
    case '1':
      handleTxtToVcf(fileBuffer, msg.caption, msg);
      break;
    case '2':
      handleVcfToTxt(fileBuffer, msg);
      break;
    case '3':
      handleXlsxToVcf(fileBuffer, msg);
      break;
    case '4':
      handleVcfToXlsx(fileBuffer, msg);
      break;
    default:
      bot.sendMessage(msg.chat.id, 'Invalid mode.');
      break;
  }
});

const handleTxtToVcf = (buffer, caption, msg) => {
  const content = buffer.toString('utf-8');
  const sections = parseSections(content);
  const [sectionNames, outputFileName, contactLimitStr] = caption.split(',');
  const contactLimit = parseInt(contactLimitStr, 10);

  if (!sectionNames || !outputFileName || isNaN(contactLimit)) {
    bot.sendMessage(msg.chat.id, 'Invalid caption format. Use: Section Name, Output File Name, Contact Limit per File ❗');
    return;
  }

  const targetSections = getTargetSections(sections, sectionNames.split('+'));
  if (targetSections.length === 0) {
    bot.sendMessage(msg.chat.id, `Sections ${sectionNames} not found in the TXT file.`);
    return;
  }

  const contacts = targetSections.flatMap(section => extractContacts(section));
  const vcfData = generateVcf(contacts, contactLimit);
  vcfData.forEach((vcf, index) => {
    const filename = `${outputFileName}_${index + 1}.vcf`;
    const filePath = path.join(__dirname, filename);
    fs.writeFileSync(filePath, vcf);
    bot.sendDocument(msg.chat.id, filePath).then(() => {
      fs.unlinkSync(filePath);
    });
  });
};

const parseSections = (content) => {
  const sectionRegex = /-{3}Start(.+?)-{3}/g;
  let match;
  const sections = [];

  while ((match = sectionRegex.exec(content)) !== null) {
    sections.push(match[1].trim());
  }
  return sections;
};

const getTargetSections = (sections, sectionNames) => {
  return sectionNames.flatMap(sectionName => {
    const exactMatch = sections.find(section => section.startsWith(`${sectionName}:`));
    if (exactMatch) {
      return [exactMatch];
    }
    const similarSections = stringSimilarity.findBestMatch(sectionName, sections.map(section => section.split(':')[0]));
    const bestMatch = similarSections.bestMatch;
    if (bestMatch.rating > 0.8) {
      return [sections[bestMatch.index]];
    }
    return [];
  });
};

const extractContacts = (section) => {
  const contacts = [];
  const lines = section.split('\n');
  let currentName = '';

  lines.forEach(line => {
    const match = line.match(/Name:\s*(.+)/);
    if (match) {
      currentName = match[1];
    } else {
      const phoneMatch = line.match(/Phone:\s*(.+)/);
      if (phoneMatch && currentName) {
        contacts.push({ name: currentName, phone: phoneMatch[1] });
      }
    }
  });

  return contacts;
};

const generateVcf = (contacts, contactLimit) => {
  const vcfFiles = [];
  for (let i = 0; i < contacts.length; i += contactLimit) {
    const subset = contacts.slice(i, i + contactLimit);
    const vcf = subset.map(({ name, phone }) => {
      return `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL:${phone}\nEND:VCARD`;
    }).join('\n');
    vcfFiles.push(vcf);
  }
  return vcfFiles;
};

const handleVcfToTxt = (buffer, msg) => {
  const content = buffer.toString('utf-8');
  const txtData = convertVcfToTxt(content);
  const filePath = path.join(__dirname, 'output.txt');
  fs.writeFileSync(filePath, txtData);
  bot.sendDocument(msg.chat.id, filePath).then(() => {
    fs.unlinkSync(filePath);
  });
};

const convertVcfToTxt = (vcf) => {
  const vcardRegex = /BEGIN:VCARD[\s\S]*?END:VCARD/g;
  const matches = vcf.match(vcardRegex);
  if (!matches) return '';

  const txtData = matches.map(card => {
    const nameMatch = card.match(/FN:(.+)/);
    const phoneMatch = card.match(/TEL:(.+)/);
    const name = nameMatch ? nameMatch[1] : 'Unknown';
    const phone = phoneMatch ? phoneMatch[1] : 'Unknown';
    return `Name: ${name}\nPhone: ${phone}`;
  }).join('\n---\n');

  return txtData;
};

const handleXlsxToVcf = (buffer, msg) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);

  const contacts = jsonData.map(row => ({
    name: row['Name'],
    phone: row['Phone']
  }));

  const vcfData = generateVcf(contacts, contacts.length);
  const filePath = path.join(__dirname, 'output.vcf');
  fs.writeFileSync(filePath, vcfData[0]);
  bot.sendDocument(msg.chat.id, filePath).then(() => {
    fs.unlinkSync(filePath);
  });
};

const handleVcfToXlsx = (buffer, msg) => {
  const content = buffer.toString('utf-8');
  const contacts = parseVcf(content);
  const worksheet = XLSX.utils.json_to_sheet(contacts);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

  const filePath = path.join(__dirname, 'output.xlsx');
  XLSX.writeFile(workbook, filePath);
  bot.sendDocument(msg.chat.id, filePath).then(() => {
    fs.unlinkSync(filePath);
  });
};

const parseVcf = (vcf) => {
  const vcardRegex = /BEGIN:VCARD[\s\S]*?END:VCARD/g;
  const matches = vcf.match(vcardRegex);
  if (!matches) return [];

  return matches.map(card => {
    const nameMatch = card.match(/FN:(.+)/);
    const phoneMatch = card.match(/TEL:(.+)/);
    return {
      Name: nameMatch ? nameMatch[1] : 'Unknown',
      Phone: phoneMatch ? phoneMatch[1] : 'Unknown'
    };
  });
};
