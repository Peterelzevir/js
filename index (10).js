// Source code by @hiyaok programmer
// Telegram @hiyaok
// Harga script Rp.600.000+

// Modules
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const XLSX = require('xlsx');
const stringSimilarity = require('string-similarity');

const bot = new Telegraf('7406919687:AAGNLXrAWlNgN1_nz6MWevsBXvSM5klIQBI'); // Ganti dengan token bot Anda
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
  const message = `Halo @${username}, Anda tidak memiliki akses untuk menggunakan bot ini. Silakan hubungi admin untuk informasi lebih lanjut.`;
  ctx.reply(message);
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

  ctx.reply('🖐🏻 Selamat datang! Silakan pilih mode:\n1. TXT ke VCF\n2. VCF ke TXT\n3. XLSX ke VCF\n4. VCF ke XLSX\n\nBalas dengan nomor pilihan Anda.');
});

// Handler untuk pesan teks
bot.on('text', async (ctx) => {
  if (!isPremiumOrAdmin(ctx)) {
    sendNoAccessMessage(ctx);
    return;
  }

  const userId = ctx.from.id;
  const session = loadUserSession(userId);

  if (!session.mode) {
    const mode = ctx.message.text.trim();
    if (['1', '2', '3', '4'].includes(mode)) {
      session.mode = mode;
      saveUserSession(userId, session);
      ctx.reply('Mode diatur. Silakan kirim file untuk dikonversi 📂');
    } else {
      ctx.reply('Mode tidak valid. Silakan pilih mode:\n1. TXT ke VCF\n2. VCF ke TXT\n3. XLSX ke VCF\n4. VCF ke XLSX');
    }
    return;
  }

  ctx.reply('Silakan kirim file untuk dikonversi 📂');
});

bot.on('document', async (ctx) => {
  if (!isPremiumOrAdmin(ctx)) {
    sendNoAccessMessage(ctx);
    return;
  }

  const userId = ctx.from.id;
  const session = loadUserSession(userId);

  if (!session.mode) {
    ctx.reply('Silakan pilih mode terlebih dahulu ❗');
    return;
  }
  
  const fileType = ctx.message.document.mime_type;
  let validFile = false;

  switch (session.mode) {
    case '1':
      if (fileType === 'text/plain') validFile = true;
      break;
    case '2':
      if (fileType === 'text/vcard') validFile = true;
      break;
    case '3':
      if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') validFile = true;
      break;
    case '4':
      if (fileType === 'text/vcard') validFile = true;
      break;
  }

  if (!validFile) {
    ctx.reply('Dokumen yang Anda unggah tidak sesuai dengan mode yang dipilih. Silakan unggah dokumen yang sesuai atau ubah mode.');
    return;
  }

  const fileLink = await ctx.telegram.getFileLink(ctx.message.document.file_id);
  const response = await fetch(fileLink.href);
  const fileBuffer = await response.buffer();

  ctx.reply('Sedang memproses file Anda...');

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
      ctx.reply('Mode tidak valid.');
      break;
  }
});

const handleTxtToVcf = (buffer, caption, ctx) => {
  const content = buffer.toString('utf-8');
  const sections = parseSections(content);
  const [sectionNames, outputFileName, contactLimitStr] = caption.split(',');
  const contactLimit = parseInt(contactLimitStr, 10);

  if (!sectionNames || !outputFileName || isNaN(contactLimit)) {
    ctx.reply('Format keterangan tidak valid. Gunakan: Nama Bagian, Nama File Output, Batas Kontak per File ❗');
    return;
  }

  const targetSections = getTargetSections(sections, sectionNames.split('+'));
  if (targetSections.length === 0) {
    ctx.reply(`Bagian ${sectionNames} tidak ditemukan.`);
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
  const outputFile = createTxtFile(contacts);
  ctx.replyWithDocument({ source: Buffer.from(outputFile), filename: 'ConvertDone.txt' });
};

const handleXlsxToVcf = (buffer, ctx) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const contacts = parseXlsx(workbook);
  const outputFile = createVcfFile(contacts);
  ctx.replyWithDocument({ source: Buffer.from(outputFile), filename: 'ConvertDone.vcf' });
};

const handleVcfToXlsx = (buffer, ctx) => {
  const content = buffer.toString('utf-8');
  const contacts = parseVcf(content);
  const workbook = createXlsx(contacts);
  const outputBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  ctx.replyWithDocument({ source: outputBuffer, filename: 'ConvertDone.xlsx' });
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
    const content = chunk.map(contact => `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name}\nTEL;TYPE=CELL:${contact.phone}\nEND:VCARD`).join('\n');
    outputFiles.push({ content: content, filename: `${baseName}_${i + 1}-${i + chunk.length}.vcf` });
  }

  return outputFiles;
};

const parseVcf = (content) => {
  const contacts = [];
  const lines = content.split('\n');

  let currentContact = null;

  lines.forEach(line => {
    line = line.trim();
    if (line.startsWith('FN:')) {
      if (currentContact) {
        contacts.push(currentContact);
      }
      currentContact = { name: line.substring(3), phones: [] };
    } else if (line.startsWith('TEL;')) {
      currentContact.phones.push(line.substring(9));
    }
  });

  if (currentContact) {
    contacts.push(currentContact);
  }

  return contacts;
};

const createTxtFile = (contacts) => {
  const lines = contacts.map(contact => `${contact.name}: ${contact.phones.join(', ')}`).join('\n');
  return Buffer.from(lines, 'utf-8');
};

const parseXlsx = (workbook) => {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const contacts = [];
  let rowIndex = 2;

  while (sheet[`A${rowIndex}`]) {
    const name = sheet[`A${rowIndex}`].v;
    const phone = sheet[`B${rowIndex}`].v.toString();
    contacts.push({ name: name, phone: phone.startsWith('+') ? phone : `+${phone}` });
    rowIndex++;
  }

  return contacts;
};

const createVcfFile = (contacts) => {
  const content = contacts.map(contact => `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name}\nTEL;TYPE=CELL:${contact.phone}\nEND:VCARD`).join('\n');
  return Buffer.from(content, 'utf-8');
};

const createXlsx = (contacts) => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(contacts.map(contact => ({ 'Name': contact.name, 'Phone': contact.phone })));
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
  return workbook;
};

// Perintah /premium untuk admin
bot.command('premium', (ctx) => {
  const userId = ctx.from.id.toString();
  if (userId !== adminId) {
    ctx.reply('Anda tidak memiliki izin untuk menggunakan perintah ini.');
    return;
  }

  const [command, targetUserId, days] = ctx.message.text.split(' ');
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + parseInt(days));

  const premiumUsers = loadPremiumUsers();
  premiumUsers[targetUserId] = {
    expiryDate: expiryDate.toISOString(),
    addedBy: userId
  };
  savePremiumUsers(premiumUsers);

  ctx.telegram.sendMessage(targetUserId, `Selamat! Anda telah menjadi pengguna premium selama ${days} hari.`);
  ctx.reply(`Pengguna ${targetUserId} telah ditambahkan sebagai pengguna premium selama ${days} hari.`);
});

// Perintah /delpremium untuk admin
bot.command('delpremium', (ctx) => {
  const userId = ctx.from.id.toString();
  if (userId !== adminId) {
    ctx.reply('Anda tidak memiliki izin untuk menggunakan perintah ini.');
    return;
  }

  const [command, targetUserId] = ctx.message.text.split(' ');

  const premiumUsers = loadPremiumUsers();
  if (premiumUsers[targetUserId]) {
    delete premiumUsers[targetUserId];
    savePremiumUsers(premiumUsers);
    ctx.telegram.sendMessage(targetUserId, 'Status premium Anda telah dihapus.');
    ctx.reply(`Pengguna ${targetUserId} telah dihapus dari daftar pengguna premium.`);
  } else {
    ctx.reply(`Pengguna ${targetUserId} tidak ditemukan dalam daftar pengguna premium.`);
  }
});

// Perintah /listprem untuk admin
bot.command('listprem', (ctx) => {
  const userId = ctx.from.id.toString();
  if (userId !== adminId) {
    ctx.reply('Anda tidak memiliki izin untuk menggunakan perintah ini.');
    return;
  }

  const premiumUsers = loadPremiumUsers();
  const now = new Date();
  let message = 'Daftar Pengguna Premium:\n\n';

  Object.keys(premiumUsers).forEach((key, index) => {
    const user = premiumUsers[key];
    const expiryDate = new Date(user.expiryDate);
    const remainingDays = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    message += `${index + 1}. ID: ${key}, Berakhir: ${expiryDate.toLocaleDateString()}, Sisa Hari: ${remainingDays}\n`;
  });

  if (Object.keys(premiumUsers).length === 0) {
    message = 'Tidak ada pengguna premium saat ini.';
  }

  ctx.reply(message);
});

bot.launch();
