const { Telegraf } = require('telegraf');
const sharp = require('sharp');
const tesseract = require('tesseract.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// Registrasi font Roboto
registerFont(require.resolve('@fontsource/roboto/files/roboto-latin-400-normal.woff2'), { family: 'Roboto' });

const bot = new Telegraf('7745228249:AAH_USMrZGLHswRVWcDq71X_OB7F68cvAvU');

// Fungsi deteksi teks dengan OCR
async function detectText(imagePath) {
    const ocrResult = await tesseract.recognize(imagePath, 'eng');
    return ocrResult.data;
}

// Fungsi edit gambar
async function editImage(imagePath, textToReplace, newText) {
    const originalImage = await loadImage(imagePath);
    const canvas = createCanvas(originalImage.width, originalImage.height);
    const ctx = canvas.getContext('2d');

    // Gambar ulang gambar asli
    ctx.drawImage(originalImage, 0, 0);

    // Deteksi teks dan tentukan posisi untuk mengganti teks
    const detected = await detectText(imagePath);
    const lines = detected.lines;
    let targetLine = null;

    for (const line of lines) {
        if (line.text.includes(textToReplace)) {
            targetLine = line;
            break;
        }
    }

    if (!targetLine) {
        throw new Error('Teks yang ingin diganti tidak ditemukan.');
    }

    // Ganti teks di posisi yang sesuai
    const { x0, y0, x1, y1 } = targetLine.bbox;
    const textWidth = x1 - x0;
    const textHeight = y1 - y0;

    // Hapus teks lama
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0, y0, textWidth, textHeight);

    // Tambahkan teks baru
    ctx.font = `${textHeight}px Roboto`;
    ctx.fillStyle = '#000000';
    ctx.fillText(newText, x0, y1 - 5);

    // Simpan gambar hasil edit
    const outputImagePath = path.resolve(__dirname, `edited_${Date.now()}.jpg`);
    const buffer = canvas.toBuffer('image/jpeg');
    fs.writeFileSync(outputImagePath, buffer);

    return outputImagePath;
}

// Bot menerima gambar
bot.on('photo', async (ctx) => {
    try {
        const photo = ctx.message.photo.pop(); // Resolusi tertinggi
        const fileId = photo.file_id;
        const fileLink = await ctx.telegram.getFileLink(fileId);
        const fileName = `${ctx.from.id}_${Date.now()}.jpg`;

        // Unduh gambar
        const imagePath = path.resolve(__dirname, fileName);
        const response = await fetch(fileLink.href);
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(imagePath, buffer);

        // Deteksi teks "Grup · x anggota"
        const detectedText = await detectText(imagePath);
        const match = detectedText.text.match(/(Grup|Group)\s·\s(\d+)\sanggota/);

        if (!match) {
            return ctx.reply('Tidak dapat mendeteksi teks "Grup · x anggota". Pastikan gambar sesuai format.');
        }

        const oldText = match[0];
        const currentCount = match[2];
        ctx.reply(`Jumlah anggota terdeteksi: ${currentCount}. Masukkan jumlah anggota baru:`);

        // Simpan sesi
        ctx.session = { imagePath, oldText };
    } catch (err) {
        console.error(err);
        ctx.reply('Terjadi kesalahan saat memproses gambar.');
    }
});

// Bot menerima jumlah anggota baru
bot.on('text', async (ctx) => {
    const newCount = ctx.message.text;

    if (isNaN(newCount)) {
        return ctx.reply('Jumlah anggota harus berupa angka.');
    }

    const { imagePath, oldText } = ctx.session;

    try {
        const editedImagePath = await editImage(imagePath, oldText, `Grup · ${newCount} anggota`);
        await ctx.replyWithPhoto({ source: editedImagePath });

        // Bersihkan file sementara
        fs.unlinkSync(imagePath);
        fs.unlinkSync(editedImagePath);
    } catch (err) {
        console.error(err);
        ctx.reply('Terjadi kesalahan saat mengedit gambar.');
    }
});

bot.launch();
console.log('Bot berjalan...');
