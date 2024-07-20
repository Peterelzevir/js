const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Ganti dengan token bot Anda
const token = '6795745264:AAHIA389V7FexXfryIA9nFDaTCL5k8GSWp0';
const bot = new TelegramBot(token, { polling: true });

let welcomeMessages = {};
let premiumUsers = {}; // Store premium user data
let userIds = []; // Store user IDs

// Start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;

    // Save user ID to file
    if (!userIds.includes(msg.from.id)) {
        userIds.push(msg.from.id);
        // Append user ID to dataid.txt (implement file writing logic here)
    }

    const botUsername = bot.getMe().then(botInfo => botInfo.username);
    botUsername.then(botName => {
        const message = `(\__/) WINTER SUPPORT\n(â€¢ã……â€¢) (ï½¡>ï¹<ï½¡)\n/ ã¥ MADE IN INDONESIA ðŸ‡®ðŸ‡©\n\nâ•”â•â•â•â• [Information] â•â•â•â•â•—\nâ•  ID : ${msg.from.id}\nâ•  USERNAME : @${username}\nâ•  PREMIUM : ${premiumUsers[msg.from.id] ? 'Aktif' : 'Tidak Aktif'}\nâ• â•â•â•â•â•â• [ MENU ] â•â•â•â•â•—\nâ• âž¤ /Cari [ Search Google ]\nâ• âž¤ /Stalkig [ username ig ]\nâ• âž¤ /Id [ Cek Id ]\nâ• âž¤ /Music [ Lirik ]\nâ• âž¤ /Spotify [ url ]\nâ• âž¤ /tiktok [ url ]\nâ• âž¤ /Gempa [ info Gempa ]\nâ• âž¤ /setwelcome [ pesan ]\nâ• âž¤ /ig [ url ]\nâ• âž¤ /waifu\nâ• âž¤ /google [ text ]\nâ• âž¤ /premium [ id ] [ brp days ]\nâ• âž¤ /ban (id) (durasi hukuman)\nâ• âž¤ /unban (id)\nâ• âž¤ /totaluser\nâ• âž¤ /bc (text)\nâ•š â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\nGUNAKAN BOT DENGGAN BIJAK!!\n[ROOM PUBLIC ðŸŒ]:https://t.me/RoomPublikLux\n[DEVELOPER ðŸ§™â™‚ï¸](http://t.me/LuxInGame)`;

        const options = {
            reply_markup: {
                inline_keyboard: [[{ text: 'Menu', callback_data: 'menu' }]]
            }
        };
        bot.sendMessage(chatId, message, options);
    });
});

// Callback query handler
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    if (data === 'menu') {
        const menuMessage = `Menu yang tersedia!\n\n1. /tiktok [ url ]\n2. /lirik [ text ]\n3. /id [ cek id telegram ]\n4. /infogempa\n5. /setwelcome [ pesan ]\n6. /ig [ url ]\n7. /waifu\n8. /google [ text ]\n9. /premium [ id ] [ brp days ]\n10. /ban (id) (durasi hukuman)\n11. /unban (id)\n12. /totaluser\n13. /bc (text)\n14. /setwelcome [ pesan ]`;
        const options = {
            reply_markup: {
                inline_keyboard: [[{ text: 'Back', callback_data: 'back' }]]
            }
        };
        bot.editMessageText(menuMessage, { chat_id: chatId, message_id: messageId, reply_markup: options.reply_markup });
    }

    if (data === 'back') {
        const username = callbackQuery.from.username;
        const botUsername = bot.getMe().then(botInfo => botInfo.username);
        botUsername.then(botName => {
            const message = `Welcome @${username}, Saya adalah Bot @${botName}`;
            const options = {
                reply_markup: {
                    inline_keyboard: [[{ text: 'Menu', callback_data: 'menu' }]]
                }
            };
            bot.editMessageText(message, { chat_id: chatId, message_id: messageId, reply_markup: options.reply_markup });
        });
    }
});

// Set welcome message command
bot.onText(/\/setwelcome (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const welcomeMessage = match[1];
    welcomeMessages[chatId] = welcomeMessage;
    bot.sendMessage(chatId, 'Pesan welcome berhasil diatur!');
});

// Handle new chat members
bot.on('new_chat_members', (msg) => {
    const chatId = msg.chat.id;
    const newUser = msg.new_chat_member;
    const welcomeMessage = welcomeMessages[chatId];

    if (welcomeMessage) {
        const message = welcomeMessage
            .replace('{username}', `@${newUser.username}`)
            .replace('{user_id}', newUser.id)
            .replace('{first_name}', newUser.first_name)
            .replace('{group_id}', chatId);
        bot.sendMessage(chatId, message);
    }
});

// Tiktok command
bot.onText(/\/tiktok(.*)/, (msg, match) => {
    const chatId = msg.chat.id;
    const url = match[1].trim();
    if (!url) {
        bot.sendMessage(chatId, 'Silahkan kirimkan /tiktok [ url ]');
    } else {
        const processingMessage = bot.sendMessage(chatId, 'Processing...');
        axios.get(`https://api.ngodingaja.my.id/api/tiktok?url=${url}`)
            .then(response => {
                const data = response.data;
                if (data.status) {
                    const videoUrl = data.hasil.tanpawm;
                    const title = data.hasil.judul;
                    const botUsername = bot.getMe().then(botInfo => botInfo.username);
                    botUsername.then(botName => {
                        const caption = `**Judul**: ${title}\n\nby @${botName}`;
                        bot.sendVideo(chatId, videoUrl, { caption, parse_mode: 'Markdown' })
                            .then(() => {
                                processingMessage.then(sentMsg => {
                                    bot.deleteMessage(chatId, sentMsg.message_id);
                                });
                            });
                    });
                } else {
                    bot.sendMessage(chatId, 'Gagal mengambil video dari URL tersebut.');
                }
            })
            .catch(error => {
                console.error(error);
                bot.sendMessage(chatId, 'Terjadi kesalahan saat memproses permintaan Anda.');
            });
    }
});

// Lirik command
bot.onText(/\/lirik(.*)/, (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1].trim();
    if (!text) {
        bot.sendMessage(chatId, 'Silahkan kirimkan /lirik [ text ]');
    } else {
        const processingMessage = bot.sendMessage(chatId, 'Processing...');
        axios.get(`https://api.ngodingaja.my.id/api/lirik?search=${text}`)
            .then(response => {
                const data = response.data;
                if (data.status) {
                    const artist = data.hasil.artis;
                    const title = data.hasil.judul;
                    const lyrics = data.hasil.lirik;
                    const imageUrl = data.hasil.gambar;
                    const botUsername = bot.getMe().then(botInfo => botInfo.username);
                    botUsername.then(botName => {
                        const caption = `**Artis**: ${artist}\n**Judul**: ${title}\n**Lirik**: ${lyrics}\n\nby @${botName}`;
                        bot.sendPhoto(chatId, imageUrl, { caption, parse_mode: 'Markdown' })
                            .then(() => {
                                processingMessage.then(sentMsg => {
                                    bot.deleteMessage(chatId, sentMsg.message_id);
                                });
                            });
                    });
                } else {
                    bot.sendMessage(chatId, 'Gagal mengambil lirik dari teks tersebut.');
                }
            })
            .catch(error => {
                console.error(error);
                bot.sendMessage(chatId, 'Terjadi kesalahan saat memproses permintaan Anda.');
            });
    }
});

// ID command
bot.onText(/\/id/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    bot.sendMessage(chatId, `ID Telegram Anda adalah: ${userId}`);
});

// Infogempa command
bot.onText(/\/infogempa/, (msg) => {
    const chatId = msg.chat.id;
    const processingMessage = bot.sendMessage(chatId, 'Processing...');
    axios.get('https://api.ngodingaja.my.id/api/infogempa')
        .then(response => {
            const data = response.data;
            if (data.status) {
                const { tanggal, jam, koordinat, lintang, bujur, magnitude, kedalaman, wilayah, potensi, dirasakan, gambar } = data.hasil;
                const caption = `**Tanggal**: ${tanggal}\n**Jam**: ${jam}\n**Koordinat**: ${koordinat}\n**Lintang**: ${lintang}\n**Bujur**: ${bujur}\n**Magnitude**: ${magnitude}\n**Kedalaman**: ${kedalaman}\n**Wilayah**: ${wilayah}\n**Potensi**: ${potensi}\n**Dirasakan**: ${dirasakan}`;
                bot.sendPhoto(chatId, gambar, { caption, parse_mode: 'Markdown' })
                    .then(() => {
                        processingMessage.then(sentMsg => {
                            bot.deleteMessage(chatId, sentMsg.message_id);
                        });
                    });
            } else {
                bot.sendMessage(chatId, 'Gagal mengambil informasi gempa.');
            }
        })
        .catch(error => {
            console.error(error);
            bot.sendMessage(chatId, 'Terjadi kesalahan saat memproses permintaan Anda.');
        });
});

// Delete messages containing links in groups
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
        if (msg.text && msg.text.match(/https?:\/\/\S+/)) {
            bot.deleteMessage(chatId, msg.message_id).catch(err => {
                console.error('Failed to delete message:', err);
            });
        }
    }
});

// IG command
bot.onText(/\/ig (.*)/, (msg, match) => {
    const chatId = msg.chat.id;
    const url = match[1].trim();
    if (!url) {
        bot.sendMessage(chatId, 'Silahkan kirimkan /ig [ url ]');
    } else {
        const processingMessage = bot.sendMessage(chatId, 'Processing...');
        axios.get(`https://api.ngodingaja.my.id/api/ig?url=${url}`)
            .then(response => {
                const data = response.data;
                if (data.status) {
                    const thumbnailLink = data.hasil.thumbnail_link;
                    const downloadLink = data.hasil.download_link;
                    const botUsername = bot.getMe().then(botInfo => botInfo.username);
                    botUsername.then(botName => {
                        const caption = `**Thumbnail Link**: ${thumbnailLink}\n**Download Link**: ${downloadLink}`;
                        bot.sendVideo(chatId, downloadLink, { caption, parse_mode: 'Markdown' })
                            .then(() => {
                                processingMessage.then(sentMsg => {
                                    bot.deleteMessage(chatId, sentMsg.message_id);
                                });
                            });
                    });
                } else {
                    bot.sendMessage(chatId, 'Gagal mengambil informasi dari URL tersebut.');
                }
            })
            .catch(error => {
                console.error(error);
                bot.sendMessage(chatId, 'Terjadi kesalahan saat memproses permintaan Anda.');
            });
    }
});

// Waifu command
bot.onText(/\/waifu/, (msg) => {
    const chatId = msg.chat.id;
    const processingMessage = bot.sendMessage(chatId, 'Processing...');
    axios.get('https://api.ngodingaja.my.id/api/waifurandom')
        .then(response => {
            const data = response.data;
            if (data.status) {
                const imageUrl = data.hasil;
                bot.sendPhoto(chatId, imageUrl, { caption: 'Pesan berhasil!', parse_mode: 'Markdown' })
                    .then(() => {
                        processingMessage.then(sentMsg => {
                            bot.deleteMessage(chatId, sentMsg.message_id);
                        });
                    });
            } else {
                bot.sendMessage(chatId, 'Gagal mengambil informasi waifu.');
            }
        })
        .catch(error => {
            console.error(error);
            bot.sendMessage(chatId, 'Terjadi kesalahan saat memproses permintaan Anda.');
        });
});

// Google command
bot.onText(/\/google (.*)/, (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1].trim();
    if (!text) {
        bot.sendMessage(chatId, 'Silahkan kirimkan /google [ text ]');
    } else {
        const processingMessage = bot.sendMessage(chatId, 'Processing...');
        axios.get(`https://api.ngodingaja.my.id/api/gsearch?search=${text}`)
            .then(response => {
                const data = response.data;
                if (data.status) {
                    const result = data.result;
                    let message = '';
                    result.forEach(item => {
                        message += `**Title**: ${item.title}\n**Link**: ${item.link}\n**Snippet**: ${item.snippet}\n\n`;
                    });
                    bot.sendMessage(chatId, message);
                } else {
                    bot.sendMessage(chatId, 'Gagal mengambil informasi dari teks tersebut.');
                }
            })
            .catch(error => {
                console.error(error);
                bot.sendMessage(chatId, 'Terjadi kesalahan saat memproses permintaan Anda.');
            });
    }
});

// Premium user management
bot.onText(/\/premium (.*)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const days = parseInt(match[1]);
    if (!days) {
        bot.sendMessage(chatId, 'Silahkan kirimkan /premium [ id ] [ brp days ]');
    } else {
        if (!premiumUsers[userId]) {
            premiumUsers[userId] = { status: true, expires: Date.now() + days * 24 * 60 * 60 * 1000 };
            bot.sendMessage(chatId, 'Pengguna premium berhasil diatur!');
        } else {
            bot.sendMessage(chatId, 'Pengguna premium sudah ada!');
        }
    }
});

// Ban command
bot.onText(/\/ban (\d+) (\d+)/, (msg, match) => {
    const chatId = '7065487918';
    const userId = parseInt(match[1]);
    const duration = parseInt(match[2]);
    if (userId && duration) {
        if (msg.from.id === 7065487918) { // Replace with your admin ID
            bot.banChatMember(chatId, userId, { until_date: Date.now() + duration * 60 * 1000 });
            bot.sendMessage(chatId, `User dengan ID ${userId} berhasil dibanned selama ${duration} menit.`);
        } else {
            bot.sendMessage(chatId, 'Anda tidak memiliki izin untuk menggunakan perintah ini.');
        }
    } else {
        bot.sendMessage(chatId, 'Format perintah salah. Silahkan kirimkan /ban (id) (durasi hukuman)');
    }
});

// Unban command
bot.onText(/\/unban (\d+)/, (msg, match) => {
    const chatId = '7065487918';
    const userId = parseInt(match[1]);
    if (userId) {
        if (msg.from.id === 7065487918) { // Replace with your admin ID
            bot.unbanChatMember(chatId, userId);
            bot.sendMessage(chatId, `User dengan ID ${userId} berhasil diunban.`);
        } else {
            bot.sendMessage(chatId, 'Anda tidak memiliki izin untuk menggunakan perintah ini.');
        }
    } else {
        bot.sendMessage(chatId, 'Format perintah salah. Silahkan kirimkan /unban (id)');
    }
});

// Total user command
bot.onText(/\/totaluser/, (msg) => {
    const chatId = msg.chat.id;
    const totalUsers = userIds.length;
    bot.sendMessage(chatId, `Total pengguna: ${totalUsers}`);
});

// Broadcast command
bot.onText(/\/bc (.+)/, (msg, match) => {
    const chatId = '7065487918';
    const text = match[1];
    userIds.forEach(userId => {
        bot.sendMessage(userId, text).catch(err => {
            console.error(`Failed to send message to ${userId}:`, err);
        });
    });
});

// Tag online users
bot.onText(/\/tagonline/, (msg) => {
    const chatId = msg.chat.id;
    const onlineUsers = msg.chat.members.filter(member => member.status === 'online');
    let message = '';
    onlineUsers.forEach(user => {
        message += `@${user.username}\n`;
    });
    bot.sendMessage(chatId, message);
});

// Tag all users
bot.onText(/\/tagall/, (msg) => {
    const chatId = msg.chat.id;
    const allUsers = msg.chat.members;
    let message = '';
    allUsers.forEach(user => {
        message += `@${user.username}\n`;
    });
    bot.sendMessage(chatId, message);
});
