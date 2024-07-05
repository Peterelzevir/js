// Source code by @hiyaok programmer
// Telegram @hiyaok
// Harga script Rp.600.000+

// Modules
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const stringSimilarity = require('string-similarity');

// Dynamic import for node-fetch
let fetch;
(async () => {
  fetch = await import('node-fetch').then(module => module.default);
})();

const bot = new Telegraf('7406919687:AAGNLXrAWlNgN1_nz6MWevsBXvSM5klIQBI');
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
  const message = `Halo @${username}, Saya adalah Bot Convert File By [hiyaok](https://t.me/hiyaok)\n\nUntuk dapat akses fitur bot silahkan hubungi @hiyaok`;
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

  ctx.reply('🖐🏻 Welcome! Please choose a mode:\n1. TXT to VCF\n2. VCF to TXT\n3. XLSX to VCF\n4. VCF to XLSX\n\nReply with the number of your choice.');
});

// Admin commands
bot.command('premium', (ctx) => {
  if (ctx.from.id.toString() !== adminId) {
    return;
  }

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    ctx.reply('Usage: /premium <user_id> <days>');
    return;
  }

  const userId = args[0];
  const days = parseInt(args[1], 10);
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);

  const premiumUsers = loadPremiumUsers();
  premiumUsers[userId] = { expiryDate: expiryDate.toISOString() };
  savePremiumUsers(premiumUsers);

  ctx.reply(`User ${userId} has been granted premium access for ${days} days.`);
  ctx.telegram.sendMessage(userId, `You have been granted premium access for ${days} days.`);
});

bot.command('delpremium', (ctx) => {
  if (ctx.from.id.toString() !== adminId) {
    return;
  }

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 1) {
    ctx.reply('Usage: /delpremium <user_id>');
    return;
  }

  const userId = args[0];
  const premiumUsers = loadPremiumUsers();
  delete premiumUsers[userId];
  savePremiumUsers(premiumUsers);

  ctx.reply(`User ${userId} has been removed from premium access.`);
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
    return `User ID: ${userId}, Expiry Date: ${expiryDate}, Remaining Days: ${remainingDays}`;
  }).join('\n');

  ctx.reply(`Premium Users:\n${list}`);
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
      ctx.reply('Mode set. Please send the file to convert 🔥');
    } else {
      ctx.reply('Invalid mode. Please choose a mode:\n1. TXT to VCF\n2. VCF to TXT\n3. XLSX to VCF\n4. VCF to XLSX');
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
    case '3':
      if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') validFile = true;
      break;
  }

  if (!validFile) {
    ctx.reply('The document you uploaded does not match the selected mode. Please upload the correct document or change the mode.');
    return;
  }

  const fileLink = await ctx.telegram.getFileLink(ctx.message.document.file_id);
  const response = await fetch(fileLink.href);
  const fileBuffer = await response.buffer();

  ctx.reply('Processing your file...');

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

const handleVcfToTxt = (buffer, ctx) => {
  const content = buffer.toString('utf-8');
  const contacts = parseVcf(content);
  const txtContent = formatContactsAsTxt(contacts);
  ctx.replyWithDocument({ source: Buffer.from(txtContent), filename: 'contacts.txt' });
};

const handleXlsxToVcf = (buffer, ctx) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const vcfContent = data.map(row => formatContactAsVcf(row)).join('\n');
  ctx.replyWithDocument({ source: Buffer.from(vcfContent), filename: 'contacts.vcf' });
};

const handleVcfToXlsx = (buffer, ctx) => {
  const content = buffer.toString('utf-8');
  const contacts = parseVcf(content);
  const worksheet = XLSX.utils.json_to_sheet(contacts);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
  
  const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  ctx.replyWithDocument({ source: xlsxBuffer, filename: 'contacts.xlsx' });
};

const parseSections = (content) => {
  const lines = content.split('\n');
  const sections = [];
  let currentSection = null;

  lines.forEach(line => {
    const match = line.match(/^(.*)\s*\[(.*)\]/);
    if (match) {
      if (currentSection) sections.push(currentSection);
      currentSection = { name: match[1].trim(), contacts: [] };
    } else if (currentSection) {
      currentSection.contacts.push(line.trim());
    }
  });

  if (currentSection) sections.push(currentSection);
  return sections;
};

const getTargetSections = (sections, targetNames) => {
  return targetNames.map(name => {
    const matches = stringSimilarity.findBestMatch(name.trim(), sections.map(s => s.name)).ratings;
    matches.sort((a, b) => b.rating - a.rating);
    return matches[0].rating > 0.6 ? sections.find(s => s.name === matches[0].target) : null;
  }).filter(Boolean);
};

const splitContactsIntoVcfFiles = (contacts, baseName, limit) => {
  const files = [];
  let currentFile = { filename: `${baseName}_1.vcf`, content: '' };
  contacts.forEach((contact, index) => {
    if (index > 0 && index % limit === 0) {
      files.push(currentFile);
      currentFile = { filename: `${baseName}_${files.length + 1}.vcf`, content: '' };
    }
    currentFile.content += `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name}\nTEL:${contact.phone}\nEND:VCARD\n`;
  });
  files.push(currentFile);
  return files;
};

const parseVcf = (content) => {
  const lines = content.split('\n');
  const contacts = [];
  let currentContact = {};

  lines.forEach(line => {
    if (line.startsWith('FN:')) {
      currentContact.name = line.replace('FN:', '').trim();
    } else if (line.startsWith('TEL:')) {
      currentContact.phone = line.replace('TEL:', '').trim();
    } else if (line === 'END:VCARD') {
      contacts.push(currentContact);
      currentContact = {};
    }
  });

  return contacts;
};

const formatContactsAsTxt = (contacts) => {
  const sections = {};
  contacts.forEach(contact => {
    const section = contact.name.split(' ')[0];  // Assuming section name is the first word of the name
    if (!sections[section]) sections[section] = [];
    sections[section].push(contact.phone);
  });

  let content = '';
  Object.entries(sections).forEach(([section, phones]) => {
    content += `${section}\n`;
    phones.forEach(phone => {
      content += `${phone}\n`;
    });
  });

  return content;
};

const formatContactAsVcf = (row) => {
  const [name, phone] = row;
  return `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL:${phone}\nEND:VCARD\n`;
};

bot.launch();
console.log('Bot started');
