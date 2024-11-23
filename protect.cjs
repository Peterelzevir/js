const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const moment = require('moment-timezone');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');

// Bot configuration
const token = '8157797831:AAFrTPHiGvPVr79UZqR6S4lrMCvVyQ2bTDw';
const bot = new TelegramBot(token, { polling: true });

// Admin bot IDs (can be multiple)
const adminBotIds = [5988451717]; // Replace with actual admin IDs

// File paths
const ID_FILE = 'id.json';
const DATA_USER_FILE = 'DataUser.json';
const GROUPS_ID = 'groups.json';
const Temp_ID = 'temp_verify.json';

// Initialize data files if they don't exist
if (!fs.existsSync(ID_FILE)) {
    fs.writeFileSync(ID_FILE, JSON.stringify({}));
}
if (!fs.existsSync(DATA_USER_FILE)) {
    fs.writeFileSync(DATA_USER_FILE, JSON.stringify({}));
}
if (!fs.existsSync(GROUPS_ID)) {
    fs.writeFileSync(GROUPS_ID, JSON.stringify({}));
}
if (!fs.existsSync(Temp_ID)) {
    fs.writeFileSync(Temp_ID, JSON.stringify({}));
}


// Helper functions
const loadData = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const saveData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

const updateUserData = (msg) => {
    const userData = loadData('id.json');
    const userId = msg.from.id.toString();
    
    if (!userData[userId]) {
        userData[userId] = {
            id: userId,
            username: msg.from.username || 'none',
            name: msg.from.first_name,
            firstUse: moment().tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss'),
            lastUse: moment().tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss'),
            messageCount: 1
        };
    } else {
        userData[userId].lastUse = moment().tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss');
        userData[userId].messageCount++;
    }
    
    saveData('id.json', userData);
};

const saveData = (file, data) => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

const getFormattedTime = () => {
    return moment().tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss [WIB]');
};

// Bot event handlers
bot.on('message', (msg) => {
    updateUserData(msg);
});

// Inisialisasi bot.me
bot.getMe().then((me) => {
    bot.me = me;
    console.log("Bot info:", bot.me); // Log info bot
});

bot.on('new_chat_members', async (msg) => {
    console.log("Full message object:", JSON.stringify(msg, null, 2)); // Debug semua data
    const chatId = msg.chat.id;
    const newMembers = msg.new_chat_members;

    if (!Array.isArray(newMembers)) {
        console.error("new_chat_members bukan array:", newMembers);
        return;
    }

    for (const member of newMembers) {
        if (member && member.id && bot.me && bot.me.id) {
            if (member.id === bot.me) {
                await bot.sendMessage(chatId, `✅ *Terima kasih telah mengundang saya ke grup ini!*\n\n⚠️ *PENTING:* Bot harus dijadikan admin grup untuk dapat berfungsi dengan baik.`, {
                    parse_mode: 'Markdown'
                });
            }
        } else {
            console.error("Data member atau bot.me tidak valid:", { member, botMe: bot.me });
        }
    }
});


 // Start command handler yang diupdate
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
    
    // Update user data di id.json
    const userData = loadData(ID_FILE);
    if (!userData[msg.from.id]) {
        userData[msg.from.id] = {
            id: msg.from.id,
            username: msg.from.username,
            name: msg.from.first_name,
            firstUse: getFormattedTime(),
            lastUse: getFormattedTime(),
            totalMessages: 1
        };
    } else {
        userData[msg.from.id].lastUse = getFormattedTime();
        userData[msg.from.id].totalMessages++;
    }
    saveData(ID_FILE, userData);

    // Cek jika ada parameter verifikasi
    const startParam = match[1];
    if (startParam && startParam.startsWith('verify_')) {
        const groupId = startParam.split('verify_')[1];
        try {
            const groupInfo = await bot.getChat(groupId);
            
            await bot.sendMessage(chatId, 
                `✅ Silahkan Verifikasi Agar Dapat Mengirimkan Pesan Ke Dalam Grup ${groupInfo.title} 😆`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [[{
                        text: '📱 Verifikasi',
                        request_contact: true
                    }]],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
            
            // Simpan data verifikasi sementara
            const tempVerifyData = loadData('temp_verify.json');
            tempVerifyData[msg.from.id] = {
                groupId: groupId,
                timestamp: Date.now()
            };
            saveData('temp_verify.json', tempVerifyData);
            
            return;
        } catch (error) {
            console.error('Error getting group info:', error);
            await bot.sendMessage(chatId, '❌ Terjadi kesalahan saat memproses verifikasi. Silahkan coba lagi.');
            return;
        }
    }

    // Pesan start normal jika bukan verifikasi
    await bot.sendMessage(chatId, 
        `🙌 halo ${username}\n👀 saya adalah bot proteksi grup ✅\n\n🙏🏻 kirimkan pesan /help untuk bantuan`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '➕ Invite', url: `https://t.me/${bot.me.username}?startgroup=true` }
            ]]
        }
    });
});

// Message handler for group protection
bot.on('message', async (msg) => {
    // Skip if not in group/supergroup
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') return;

    // Load group data
    const groupData = loadData('groups.json');
    
    // Skip if protection is not enabled
    if (!groupData[msg.chat.id]?.protection) return;

    // Check if user is verified
    const userData = loadData(DATA_USER_FILE);
    if (!userData[msg.from.id]) {
        try {
            // Delete message
            await bot.deleteMessage(msg.chat.id, msg.message_id);
            
            // Send notification with verification button
            const notifMsg = await bot.sendMessage(msg.chat.id,
                `⚠️ @${msg.from.username || msg.from.first_name} kamu harus terverifikasi terlebih dahulu! 🙏🏻\n\n✅ click button dibawah ini 👀`,
                {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '✅ Verifikasi', url: `https://t.me/${bot.me.username}?start=verify_${msg.chat.id}` }
                        ]]
                    }
                }
            );

            // Delete notification after 3 minutes
            setTimeout(() => {
                bot.deleteMessage(msg.chat.id, notifMsg.message_id).catch(() => {});
            }, 180000);
        } catch (err) {
            console.error('Error in protection handler:', err);
        }
    }
});

// Contact message handler untuk verifikasi
bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const contact = msg.contact;
    
    // Load temporary verification data
    const tempVerifyData = loadData('temp_verify.json');
    
    if (tempVerifyData[msg.from.id]) {
        const verifyData = tempVerifyData[msg.from.id];
        const groupId = verifyData.groupId;
        
        // Verify that the contact is the same as the user
        if (contact.user_id === msg.from.id) {
            // Save user data to DataUser.json
            const dataUser = loadData(DATA_USER_FILE);
            dataUser[msg.from.id] = {
                id: msg.from.id,
                username: msg.from.username,
                name: contact.first_name + (contact.last_name ? ' ' + contact.last_name : ''),
                phone: contact.phone_number,
                verificationTime: getFormattedTime(),
                groupId: groupId
            };
            saveData(DATA_USER_FILE, dataUser);
            
            // Remove temporary verification data
            delete tempVerifyData[msg.from.id];
            saveData('temp_verify.json', tempVerifyData);
            
            // Send success message with emojis
            await bot.sendMessage(chatId, 
                `✅ *Verifikasi Berhasil!*\n\n` +
                `🌟 Selamat ${contact.first_name}!\n` +
                `📱 Nomor: \`${contact.phone_number}\`\n` +
                `⏰ Waktu: \`${getFormattedTime()}\`\n\n` +
                `🔓 Anda sekarang dapat mengirim pesan di grup!`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    remove_keyboard: true
                }
            });
            
            // Notify group
            try {
                const groupInfo = await bot.getChat(groupId);
                await bot.sendMessage(groupId, 
                    `✨ User @${msg.from.username || msg.from.first_name} telah terverifikasi dan dapat mengirim pesan dalam grup!`, {
                    parse_mode: 'Markdown'
                });
            } catch (err) {
                console.error('Error sending group notification:', err);
            }
        } else {
            await bot.sendMessage(chatId, 
                '❌ Verifikasi gagal! Mohon kirim kontak Anda sendiri.', {
                reply_markup: {
                    keyboard: [[{
                        text: '📱 Verifikasi',
                        request_contact: true
                    }]],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
        }
    } else {
        await bot.sendMessage(chatId, 
            '❌ Sesi verifikasi tidak ditemukan. Silahkan mulai verifikasi dari grup.', {
            reply_markup: {
                remove_keyboard: true
            }
        });
    }
});
// Initialize temp_verify.json if not exists
if (!fs.existsSync('DataUser.json')) {
    fs.writeFileSync('DataUser.json', JSON.stringify({}));
}

// Cleanup old verification data periodically (every hour)
setInterval(() => {
    const tempVerifyData = loadData('DataUser.json');
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    let changed = false;
    for (const userId in tempVerifyData) {
        if (tempVerifyData[userId].timestamp < oneHourAgo) {
            delete tempVerifyData[userId];
            changed = true;
        }
    }
    
    if (changed) {
        saveData('DataUser.json', tempVerifyData);
    }
}, 60 * 60 * 1000);

// ... (kode lainnya tetap sama)

// Protection command
bot.onText(/\/pro (on|off)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (msg.chat.type === 'private') {
        return bot.sendMessage(chatId, '⚠️ Perintah ini hanya dapat digunakan dalam grup!');
    }

    const chatMember = await bot.getChatMember(chatId, msg.from.id);
    if (!['creator', 'administrator'].includes(chatMember.status)) {
        return bot.sendMessage(chatId, '⚠️ Perintah ini hanya dapat digunakan oleh admin grup!');
    }

    const status = match[1];
    const groupData = loadData('groups.json');
    groupData[chatId] = { protection: status === 'on' };
    saveData('groups.json', groupData);

    await bot.sendMessage(chatId, `✅ Proteksi grup telah di${status}aktifkan!`);
});

// List command
bot.onText(/\/list/, async (msg) => {
    const isAdmin = adminBotIds.includes(msg.from.id.toString());
    const users = loadData('id.json');
    const usersArray = Object.values(users);
    const PAGE_SIZE = 10;
    let page = 0;
    
    const generateListMessage = (page) => {
        const start = page * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageUsers = usersArray.slice(start, end);
        
        let message = '👥 *Daftar Pengguna Bot*\n\n';
        pageUsers.forEach((user, index) => {
            const userInfo = isAdmin ? 
                `${start + index + 1}. *Nama:* ${user.name}\n    *Username:* @${user.username}\n    *ID:* \`${user.id}\`\n    *Pesan:* ${user.messageCount}\n    *Pertama:* ${user.firstUse}\n    *Terakhir:* ${user.lastUse}\n\n` :
                `${start + index + 1}. *Nama:* ${user.name.substring(0, 3)}***\n    *Username:* @${user.username}\n    *Pesan:* ${user.messageCount}\n\n`;
            message += userInfo;
        });
        
        return message;
    };
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '⬅️ Back', callback_data: `list_${page-1}` },
                { text: '➡️ Next', callback_data: `list_${page+1}` }
            ],
            [{ text: '📥 Backup', callback_data: 'backup_list' }]
        ]
    };
    
    const msg1 = await bot.sendMessage(
        msg.chat.id,
        generateListMessage(page),
        { 
            reply_markup: keyboard,
            parse_mode: 'Markdown' 
        }
    );
    
    // Handle list navigation
    bot.on('callback_query', async (query) => {
        if (query.data.startsWith('list_')) {
            const newPage = parseInt(query.data.split('_')[1]);
            if (newPage >= 0 && newPage * PAGE_SIZE < usersArray.length) {
                page = newPage;
                await bot.editMessageText(
                    generateListMessage(page),
                    {
                        chat_id: msg1.chat.id,
                        message_id: msg1.message_id,
                        reply_markup: keyboard,
                        parse_mode: 'Markdown'
                    }
                );
            }
        } else if (query.data === 'backup_list') {
            const backupKeyboard = {
                inline_keyboard: [
                    [
                        { text: 'XLSX', callback_data: 'backup_xlsx' },
                        { text: 'JSON', callback_data: 'backup_json' },
                        { text: 'TXT', callback_data: 'backup_txt' },
                        { text: 'PDF', callback_data: 'backup_pdf' }
                    ]
                ]
            };
            
            await bot.editMessageText(
                '📥 Pilih format backup:',
                {
                    chat_id: msg1.chat.id,
                    message_id: msg1.message_id,
                    reply_markup: backupKeyboard
                }
            );
        }
    });
});

// Search command and inline query
bot.onText(/\/search (.+)/, async (msg, match) => {
    if (!adminBotIds.includes(msg.from.id.toString())) {
        return bot.sendMessage(msg.chat.id, '❌ Perintah ini hanya untuk admin bot!');
    }
    
    const query = match[1].toLowerCase();
    const users = loadData('DataUser.json');
    const results = Object.values(users).filter(user => 
        user.name.toLowerCase().includes(query) ||
        user.username?.toLowerCase().includes(query) ||
        user.id.toString().includes(query) ||
        user.phone?.includes(query)
    );
    
    if (results.length === 0) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '➕ Invite', url: `https://t.me/${(await bot.getMe()).username}?startgroup=true` }]
            ]
        };
        
        return bot.sendMessage(
            msg.chat.id,
            '❌ User tidak ditemukan!\n\nInvite bot ke grup Anda:',
            { reply_markup: keyboard }
        );
    }
    
    results.forEach(user => {
        const message = `📱 *Informasi User*\n\n` +
            `👤 *Nama:* ${user.name}\n` +
            `🔖 *Username:* @${user.username}\n` +
            `🆔 *ID:* \`${user.id}\`\n` +
            `📞 *Nomor:* ${user.phone}\n` +
            `📅 *Terdaftar:* ${user.registerDate}`;
            
        const keyboard = {
            inline_keyboard: [
                [{ text: '📤 Share', switch_inline_query: user.id.toString() }]
            ]
        };
        
        bot.sendMessage(msg.chat.id, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    });
});

// Inline query handler
bot.on('inline_query', async (query) => {
    if (!adminBotIds.includes(query.from.id.toString())) {
        return;
    }
    
    const users = loadData('DataUser.json');
    const searchText = query.query.toLowerCase();
    const results = Object.values(users)
        .filter(user => 
            user.name.toLowerCase().includes(searchText) ||
            user.username?.toLowerCase().includes(searchText) ||
            user.id.toString().includes(searchText) ||
            user.phone?.includes(searchText)
        )
        .map(user => ({
            type: 'article',
            id: user.id,
            title: user.name,
            description: `@${user.username} | ID: ${user.id}`,
            input_message_content: {
                message_text: `📱 *Informasi User*\n\n` +
                    `👤 *Nama:* ${user.name}\n` +
                    `🔖 *Username:* @${user.username}\n` +
                    `🆔 *ID:* \`${user.id}\`\n` +
                    `📞 *Nomor:* ${user.phone}\n` +
                    `📅 *Terdaftar:* ${user.registerDate}`,
                parse_mode: 'Markdown'
            }
        }));
    
    bot.answerInlineQuery(query.id, results);
});


// ... (continuing from previous code)

// Handle verification messages
bot.on('contact', async (msg) => {
    if (msg.chat.type === 'private') {
        const userData = loadData('DataUser.json');
        const userId = msg.from.id.toString();
        
        if (!userData[userId]) {
            userData[userId] = {
                id: userId,
                name: msg.from.first_name,
                username: msg.from.username || 'none',
                phone: msg.contact.phone_number,
                registerDate: moment().tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm:ss'),
                groups: []
            };
            
            saveData('DataUser.json', userData);
            
            const successMessage = `✨ *Verifikasi Berhasil!*\n\n` +
                `Selamat! Anda telah terverifikasi dan dapat mengirim pesan ke dalam grup.`;
                
            bot.sendMessage(msg.chat.id, successMessage, { 
                parse_mode: 'Markdown',
                reply_markup: { remove_keyboard: true }
            });
        }
    }
});

// Data command
bot.onText(/\/data/, async (msg) => {
    if (!adminBotIds.includes(msg.from.id.toString())) {
        return bot.sendMessage(msg.chat.id, '❌ Perintah ini hanya untuk admin bot!');
    }
    
    const verifiedUsers = loadData('DataUser.json');
    const usersArray = Object.values(verifiedUsers);
    const PAGE_SIZE = 10;
    let page = 0;
    
    const generateDataMessage = (page) => {
        const start = page * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageUsers = usersArray.slice(start, end);
        
        let message = '📊 *Data Pengguna Terverifikasi*\n\n';
        pageUsers.forEach((user, index) => {
            message += `${start + index + 1}. *Nama:* ${user.name}\n` +
                `    *Username:* @${user.username}\n` +
                `    *ID:* \`${user.id}\`\n` +
                `    *Nomor:* ${user.phone}\n` +
                `    *Terdaftar:* ${user.registerDate}\n\n`;
        });
        
        return message;
    };
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '⬅️ Back', callback_data: `data_${page-1}` },
                { text: '➡️ Next', callback_data: `data_${page+1}` }
            ],
            [{ text: '📥 Backup', callback_data: 'backup_data' }]
        ]
    };
    
    const msgData = await bot.sendMessage(
        msg.chat.id,
        generateDataMessage(page),
        { 
            reply_markup: keyboard,
            parse_mode: 'Markdown' 
        }
    );
    
    // Handle data navigation and backup
    bot.on('callback_query', async (query) => {
        if (query.data.startsWith('data_')) {
            const newPage = parseInt(query.data.split('_')[1]);
            if (newPage >= 0 && newPage * PAGE_SIZE < usersArray.length) {
                page = newPage;
                await bot.editMessageText(
                    generateDataMessage(page),
                    {
                        chat_id: msgData.chat.id,
                        message_id: msgData.message_id,
                        reply_markup: keyboard,
                        parse_mode: 'Markdown'
                    }
                );
            }
        } else if (query.data === 'backup_data') {
            const backupKeyboard = {
                inline_keyboard: [
                    [
                        { text: 'XLSX', callback_data: 'backup_data_xlsx' },
                        { text: 'JSON', callback_data: 'backup_data_json' },
                        { text: 'TXT', callback_data: 'backup_data_txt' },
                        { text: 'PDF', callback_data: 'backup_data_pdf' }
                    ]
                ]
            };
            
            await bot.editMessageText(
                '📥 Pilih format backup data:',
                {
                    chat_id: msgData.chat.id,
                    message_id: msgData.message_id,
                    reply_markup: backupKeyboard
                }
            );
        }
    });
});

// Handle backup generation for both list and data commands
bot.on('callback_query', async (query) => {
    if (query.data.startsWith('backup_')) {
        const [action, type, format] = query.data.split('_');
        const isDataBackup = type === 'data';
        const data = loadData(isDataBackup ? 'DataUser.json' : 'id.json');
        
        const statusMsg = await bot.editMessageText(
            '⏳ Memproses backup...',
            {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id
            }
        );
        
        try {
            let fileBuffer;
            let fileName;
            
            switch (format) {
                case 'xlsx':
                    const ws = XLSX.utils.json_to_sheet(Object.values(data));
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Data');
                    fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
                    fileName = `backup_${isDataBackup ? 'users' : 'data'}.xlsx`;
                    break;
                    
                case 'json':
                    fileBuffer = Buffer.from(JSON.stringify(data, null, 2));
                    fileName = `backup_${isDataBackup ? 'users' : 'data'}.json`;
                    break;
                    
                case 'txt':
                    let txtContent = '';
                    Object.values(data).forEach(user => {
                        txtContent += `Nama: ${user.name}\n`;
                        txtContent += `Username: @${user.username}\n`;
                        txtContent += `ID: ${user.id}\n`;
                        if (user.phone) txtContent += `Nomor: ${user.phone}\n`;
                        txtContent += `Terdaftar: ${user.registerDate || user.firstUse}\n\n`;
                    });
                    fileBuffer = Buffer.from(txtContent);
                    fileName = `backup_${isDataBackup ? 'users' : 'data'}.txt`;
                    break;
                    
                case 'pdf':
                    const doc = new PDFDocument();
                    const chunks = [];
                    doc.on('data', chunk => chunks.push(chunk));
                    doc.fontSize(12);
                    
                    Object.values(data).forEach(user => {
                        doc.text(`Nama: ${user.name}`);
                        doc.text(`Username: @${user.username}`);
                        doc.text(`ID: ${user.id}`);
                        if (user.phone) doc.text(`Nomor: ${user.phone}`);
                        doc.text(`Terdaftar: ${user.registerDate || user.firstUse}`);
                        doc.moveDown();
                    });
                    
                    doc.end();
                    fileBuffer = Buffer.concat(chunks);
                    fileName = `backup_${isDataBackup ? 'users' : 'data'}.pdf`;
                    break;
            }
            
            await bot.sendDocument(query.message.chat.id, fileBuffer, 
                { 
                    filename: fileName,
                    caption: '✅ Backup berhasil dibuat!'
                }
            );
            
            await bot.editMessageText(
                '✅ Backup berhasil dibuat dan dikirim!',
                {
                    chat_id: query.message.chat.id,
                    message_id: statusMsg.message_id
                }
            );
            
        } catch (error) {
            console.error('Backup error:', error);
            await bot.editMessageText(
                '❌ Terjadi kesalahan saat membuat backup!',
                {
                    chat_id: query.message.chat.id,
                    message_id: statusMsg.message_id
                }
            );
        }
    }
});

// Broadcast command
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!adminBotIds.includes(msg.from.id)) {
        return bot.sendMessage(chatId, '⚠️ Perintah ini hanya untuk admin bot!');
    }

    const message = match[1];
    const users = loadData(ID_FILE);
    let sentCount = 0;
    let failCount = 0;
    const statusMsg = await bot.sendMessage(chatId, '📤 Memulai broadcast...');

    for (const userId in users) {
        try {
            await bot.sendMessage(userId, `📢 *BROADCAST*\n\n${message}`, {
                parse_mode: 'Markdown'
            });
            sentCount++;
            await bot.editMessageText(
                `📤 Mengirim broadcast...\nBerhasil: ${sentCount}\nGagal: ${failCount}`,
                { chat_id: chatId, message_id: statusMsg.message_id }
            );
        } catch (err) {
            failCount++;
        }
    }

    await bot.editMessageText(
        `✅ Broadcast selesai!\nBerhasil: ${sentCount}\nGagal: ${failCount}`,
        { chat_id: chatId, message_id: statusMsg.message_id }
    );
});

// Search command and inline query
bot.onText(/\/search (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!adminBotIds.includes(msg.from.id)) {
        return bot.sendMessage(chatId, '⚠️ Perintah ini hanya untuk admin bot!');
    }

    const query = match[1].toLowerCase();
    const users = loadData(DATA_USER_FILE);
    const results = Object.values(users).filter(user => 
        String(user.id).includes(query) ||
        (user.username && user.username.toLowerCase().includes(query)) ||
        (user.name && user.name.toLowerCase().includes(query)) ||
        (user.phone && user.phone.includes(query))
    );

    if (results.length === 0) {
        return bot.sendMessage(chatId, '❌ Data tidak ditemukan!\n\nInvite bot ke grup anda:', {
            reply_markup: {
                inline_keyboard: [[
                    { text: '➕ Invite', url: `https://t.me/${bot.me.username}?startgroup=true` }
                ]]
            }
        });
    }

    for (const user of results) {
        const message = `🔍 *HASIL PENCARIAN*\n\n` +
            `📱 *ID:* \`${user.id}\`\n` +
            `👤 *Nama:* ${user.name}\n` +
            `🔖 *Username:* ${user.username ? '@' + user.username : '-'}\n` +
            `☎️ *Nomor:* \`${user.phone || '-'}\`\n` +
            `📅 *Terdaftar:* \`${user.verificationTime || '-'}\``;

        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '📤 Share', switch_inline_query: String(user.id) }
                ]]
            }
        });
    }
});

// Inline query handler
bot.on('inline_query', async (query) => {
    if (!adminBotIds.includes(query.from.id)) {
        return bot.answerInlineQuery(query.id, [], {
            switch_pm_text: '⚠️ Fitur ini hanya untuk admin bot!',
            switch_pm_parameter: 'auth'
        });
    }

    const users = loadData(DATA_USER_FILE);
    const searchQuery = query.query.toLowerCase();
    const results = Object.values(users)
        .filter(user =>
            String(user.id).includes(searchQuery) ||
            (user.username && user.username.toLowerCase().includes(searchQuery)) ||
            (user.name && user.name.toLowerCase().includes(searchQuery)) ||
            (user.phone && user.phone.includes(searchQuery))
        )
        .map(user => ({
            type: 'article',
            id: String(user.id),
            title: user.name,
            description: `ID: ${user.id} | Username: ${user.username || '-'}`,
            input_message_content: {
                message_text: `🔍 *INFO USER*\n\n` +
                    `📱 *ID:* \`${user.id}\`\n` +
                    `👤 *Nama:* ${user.name}\n` +
                    `🔖 *Username:* ${user.username ? '@' + user.username : '-'}\n` +
                    `☎️ *Nomor:* \`${user.phone || '-'}\`\n` +
                    `📅 *Terdaftar:* \`${user.verificationTime || '-'}\``,
                parse_mode: 'Markdown'
            }
        }));

    await bot.answerInlineQuery(query.id, results);
});

// Help command
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const isGroup = msg.chat.type !== 'private';
    const isGroupAdmin = isGroup ? ['creator', 'administrator'].includes((await bot.getChatMember(chatId, msg.from.id)).status) : false;
    const isBotAdmin = adminBotIds.includes(msg.from.id);

    let helpText = `🤖 *BANTUAN PENGGUNAAN BOT*\n\n`;

    // Commands for everyone
    helpText += `*Perintah Umum:*\n`;
    helpText += `• /start - Memulai bot\n`;
    helpText += `• /help - Menampilkan bantuan\n\n`;

    // Group admin commands
    if (isGroup) {
        helpText += `*Perintah Admin Grup:*\n`;
        helpText += `• /pro on - Mengaktifkan proteksi grup\n`;
        helpText += `• /pro off - Menonaktifkan proteksi grup\n\n`;
    }

    // Bot admin commands
    if (isBotAdmin) {
        helpText += `*Perintah Admin Bot:*\n`;
        helpText += `• /broadcast - Mengirim pesan broadcast\n`;
        helpText += `• /data - Melihat data pengguna terverifikasi\n`;
        helpText += `• /list - Melihat daftar pengguna bot\n`;
        helpText += `• /search - Mencari data pengguna\n`;
        helpText += `• @${bot.me.username} - Pencarian inline\n`;
    }

    await bot.sendMessage(chatId, helpText, {
        parse_mode: 'Markdown'
    });
});

// Message handler for group protection
bot.on('message', async (msg) => {
    if (!msg.chat.type === 'group' && !msg.chat.type === 'supergroup') return;

    const groupData = loadData('groups.json');
    if (!groupData[msg.chat.id]?.protection) return;

    const userData = loadData(DATA_USER_FILE);
    if (!userData[msg.from.id]) {
        try {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
            const notifMsg = await bot.sendMessage(msg.chat.id,
                `⚠️ @${msg.from.username || msg.from.first_name} kamu harus terverifikasi terlebih dahulu! 🙏🏻\n\n✅ click button dibawah ini 👀`,
                {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '✅ Verifikasi', url: `https://t.me/${bot.me.username}?start=verify_${msg.chat.id}` }
                        ]]
                    }
                }
            );

            // Delete notification after 3 minutes
            setTimeout(() => {
                bot.deleteMessage(msg.chat.id, notifMsg.message_id).catch(() => {});
            }, 180000);
        } catch (err) {
            console.error('Error in protection handler:', err);
        }
    }
});

console.log('Bot is running...');
