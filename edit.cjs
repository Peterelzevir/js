const { Telegraf } = require('telegraf');
const sharp = require('sharp');
const tesseract = require('tesseract.js');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf('7745228249:AAH_USMrZGLHswRVWcDq71X_OB7F68cvAvU');

// Fungsi deteksi teks dengan OCR yang lebih robust
async function detectGroupText(imagePath) {
    try {
        console.log('Memulai OCR pada gambar:', imagePath);
        
        // Preprocessing gambar untuk meningkatkan akurasi OCR
        const preprocessedPath = `${imagePath}_prep.jpg`;
        await sharp(imagePath)
            .resize(1500, null, { // Resize untuk konsistensi
                withoutEnlargement: true
            })
            .modulate({
                brightness: 1.2,
                contrast: 1.2
            })
            .sharpen()
            .toFile(preprocessedPath);

        // Jalankan OCR dengan konfigurasi yang dioptimalkan
        const { data } = await tesseract.recognize(
            preprocessedPath,
            'eng+ind',
            {
                tessedit_char_whitelist: 'Grup·0123456789 anggota',
                tessedit_pageseg_mode: '6',
                preserve_interword_spaces: '1'
            }
        );

        console.log('Hasil OCR mentah:', data.text);

        // Hapus file preprocessing
        fs.unlinkSync(preprocessedPath);

        // Cari pola teks grup dengan regex yang lebih fleksibel
        const groupTextMatch = data.text.match(/(Grup|Group|GRUP|GROUP)\s*[·.]\s*(\d+)\s*(anggota|member|ANGGOTA|MEMBER)/i);

        if (!groupTextMatch) {
            console.log('Pola teks grup tidak ditemukan dalam:', data.text);
            throw new Error('Teks grup tidak ditemukan');
        }

        // Dapatkan bounding box dari teks yang cocok
        const matchedText = groupTextMatch[0];
        const words = data.words || [];
        let bbox = null;

        for (const word of words) {
            if (word.text.includes(matchedText) || matchedText.includes(word.text)) {
                bbox = word.bbox;
                break;
            }
        }

        if (!bbox) {
            console.log('Bounding box tidak ditemukan untuk teks:', matchedText);
            // Gunakan estimasi bbox jika tidak ditemukan
            bbox = {
                x0: 0,
                y0: 0,
                x1: data.width,
                y1: data.height
            };
        }

        return {
            text: matchedText,
            bbox: bbox,
            confidence: data.confidence
        };

    } catch (error) {
        console.error('Error dalam detectGroupText:', error);
        throw error;
    }
}

// Fungsi edit gambar yang lebih toleran
async function editImage(imagePath, newCount) {
    try {
        console.log('Memulai edit gambar:', imagePath);
        
        const image = await sharp(imagePath);
        const metadata = await image.metadata();
        
        const canvas = createCanvas(metadata.width, metadata.height);
        const ctx = canvas.getContext('2d');
        
        const originalImage = await loadImage(imagePath);
        ctx.drawImage(originalImage, 0, 0);
        
        // Deteksi teks grup
        const groupText = await detectGroupText(imagePath);
        console.log('Teks grup terdeteksi:', groupText);
        
        // Gunakan posisi default jika bbox tidak valid
        const bbox = groupText.bbox || {
            x0: Math.floor(metadata.width * 0.3),
            y0: Math.floor(metadata.height * 0.3),
            x1: Math.floor(metadata.width * 0.7),
            y1: Math.floor(metadata.height * 0.4)
        };
        
        // Bersihkan area teks
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(bbox.x0, bbox.y0, bbox.x1 - bbox.x0, bbox.y1 - bbox.y0);
        
        // Set font style
        const fontSize = Math.floor((bbox.y1 - bbox.y0) * 0.8);
        ctx.font = `${fontSize}px -apple-system, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = '#202124'; // Warna default
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        
        // Tulis teks baru
        const newText = `Grup · ${newCount} anggota`;
        const textY = bbox.y0 + (bbox.y1 - bbox.y0) / 2;
        ctx.fillText(newText, bbox.x0, textY);
        
        // Simpan hasil
        const outputPath = path.resolve(__dirname, `edited_${Date.now()}.jpg`);
        const buffer = canvas.toBuffer('image/jpeg', { quality: 1 });
        
        await sharp(buffer)
            .jpeg({ 
                quality: 100,
                chromaSubsampling: '4:4:4'
            })
            .toFile(outputPath);
        
        console.log('Berhasil menyimpan gambar hasil edit:', outputPath);
        return outputPath;
        
    } catch (error) {
        console.error('Error dalam editImage:', error);
        throw error;
    }
}

// Handler untuk menerima foto
bot.on('photo', async (ctx) => {
    try {
        console.log('Menerima foto baru');
        
        const photo = ctx.message.photo.pop();
        const file = await ctx.telegram.getFile(photo.file_id);
        const fileName = `${ctx.from.id}_${Date.now()}.jpg`;
        const imagePath = path.resolve(__dirname, fileName);
        
        // Download gambar
        const response = await fetch(`https://api.telegram.org/file/bot${bot.token}/${file.file_path}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(imagePath, buffer);
        
        console.log('Berhasil menyimpan gambar:', imagePath);
        
        // Deteksi teks grup
        const groupText = await detectGroupText(imagePath);
        const currentCount = groupText.text.match(/\d+/)[0];
        
        await ctx.reply(`Terdeteksi: ${currentCount} anggota\nMasukkan jumlah anggota baru:`);
        
        ctx.session = { 
            imagePath,
            originalCount: currentCount
        };
    } catch (error) {
        console.error('Error dalam handler foto:', error);
        await ctx.reply('Gagal memproses gambar. Pastikan gambar berisi teks grup yang valid dan coba lagi.');
    }
});

// Handler untuk menerima jumlah anggota baru
bot.on('text', async (ctx) => {
    if (!ctx.session?.imagePath) {
        return ctx.reply('Silakan kirim screenshot grup terlebih dahulu.');
    }

    const newCount = ctx.message.text;
    if (!/^\d+$/.test(newCount)) {
        return ctx.reply('Masukkan angka yang valid.');
    }

    try {
        const editedPath = await editImage(ctx.session.imagePath, newCount);
        await ctx.replyWithPhoto({ source: editedPath });
        
        // Cleanup
        fs.unlinkSync(ctx.session.imagePath);
        fs.unlinkSync(editedPath);
        delete ctx.session;
    } catch (error) {
        console.error('Error dalam handler text:', error);
        await ctx.reply('Gagal mengedit gambar. Silakan coba lagi.');
    }
});

bot.launch();
console.log('Bot berjalan...');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
