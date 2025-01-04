const { Telegraf, Markup } = require('telegraf');
const sharp = require('sharp');
const tesseract = require('tesseract.js');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf('7745228249:AAH_USMrZGLHswRVWcDq71X_OB7F68cvAvU');

// Enhanced session handling
const sessions = new Map();

// Fungsi untuk preprocessing gambar
async function preprocessImage(imagePath) {
    const preprocessedPath = `${imagePath}_prep.jpg`;
    await sharp(imagePath)
        .resize(1500, null, {
            withoutEnlargement: true
        })
        .modulate({
            brightness: 1.2,
            contrast: 1.2
        })
        .sharpen()
        .toFile(preprocessedPath);
    return preprocessedPath;
}

// Fungsi deteksi teks grup
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
                preserve_interword_spaces: '1'
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

        // Mencari bbox berdasarkan angka member
        for (const word of words) {
            if (word.text.includes(memberCount)) {
                bbox = {
                    x0: Math.max(0, word.bbox.x0 - 60),
                    y0: word.bbox.y0,
                    x1: Math.min(data.width, word.bbox.x1 + 100),
                    y1: word.bbox.y1
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

// Fungsi untuk mendeteksi properti font dan warna
async function detectFontProperties(imagePath, bbox) {
    try {
        const image = await sharp(imagePath);
        const metadata = await image.metadata();
        
        // Validasi bbox
        const x0 = Math.max(0, Math.floor(bbox.x0));
        const y0 = Math.max(0, Math.floor(bbox.y0));
        const x1 = Math.min(metadata.width, Math.floor(bbox.x1));
        const y1 = Math.min(metadata.height, Math.floor(bbox.y1));
        
        const width = x1 - x0;
        const height = y1 - y0;
        
        if (width <= 0 || height <= 0) {
            throw new Error('Invalid bbox dimensions');
        }
        
        const region = await image
            .extract({
                left: x0,
                top: y0,
                width: width,
                height: height
            })
            .toBuffer();
            
        const stats = await sharp(region).stats();
        
        // Analisis warna
        const avgBrightness = stats.channels.reduce((sum, channel) => sum + channel.mean, 0) / 3;
        const textColor = avgBrightness > 127 ? '#202124' : '#FFFFFF';
        
        return {
            color: textColor,
            fontSize: Math.max(12, Math.min(32, Math.floor(height * 0.8))),
            brightness: avgBrightness
        };
    } catch (error) {
        console.error('Error in detectFontProperties:', error);
        throw error;
    }
}

// Fungsi untuk mendapatkan warna background yang tepat
async function getBackgroundColor(imagePath, bbox) {
    try {
        const image = await sharp(imagePath);
        const region = await image
            .extract({
                left: bbox.x0,
                top: bbox.y0,
                width: bbox.x1 - bbox.x0,
                height: bbox.y1 - bbox.y0
            })
            .raw()
            .toBuffer();
            
        let r = 0, g = 0, b = 0;
        const pixelCount = region.length / 3;
        
        for (let i = 0; i < region.length; i += 3) {
            r += region[i];
            g += region[i + 1];
            b += region[i + 2];
        }
        
        return {
            r: Math.round(r / pixelCount),
            g: Math.round(g / pixelCount),
            b: Math.round(b / pixelCount)
        };
    } catch (error) {
        console.error('Error in getBackgroundColor:', error);
        throw error;
    }
}

// Fungsi untuk mendapatkan posisi angka yang tepat
function getNumberPosition(bbox, originalText, newText, fontSize) {
    const width = bbox.x1 - bbox.x0;
    const height = bbox.y1 - bbox.y0;
    
    return {
        x: bbox.x0 + width / 2,
        y: bbox.y0 + height / 2,
        width: width,
        height: height
    };
}

// Fungsi utama untuk edit gambar
async function editImage(imagePath, newCount) {
    try {
        const image = await sharp(imagePath);
        const metadata = await image.metadata();
        
        // Deteksi teks grup menggunakan fungsi yang sudah ada
        const groupText = await detectGroupText(imagePath);
        console.log('Detected group text:', groupText);
        
        if (!groupText || !groupText.bbox) {
            throw new Error('Failed to detect group text area');
        }
        
        const canvas = createCanvas(metadata.width, metadata.height);
        const ctx = canvas.getContext('2d');
        
        // Load dan gambar image original
        const originalImage = await loadImage(imagePath);
        ctx.drawImage(originalImage, 0, 0);
        
        // Dapatkan properti font dan warna
        const fontProps = await detectFontProperties(imagePath, groupText.bbox);
        
        // Dapatkan warna background
        const bgColor = await getBackgroundColor(imagePath, groupText.bbox);
        
        // Hitung posisi untuk angka baru
        const numPos = getNumberPosition(
            groupText.bbox, 
            groupText.memberCount.toString(), 
            newCount.toString(), 
            fontProps.fontSize
        );
        
        // Bersihkan area angka dengan warna background
        ctx.fillStyle = `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
        ctx.fillRect(
            numPos.x - (numPos.width / 2),
            numPos.y - (numPos.height / 2),
            numPos.width,
            numPos.height
        );
        
        // Setup style untuk angka baru
        ctx.font = `${fontProps.fontSize}px -apple-system, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = fontProps.color;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        
        // Tambah shadow jika background terang
        if (fontProps.brightness > 200) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = 1;
            ctx.shadowOffsetX = 0.5;
            ctx.shadowOffsetY = 0.5;
        }
        
        // Tulis angka baru
        ctx.fillText(newCount.toString(), numPos.x, numPos.y);
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Simpan hasil
        const outputPath = path.resolve(__dirname, `edited_${Date.now()}.jpg`);
        const buffer = canvas.toBuffer('image/jpeg');
        
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

        const timeoutDuration = 1 * 60 * 1000; // 5 menit
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
