const TelegramBot = require('node-telegram-bot-api');
const { exec } = require('child_process');

// Ganti dengan token bot Anda
const token = '6490497404:AAG2MruatZmo6Wa_zKPHLBpX9JdzQ2gEXBA';
const bot = new TelegramBot(token, { polling: true });

// Mendukung inline query
bot.on('inline_query', (query) => {
    const results = [];
    const command = query.query;

    if (command) {
        exec(command, (error, stdout, stderr) => {
            const response = error ? stderr || error.message : stdout;
            const formattedResponse = `\`\`\`\n🖥️ Request: ${command}\n\n✅ Response:\n${response}\n\`\`\``;

            results.push({
                type: 'article',
                id: query.id,
                title: '✅ Execute Command',
                input_message_content: {
                    message_text: formattedResponse,
                    parse_mode: 'MarkdownV2',
                },
            });

            bot.answerInlineQuery(query.id, results);
        });
    } else {
        bot.answerInlineQuery(query.id, []);
    }
});

// Menangani pesan biasa
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const command = msg.text;

    exec(command, (error, stdout, stderr) => {
        const response = error ? stderr || error.message : stdout;
        const formattedResponse = `\`\`\`\n🖥️ Request: ${command}\n\n✅ Response:\n${response}\n\`\`\``;

        bot.sendMessage(chatId, formattedResponse, { parse_mode: 'MarkdownV2' });
    });
});
