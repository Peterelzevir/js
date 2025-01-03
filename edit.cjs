const { Telegraf, Markup } = require('telegraf');
const sharp = require('sharp');
const tesseract = require('tesseract.js');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf('7745228249:AAH_USMrZGLHswRVWcDq71X_OB7F68cvAvU');

// Enhanced session handling
const sessions = new Map();

async function preprocessImage(imagePath) {
    const preprocessedPath = `${imagePath}_prep.jpg`;
    await sharp(imagePath)
        .resize(2000, null, {
            withoutEnlargement: true,
            kernel: sharp.kernel.lanczos3,
            fastShrinkOnLoad: false
        })
        .modulate({
            brightness: 1.1,
            contrast: 1.2
        })
        .sharpen({
            sigma: 2.0,
            m1: 2.0,
            m2: 0.5,
            x1: 6,
            y2: 20,
            y3: 40
        })
        .toFormat('jpeg', {
            quality: 100,
            chromaSubsampling: '4:4:4',
            force: true
        })
        .toFile(preprocessedPath);
    return preprocessedPath;
}

async function detectGroupText(imagePath) {
    try {
        console.log('Memulai OCR pada gambar:', imagePath);
        
        const preprocessedPath = await preprocessImage(imagePath);
        
        const { data } = await tesseract.recognize(
            preprocessedPath,
            'eng+ind',
            {
                tessedit_char_whitelist: 'Grup·:. 0123456789anggotmberMBERGOUP',
                tessedit_pageseg_mode: '6',
                preserve_interword_spaces: '1',
                tessedit_ocr_engine_mode: '3'
            }
        );

        console.log('Hasil OCR mentah:', data.text);
        fs.unlinkSync(preprocessedPath);

        const patterns = [
            /(Grup|Group|GRUP|GROUP)\s*[·:. ]\s*(\d{1,6})\s*(anggota|member|ANGGOTA|MEMBER)/i,
            /(\d{1,6})\s*(anggota|member|ANGGOTA|MEMBER)/i,
            /(Grup|Group|GRUP|GROUP)\s*[·:. ]\s*(\d{1,6})/i
        ];

        let groupTextMatch = null;
        let bestMatch = null;
        let highestConfidence = 0;

        for (const word of data.words || []) {
            for (const pattern of patterns) {
                const match = word.text.match(pattern);
                if (match && word.confidence > highestConfidence) {
                    highestConfidence = word.confidence;
                    bestMatch = match;
                    groupTextMatch = {
                        text: word.text,
                        bbox: word.bbox
                    };
                }
            }
        }

        if (!groupTextMatch) {
            throw new Error('Teks grup tidak ditemukan');
        }

        const memberCount = bestMatch[0].match(/\d+/)[0];
        
        let bbox = {
            x0: Math.max(0, groupTextMatch.bbox.x0 - 100),
            y0: Math.max(0, groupTextMatch.bbox.y0 - 8),
            x1: Math.min(data.width, groupTextMatch.bbox.x1 + 140),
            y1: Math.min(data.height, groupTextMatch.bbox.y1 + 8)
        };

        return {
            text: groupTextMatch.text,
            memberCount,
            bbox,
            confidence: highestConfidence,
            originalFont: await detectFontProperties(imagePath, bbox)
        };

    } catch (error) {
        console.error('Error dalam detectGroupText:', error);
        throw error;
    }
}

async function detectFontProperties(imagePath, bbox) {
    const image = await sharp(imagePath);
    const metadata = await image.metadata();
    const region = await image
        .extract({
            left: bbox.x0,
            top: bbox.y0,
            width: bbox.x1 - bbox.x0,
            height: bbox.y1 - bbox.y0
        })
        .toBuffer();

    const stats = await sharp(region).stats();
    const brightness = (stats.channels[0].mean + stats.channels[1].mean + stats.channels[2].mean) / 3;
    
    return {
        color: brightness > 127 ? '#FFFFFF' : '#202124',
        fontSize: Math.floor((bbox.y1 - bbox.y0) * 0.75)
    };
}

async function editImage(imagePath, newCount) {
    try {
        const image = await sharp(imagePath);
        const metadata = await image.metadata();
        
        const canvas = createCanvas(metadata.width, metadata.height);
        const ctx = canvas.getContext('2d');
        
        const originalImage = await loadImage(imagePath);
        ctx.drawImage(originalImage, 0, 0);
        
        const groupText = await detectGroupText(imagePath);
        const { bbox, originalFont } = groupText;
        
        // Enhanced background analysis and matching
        const regionBuffer = await sharp(imagePath)
            .extract({
                left: bbox.x0,
                top: bbox.y0,
                width: bbox.x1 - bbox.x0,
                height: bbox.y1 - bbox.y0
            })
            .toBuffer();

        const stats = await sharp(regionBuffer).stats();
        
        // Create gradient background
        const gradient = ctx.createLinearGradient(bbox.x0, bbox.y0, bbox.x1, bbox.y1);
        gradient.addColorStop(0, `rgba(${stats.channels[0].mean}, ${stats.channels[1].mean}, ${stats.channels[2].mean}, 1)`);
        gradient.addColorStop(1, `rgba(${stats.channels[0].mean}, ${stats.channels[1].mean}, ${stats.channels[2].mean}, 0.95)`);
        
        // Clear and fill background
        ctx.fillStyle = gradient;
        ctx.fillRect(bbox.x0, bbox.y0, bbox.x1 - bbox.x0, bbox.y1 - bbox.y0);
        
        // Enhanced text rendering
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Apply font settings
        const fontStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
        ctx.font = `${originalFont.fontSize}px ${fontStack}`;
        ctx.fillStyle = originalFont.color;
        
        // Add text with proper positioning
        const newText = `Grup · ${newCount} anggota`;
        const textY = bbox.y0 + (bbox.y1 - bbox.y0) / 2;
        
        // Add shadow for light text
        if (originalFont.color === '#FFFFFF') {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 2;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
        }
        
        ctx.fillText(newText, bbox.x0 + 5, textY);
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        
        // Save with maximum quality
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

// Handler foto
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
        
        // Store session data
        sessions.set(ctx.from.id, {
            imagePath,
            waitingForCount: true,
            lastMessageTime: Date.now()
        });
        
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
        const session = sessions.get(ctx.from.id);
        if (session?.imagePath && fs.existsSync(session.imagePath)) {
            fs.unlinkSync(session.imagePath);
        }
        sessions.delete(ctx.from.id);
        await ctx.editMessageText('❌ Proses dibatalkan. Silakan kirim screenshot baru.');
        await ctx.answerCbQuery('Proses dibatalkan');
    } catch (error) {
        console.error('Error handling cancel:', error);
        await ctx.answerCbQuery('Gagal membatalkan proses');
    }
});

// Handler text
bot.on('text', async (ctx) => {
    try {
        const session = sessions.get(ctx.from.id);
        if (!session?.imagePath || !session?.waitingForCount) {
            return;
        }

        const timeoutDuration = 5 * 60 * 1000; // 5 menit
        if (Date.now() - session.lastMessageTime > timeoutDuration) {
            if (session.imagePath && fs.existsSync(session.imagePath)) {
                fs.unlinkSync(session.imagePath);
            }
            sessions.delete(ctx.from.id);
            return ctx.reply('⚠️ Sesi telah kedaluwarsa. Silakan kirim screenshot baru.');
        }

        const newCount = ctx.message.text;
        if (!/^\d+$/.test(newCount)) {
            return ctx.reply('⚠️ Mohon masukkan angka yang valid.');
        }

        const processingMsg = await ctx.reply('⏳ Sedang memproses...');
        const editedPath = await editImage(session.imagePath, newCount);
        await ctx.replyWithPhoto({ source: editedPath });
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
        
        // Cleanup
        fs.unlinkSync(session.imagePath);
        fs.unlinkSync(editedPath);
        sessions.delete(ctx.from.id);
        
    } catch (error) {
        console.error('Error handler text:', error);
        await ctx.reply('❌ Gagal mengedit gambar. Silakan coba lagi.');
        
        const session = sessions.get(ctx.from.id);
        if (session?.imagePath && fs.existsSync(session.imagePath)) {
            fs.unlinkSync(session.imagePath);
        }
        sessions.delete(ctx.from.id);
    }
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
