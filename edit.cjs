const { Telegraf } = require('telegraf');
const tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf('7745228249:AAH_USMrZGLHswRVWcDq71X_OB7F68cvAvU');

let userSession = {};

bot.on('photo', async (ctx) => {
    const photo = ctx.message.photo.pop(); // Resolusi tertinggi
    const fileId = photo.file_id;

    const fileLink = await ctx.telegram.getFileLink(fileId);
    const fileName = `${ctx.from.id}_${Date.now()}.jpg`;

    // Unduh gambar
    const imagePath = path.resolve(__dirname, fileName);
    const response = await fetch(fileLink.href);
    const buffer = await response.buffer();
    fs.writeFileSync(imagePath, buffer);

    // Gunakan OCR untuk mendeteksi teks
    const ocrResult = await tesseract.recognize(imagePath, 'eng');
    const detectedText = ocrResult.data.text;

    // Cari angka dalam teks yang terdeteksi
    const numbers = detectedText.match(/\d+/g);

    if (numbers && numbers.length > 0) {
        userSession[ctx.from.id] = { imagePath, detectedNumbers: numbers };
        ctx.reply(
            `Jumlah anggota terdeteksi: ${numbers.join(', ')}. Masukkan jumlah anggota baru:`
        );
    } else {
        ctx.reply('Tidak dapat mendeteksi jumlah anggota. Kirim gambar lain.');
        fs.unlinkSync(imagePath);
    }
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;

    if (userSession[userId] && userSession[userId].imagePath) {
        const newCount = ctx.message.text;

        if (isNaN(newCount)) {
            return ctx.reply('Jumlah anggota harus berupa angka.');
        }

        const { imagePath } = userSession[userId];

        // Ganti angka dalam gambar
        try {
            const editedImagePath = path.resolve(__dirname, `edited_${userId}.jpg`);

            // Hapus angka lama dengan kotak kosong
            const svgOverlay = `
                <svg width="500" height="100">
                    <rect x="50" y="20" width="200" height="60" fill="white" />
                    <text x="60" y="60" font-size="40" fill="black">${newCount}</text>
                </svg>
            `;

            await sharp(imagePath)
                .composite([
                    {
                        input: Buffer.from(svgOverlay),
                        top: 100, // Sesuaikan posisi
                        left: 100,
                    },
                ])
                .toFile(editedImagePath);

            ctx.replyWithPhoto({ source: editedImagePath });
        } catch (err) {
            console.error(err);
            ctx.reply('Terjadi kesalahan saat mengedit gambar.');
        } finally {
            // Bersihkan file sementara
            fs.unlinkSync(imagePath);
            delete userSession[userId];
        }
    } else {
        ctx.reply('Kirimkan gambar terlebih dahulu.');
    }
});

bot.launch();
console.log('Bot berjalan...');
