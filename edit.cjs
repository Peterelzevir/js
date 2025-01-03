const { Telegraf } = require('telegraf');
const sharp = require('sharp');
const tesseract = require('tesseract.js');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf('7745228249:AAH_USMrZGLHswRVWcDq71X_OB7F68cvAvU');

// Fungsi untuk menganalisis font dari gambar
async function analyzeFontProperties(ctx, x0, y0, width, height) {
    const imageData = ctx.getImageData(x0, y0, width, height);
    const { data } = imageData;
    
    // Analisis warna dominan teks
    let colors = {};
    for (let i = 0; i < data.length; i += 4) {
        const color = `${data[i]},${data[i + 1]},${data[i + 2]}`;
        colors[color] = (colors[color] || 0) + 1;
    }
    
    // Ambil warna yang paling dominan
    const dominantColor = Object.entries(colors)
        .sort((a, b) => b[1] - a[1])[0][0]
        .split(',')
        .map(Number);
    
    return {
        color: `rgb(${dominantColor.join(',')})`,
        fontSize: Math.round(height * 0.7), // Estimasi ukuran font dari tinggi area
        baseline: y0 + (height * 0.7) // Estimasi baseline
    };
}

// Fungsi deteksi teks dengan OCR yang lebih presisi
async function detectGroupText(imagePath) {
    const { data: { words } } = await tesseract.recognize(imagePath, 'eng+ind', {
        tessedit_char_whitelist: 'Grup·0123456789 anggota',
        tessedit_pageseg_mode: '7' // Treat image as single text line
    });

    // Cari kata yang mengandung pola "Grup · X anggota"
    const groupTextPattern = words.find(word => 
        word.text.match(/(Grup|Group)\s*·\s*\d+\s*anggota/i)
    );

    if (!groupTextPattern) {
        throw new Error('Teks grup tidak ditemukan');
    }

    return {
        text: groupTextPattern.text,
        bbox: groupTextPattern.bbox,
        confidence: groupTextPattern.confidence
    };
}

// Fungsi edit gambar yang dioptimalkan
async function editImage(imagePath, newCount) {
    const image = await sharp(imagePath);
    const metadata = await image.metadata();
    
    // Buat canvas dengan resolusi yang sama
    const canvas = createCanvas(metadata.width, metadata.height);
    const ctx = canvas.getContext('2d');
    
    // Load dan gambar image asli
    const originalImage = await loadImage(imagePath);
    ctx.drawImage(originalImage, 0, 0);
    
    // Deteksi teks grup
    const groupText = await detectGroupText(imagePath);
    const { bbox } = groupText;
    
    // Analisis properti font
    const fontProps = await analyzeFontProperties(
        ctx, 
        bbox.x0, 
        bbox.y0, 
        bbox.x1 - bbox.x0, 
        bbox.y1 - bbox.y0
    );
    
    // Bersihkan area teks
    ctx.fillStyle = '#FFFFFF'; // atau warna background yang sesuai
    ctx.fillRect(bbox.x0, bbox.y0, bbox.x1 - bbox.x0, bbox.y1 - bbox.y0);
    
    // Siapkan font dan teks baru
    ctx.font = `${fontProps.fontSize}px -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = fontProps.color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    
    // Tulis teks baru
    const newText = `Grup · ${newCount} anggota`;
    ctx.fillText(newText, bbox.x0, fontProps.baseline);
    
    // Simpan hasil
    const outputPath = path.resolve(__dirname, `edited_${Date.now()}.jpg`);
    const buffer = canvas.toBuffer('image/jpeg', { 
        quality: 1,
        chromaSubsampling: false
    });
    
    // Optimize hasil akhir dengan sharp
    await sharp(buffer)
        .jpeg({ 
            quality: 100,
            chromaSubsampling: '4:4:4'
        })
        .toFile(outputPath);
    
    return outputPath;
}

// Handler untuk menerima foto
bot.on('photo', async (ctx) => {
    try {
        const photo = ctx.message.photo.pop();
        const file = await ctx.telegram.getFile(photo.file_id);
        const fileName = `${ctx.from.id}_${Date.now()}.jpg`;
        const imagePath = path.resolve(__dirname, fileName);
        
        // Download gambar
        const response = await fetch(`https://api.telegram.org/file/bot${bot.token}/${file.file_path}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(imagePath, buffer);
        
        // Deteksi teks grup
        const groupText = await detectGroupText(imagePath);
        const currentCount = groupText.text.match(/\d+/)[0];
        
        await ctx.reply(`Terdeteksi: ${currentCount} anggota\nMasukkan jumlah anggota baru:`);
        
        ctx.session = { 
            imagePath,
            originalCount: currentCount
        };
    } catch (error) {
        console.error('Error:', error);
        await ctx.reply('Gagal memproses gambar. Pastikan gambar berisi teks grup yang valid.');
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
        console.error('Error:', error);
        await ctx.reply('Gagal mengedit gambar.');
    }
});

bot.launch();
console.log('Bot berjalan...');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
