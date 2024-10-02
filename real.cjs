const { Telegraf } = require('telegraf');

// Inisialisasi bot dengan token
const bot = new Telegraf('7193213688:AAHtAJguLNpcJPfEPuyTZXMcLc2MZekrQ_Q');

// Fungsi untuk mendapatkan waktu saat ini dari berbagai zona waktu
const getTimeZones = () => {
    const now = new Date();

    // Format waktu ke beberapa zona waktu (WIB, WITA, WIT, dan 30 negara lainnya)
    const timeWIB = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const timeWITA = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
    const timeWIT = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jayapura" }));
    const timeNewYork = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const timeLondon = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
    const timeTokyo = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const timeSydney = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
    const timeDubai = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dubai" }));
    const timeParis = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
    const timeBerlin = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
    const timeMoscow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
    const timeBeijing = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
    const timeSeoul = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const timeBangkok = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const timeDubaiUAE = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dubai" }));
    const timeCairo = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
    const timeMexicoCity = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
    const timeBuenosAires = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const timeToronto = new Date(now.toLocaleString("en-US", { timeZone: "America/Toronto" }));
    const timeIstanbul = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
    const timeMumbai = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const timeCapeTown = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }));
    const timeLagos = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
    const timeSaoPaulo = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const timeLosAngeles = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const timeVancouver = new Date(now.toLocaleString("en-US", { timeZone: "America/Vancouver" }));
    const timeMoscowRussia = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
    const timeAnkara = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
    const timeLima = new Date(now.toLocaleString("en-US", { timeZone: "America/Lima" }));

    // Fungsi format waktu ke HH:MM:SS
    const formatTime = (time) => time.toTimeString().split(' ')[0];

    return `\`\`\`Time Now\n\n` +
        `🇮🇩 Indonesia:\n` +
        `    WIB   : ${formatTime(timeWIB)}\n` +
        `    WITA  : ${formatTime(timeWITA)}\n` +
        `    WIT   : ${formatTime(timeWIT)}\n\n` +
        `🌍 Negara Lainnya:\n` +
        `🇺🇸 New York   : ${formatTime(timeNewYork)}\n` +
        `🇬🇧 London     : ${formatTime(timeLondon)}\n` +
        `🇯🇵 Tokyo      : ${formatTime(timeTokyo)}\n` +
        `🇦🇺 Sydney     : ${formatTime(timeSydney)}\n` +
        `🇦🇪 Dubai      : ${formatTime(timeDubai)}\n` +
        `🇫🇷 Paris      : ${formatTime(timeParis)}\n` +
        `🇩🇪 Berlin     : ${formatTime(timeBerlin)}\n` +
        `🇷🇺 Moscow     : ${formatTime(timeMoscow)}\n` +
        `🇨🇳 Beijing    : ${formatTime(timeBeijing)}\n` +
        `🇰🇷 Seoul      : ${formatTime(timeSeoul)}\n` +
        `🇹🇭 Bangkok    : ${formatTime(timeBangkok)}\n` +
        `🇦🇪 Dubai (UAE): ${formatTime(timeDubaiUAE)}\n` +
        `🇪🇬 Cairo      : ${formatTime(timeCairo)}\n` +
        `🇲🇽 Mexico City: ${formatTime(timeMexicoCity)}\n` +
        `🇦🇷 Buenos Aires: ${formatTime(timeBuenosAires)}\n` +
        `🇨🇦 Toronto    : ${formatTime(timeToronto)}\n` +
        `🇹🇷 Istanbul   : ${formatTime(timeIstanbul)}\n` +
        `🇮🇳 Mumbai     : ${formatTime(timeMumbai)}\n` +
        `🇿🇦 Cape Town  : ${formatTime(timeCapeTown)}\n` +
        `🇳🇬 Lagos      : ${formatTime(timeLagos)}\n` +
        `🇧🇷 Sao Paulo  : ${formatTime(timeSaoPaulo)}\n` +
        `🇺🇸 Los Angeles: ${formatTime(timeLosAngeles)}\n` +
        `🇨🇦 Vancouver  : ${formatTime(timeVancouver)}\n` +
        `🇷🇺 Moscow (RU): ${formatTime(timeMoscowRussia)}\n` +
        `🇹🇷 Ankara     : ${formatTime(timeAnkara)}\n` +
        `🇵🇪 Lima       : ${formatTime(timeLima)}\n\n` +
        `\`\`\`\n[Time.is](https://time.is)`;
};

// Fungsi untuk mengupdate pesan real-time di channel
const updateMessage = async (chatId, messageId) => {
    try {
        const newMessage = getTimeZones();
        await bot.telegram.editMessageText(chatId, messageId, null, newMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Developer', url: 'https://t.me/hiyaok' }]
                ]
            }
        });
    } catch (err) {
        console.error('Gagal memperbarui pesan:', err);
    }
};

// Ketika user mengirim /start
bot.start(async (ctx) => {
    const chatId = '@realtimecountry'; // Ganti dengan channel atau grup yang Anda gunakan
    const initialMessage = getTimeZones();
    
    // Mengirim pesan awal ke channel
    const sentMessage = await bot.telegram.sendMessage(chatId, initialMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Developer', url: 'https://t.me/hiyaok' }]
            ]
        }
    });

    // Update pesan setiap detik
    setInterval(() => {
        updateMessage(chatId, sentMessage.message_id);
    }, 100); // Update setiap detik (1000 ms)
    
    // Kirim konfirmasi ke user bahwa pesan waktu telah dikirim ke channel
    await ctx.reply('Waktu real-time telah dikirim ke channel @testpesan dan akan terus diperbarui setiap detik.');
});

// Jalankan bot
bot.launch();

