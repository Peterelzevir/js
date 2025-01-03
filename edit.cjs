const { Telegraf, Markup } = require('telegraf');
const sharp = require('sharp');
const tesseract = require('tesseract.js');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf('7745228249:AAH_USMrZGLHswRVWcDq71X_OB7F68cvAvU');

// Improved image preprocessing
async function preprocessImage(imagePath) {
    const preprocessedPath = `${imagePath}_prep.jpg`;
    await sharp(imagePath)
        .resize(2000, null, {
            withoutEnlargement: true,
            kernel: sharp.kernel.lanczos3
        })
        .modulate({
            brightness: 1.2,
            contrast: 1.3
        })
        .sharpen({
            sigma: 1.5,
            m1: 1.5,
            m2: 0.7
        })
        .toFormat('jpeg', {
            quality: 100,
            chromaSubsampling: '4:4:4'
        })
        .toFile(preprocessedPath);
    return preprocessedPath;
}

// Enhanced text detection
async function detectGroupText(imagePath) {
    try {
        console.log('Memulai OCR pada gambar:', imagePath);
        
        const preprocessedPath = await preprocessImage(imagePath);
        
        const { data } = await tesseract.recognize(
            preprocessedPath,
            'eng+ind',
            {
                tessedit_char_whitelist: 'Grup·:. 0123456789anggotmberMBER',
                tessedit_pageseg_mode: '6',
                preserve_interword_spaces: '1',
                tessedit_ocr_engine_mode: '3' // Using Legacy + LSTM mode for better accuracy
            }
        );

        console.log('Hasil OCR mentah:', data.text);
        fs.unlinkSync(preprocessedPath);

        const patterns = [
            /(Grup|Group|GRUP|GROUP)\s*[·:. ]\s*(\d+)\s*(anggota|member|ANGGOTA|MEMBER)/i,
            /(\d+)\s*(anggota|member|ANGGOTA|MEMBER)/i,
            /(Grup|Group|GRUP|GROUP)\s*[·:. ]\s*(\d+)/i
        ];

        let groupTextMatch = null;
        for (const pattern of patterns) {
            const match = data.text.match(pattern);
            if (match) {
                groupTextMatch = match;
                console.log('Pattern matched:', match[0]);
                break;
            }
        }

        if (!groupTextMatch) {
            throw new Error('Teks grup tidak ditemukan');
        }

        let bbox = null;
        const memberCount = groupTextMatch[0].match(/\d+/)[0];
        const words = data.words || [];

        // Improved bbox detection
        for (const word of words) {
            if (word.text.includes(memberCount)) {
                bbox = {
                    x0: Math.max(0, word.bbox.x0 - 80), // Increased padding
                    y0: Math.max(0, word.bbox.y0 - 5),  // Added vertical padding
                    x1: Math.min(data.width, word.bbox.x1 + 120),
                    y1: Math.min(data.height, word.bbox.y1 + 5)
                };
                break;
            }
        }

        if (!bbox) {
            bbox = {
                x0: Math.floor(data.width * 0.3),
                y0: Math.floor(data.height * 0.3),
                x1: Math.floor(data.width * 0.7),
                y1: Math.floor(data.height * 0.4)
            };
        }

        return {
            text: groupTextMatch[0],
            memberCount,
            bbox,
            confidence: data.confidence
        };

    } catch (error) {
        console.error('Error dalam detectGroupText:', error);
        throw error;
    }
}

// Enhanced image editing
async function editImage(imagePath, newCount) {
    try {
        const image = await sharp(imagePath);
        const metadata = await image.metadata();
        
        const canvas = createCanvas(metadata.width, metadata.height);
        const ctx = canvas.getContext('2d');
        
        const originalImage = await loadImage(imagePath);
        ctx.drawImage(originalImage, 0, 0);
        
        const groupText = await detectGroupText(imagePath);
        console.log('Detected group text:', groupText);
        
        const { bbox } = groupText;
        
        // Enhanced background matching
        const imageData = ctx.getImageData(bbox.x0, bbox.y0, bbox.x1 - bbox.x0, bbox.y1 - bbox.y0);
        const backgroundColor = getAverageColor(imageData);
        
        // Clear text area with matched background color
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(bbox.x0, bbox.y0, bbox.x1 - bbox.x0, bbox.y1 - bbox.y0);
        
        // Enhanced text rendering
        const fontSize = Math.floor((bbox.y1 - bbox.y0) * 0.8);
        ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
        ctx.fillStyle = '#202124';
        ctx.textBaseline = 'middle';
        
        // Add text with anti-aliasing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        const newText = `Grup · ${newCount} anggota`;
        const textY = bbox.y0 + (bbox.y1 - bbox.y0) / 2;
        ctx.fillText(newText, bbox.x0, textY);
        
        // Save with enhanced quality
        const outputPath = path.resolve(__dirname, `edited_${Date.now()}.jpg`);
        const buffer = canvas.toBuffer('image/jpeg', { quality: 1 });
        
        await sharp(buffer)
            .jpeg({ 
                quality: 100,
                chromaSubsampling: '4:4:4'
            })
            .toFile(outputPath);
        
        return outputPath;
        
    } catch (error) {
        console.error('Error dalam editImage:', error);
        throw error;
    }
}

// Helper function untuk mendapatkan warna background
function getAverageColor(imageData) {
    let r = 0, g = 0, b = 0;
    const pixels = imageData.data.length / 4;
    
    for (let i = 0; i < imageData.data.length; i += 4) {
        r += imageData.data[i];
        g += imageData.data[i + 1];
        b += imageData.data[i + 2];
    }
    
    r = Math.round(r / pixels);
    g = Math.round(g / pixels);
    b = Math.round(b / pixels);
    
    return `rgb(${r}, ${g}, ${b})`;
}

// Handler foto dengan tombol cancel
bot.on('photo', async (ctx) => {
    try {
        console.log('Menerima foto baru');
        
        const photo = ctx.message.photo.pop();
        const file = await ctx.telegram.getFile(photo.file_id);
        const fileName = `${ctx.from.id}_${Date.now()}.jpg`;
        const imagePath = path.resolve(__dirname, fileName);
        
        const response = await fetch(`https://api.telegram.org/file/bot${bot.token}/${file.file_path}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(imagePath, buffer);
        
        console.log('Gambar tersimpan:', imagePath);
        
        const groupText = await detectGroupText(imagePath);
        
        ctx.session = { 
            imagePath,
            waitingForCount: true,
            lastMessageTime: Date.now()
        };
        
        // Menambahkan tombol cancel
        await ctx.reply(
            `✅ Terdeteksi: ${groupText.memberCount} anggota\n` +
            `📝 Silakan kirim jumlah anggota baru:`,
            Markup.inlineKeyboard([
                Markup.button.callback('❌ Cancel', 'cancel_edit')
            ])
        );
        
    } catch (error) {
        console.error('Error handler foto:', error);
        await ctx.reply('❌ Gagal memproses gambar. Pastikan screenshot mengandung teks "Grup · X anggota"');
    }
});

// Handler untuk tombol cancel
bot.action('cancel_edit', async (ctx) => {
    try {
        if (ctx.session?.imagePath) {
            fs.unlinkSync(ctx.session.imagePath);
        }
        delete ctx.session;
        await ctx.editMessageText('❌ Proses dibatalkan. Silakan kirim screenshot baru.');
        await ctx.answerCbQuery('Proses dibatalkan');
    } catch (error) {
        console.error('Error handling cancel:', error);
        await ctx.answerCbQuery('Gagal membatalkan proses');
    }
});

// Handler text yang ditingkatkan
bot.on('text', async (ctx) => {
    try {
        if (!ctx.session?.imagePath || !ctx.session?.waitingForCount) {
            return ctx.reply('⚠️ Silakan kirim screenshot grup terlebih dahulu.');
        }

        const timeoutDuration = 5 * 60 * 1000;
        if (Date.now() - ctx.session.lastMessageTime > timeoutDuration) {
            if (ctx.session.imagePath && fs.existsSync(ctx.session.imagePath)) {
                fs.unlinkSync(ctx.session.imagePath);
            }
            delete ctx.session;
            return ctx.reply('⚠️ Sesi telah kedaluwarsa. Silakan kirim screenshot baru.');
        }

        const newCount = ctx.message.text;
        if (!/^\d+$/.test(newCount)) {
            return ctx.reply('⚠️ Mohon masukkan angka yang valid.');
        }

        const processingMsg = await ctx.reply('⏳ Sedang memproses...');
        const editedPath = await editImage(ctx.session.imagePath, newCount);
        await ctx.replyWithPhoto({ source: editedPath });
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
        
        // Cleanup
        fs.unlinkSync(ctx.session.imagePath);
        fs.unlinkSync(editedPath);
        delete ctx.session;
        
    } catch (error) {
        console.error('Error handler text:', error);
        await ctx.reply('❌ Gagal mengedit gambar. Silakan coba lagi.');
        
        if (ctx.session?.imagePath && fs.existsSync(ctx.session.imagePath)) {
            fs.unlinkSync(ctx.session.imagePath);
        }
        delete ctx.session;
    }
});

// Session middleware
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

// Error handler
bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply('❌ Terjadi kesalahan pada bot. Silakan coba lagi.');
});

bot.launch();
console.log('✅ Bot berjalan...');

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
