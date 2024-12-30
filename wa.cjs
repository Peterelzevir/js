const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, DisconnectReason, downloadContentFromMessage, makeInMemoryStore, proto } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const vCardParser = require('vcard-parser');
const qrcode = require('qrcode');
const readline = require('readline');
const chalk = require('chalk');

// Store untuk menyimpan data sesi dan data temporary
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
const tempData = new Map();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Fungsi untuk clear terminal
const clearTerminal = () => {
    process.stdout.write('\x1B[2J\x1B[0f');
};

// Fungsi untuk menampilkan banner
const showBanner = () => {
    console.log(chalk.blue(` ╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮ 
│ WhatsApp Bot - v1.0.0 │ 
│ By: Hiyaok Programmer │ 
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯ `));
};

let socket;

async function startBot(sessionName = 'main-session', isClone = false, parentSocket = null) {
    if (!fs.existsSync('sessions')) {
        fs.mkdirSync('sessions');
    }

    const { state, saveCreds } = await useMultiFileAuthState(`sessions/${sessionName}`);
    const socket = makeWASocket({
        printQRInTerminal: false, // Proses QR dilakukan melalui bot
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        },
        browser: ["Hiyaok Programmer", "Chrome", "1.0.0"],
        logger: pino({ level: "silent" }),
    });

    // Validasi untuk bot clone
    if (isClone && parentSocket) {
        parentSocket.sendMessage('owner@jid', {
            text: '✅ Bot clone telah berhasil dibuat.'
        });
    }

    store.bind(socket.ev);
    socket.ev.on('creds.update', saveCreds);

    }

    // Handle pairing code
    if (connectionMethod === '1' && !socket.authState.creds.registered) {
        try {
            const code = await socket.requestPairingCode(phoneNumber);
            console.log(chalk.green('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
            console.log(chalk.blue('🔑 Kode Pairing Anda: ') + chalk.yellow(code));
            console.log(chalk.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
        } catch (error) {
            console.error(chalk.red('❌ Gagal mendapatkan kode pairing:', error));
            process.exit(1);
        }
    }

    // Connection handling
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if(connection === 'connecting') {
            console.log(chalk.yellow('🔄 Menghubungkan ke WhatsApp...'));
        }

        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
                : true;
            
            if(shouldReconnect) {
                console.log(chalk.yellow('🔄 Koneksi terputus, mencoba menghubungkan kembali...'));
                startBot(sessionName, true);
            }
        }

        if(connection === 'open') {
            console.log(chalk.green('✅ Berhasil terhubung ke WhatsApp!'));
            
            // Tampilkan menu bantuan
            console.log(chalk.cyan('\n📚 Daftar Perintah Bot:'));
            console.log(chalk.white(`
1. !help - Menampilkan daftar perintah
2. !creategroup - Membuat grup baru
3. !joingroup [kode] - Bergabung ke grup
4. !addmembers [id_grup] - Menambah member ke grup
5. !kickmember [id_grup] [nomor] - Kick member dari grup
6. !promote [id_grup] [nomor] - Jadikan admin grup
7. !demote [id_grup] [nomor] - Hapus admin grup
8. !groupinfo [id_grup] - Info grup
9. !leave [id_grup] - Keluar dari grup
10. !clonebot - Buat clone bot ini
            `));
        }
    });

    socket.ev.on('creds.update', saveCreds);

    // Message handling
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const messageType = Object.keys(msg.message)[0];
        const messageContent = msg.message[messageType]?.text || '';
        const sender = msg.key.remoteJid;

        // Help Command
        if (messageContent === '!help') {
            await socket.sendMessage(sender, { text: `📚 *Daftar Perintah Bot:*\n\n` + `1. *!creategroup* - Membuat grup baru\n` + `2. *!joingroup [kode]* - Bergabung ke grup\n` + `3. *!addmembers [id_grup]* - Menambah member ke grup\n` + `4. *!kickmember [id_grup] [nomor]* - Kick member dari grup\n` + `5. *!promote [id_grup] [nomor]* - Jadikan admin grup\n` + `6. *!demote [id_grup] [nomor]* - Hapus admin grup\n` + `7. *!groupinfo [id_grup]* - Info grup\n` + `8. *!leave [id_grup]* - Keluar dari grup\n` + `9. *!clonebot* - Buat clone bot ini` });
        }

        // Group Creation Process Handler
        if (messageContent === '!creategroup') {
            await handleGroupCreation(socket, sender);
        }

        // Handle group settings responses
        else if (tempData.has(sender + '_creating_group')) {
            await handleGroupSetupResponse(socket, sender, messageContent);
        }

        // Handle VCF file for group creation
        else if (msg.message?.documentMessage?.mimetype === 'text/vcard' && tempData.has(sender + '_awaiting_vcf')) {
            await handleVCFForGroupCreation(socket, sender, msg);
        }

        // Join Group Command
        if (messageContent.startsWith('!joingroup')) {
            const inviteCode = messageContent.split(' ')[1];
            try {
                const response = await socket.groupAcceptInvite(inviteCode);
                await socket.sendMessage(sender, { text: '✅ Berhasil bergabung ke grup!' });
            } catch (error) {
                await socket.sendMessage(sender, { text: '❌ Gagal bergabung ke grup. Pastikan kode invite valid.' });
            }
        }

        // Add Members Command
        if (messageContent.startsWith('!addmembers')) {
            const groupId = messageContent.split(' ')[1];
            try {
                const groupInfo = await socket.groupMetadata(groupId);
                tempData.set(sender + '_adding_members', { groupId: groupId, groupName: groupInfo.subject });
                await socket.sendMessage(sender, { text: `📤 Silakan kirim file VCF yang berisi kontak yang ingin ditambahkan ke grup "${groupInfo.subject}"` });
            } catch (error) {
                await socket.sendMessage(sender, { text: '❌ Gagal mendapatkan info grup. Pastikan ID grup valid dan bot adalah admin.' });
            }
        }

        // Kick Member Command
        if (messageContent.startsWith('!kickmember')) {
            const [_, groupId, number] = messageContent.split(' ');
            try {
                await socket.groupParticipantsUpdate(groupId, [number.includes('@') ? number : `${number}@s.whatsapp.net`], 'remove');
                await socket.sendMessage(sender, { text: '✅ Berhasil mengeluarkan member dari grup!' });
            } catch (error) {
                await socket.sendMessage(sender, { text: '❌ Gagal mengeluarkan member. Pastikan bot adalah admin.' });
            }
        }

        // Promote Member Command
        if (messageContent.startsWith('!promote')) {
            const [_, groupId, number] = messageContent.split(' ');
            try {
                await socket.groupParticipantsUpdate(groupId, [number.includes('@') ? number : `${number}@s.whatsapp.net`], 'promote');
                await socket.sendMessage(sender, { text: '✅ Berhasil menjadikan member sebagai admin!' });
            } catch (error) {
                await socket.sendMessage(sender, { text: '❌ Gagal mempromosikan member. Pastikan bot adalah admin.' });
            }
        }

        // Demote Member Command
        if (messageContent.startsWith('!demote')) {
            const [_, groupId, number] = messageContent.split(' ');
            try {
                await socket.groupParticipantsUpdate(groupId, [number.includes('@') ? number : `${number}@s.whatsapp.net`], 'demote');
                await socket.sendMessage(sender, { text: '✅ Berhasil menghapus admin!' });
            } catch (error) {
                await socket.sendMessage(sender, { text: '❌ Gagal menghapus admin. Pastikan bot adalah admin.' });
            }
        }

        // Group Info Command
        if (messageContent.startsWith('!groupinfo')) {
            const groupId = messageContent.split(' ')[1];
            try {
                const groupInfo = await socket.groupMetadata(groupId);
                const participants = groupInfo.participants;
                const admins = participants.filter(p => p.admin).map(p => p.id);
                await socket.sendMessage(sender, { text: `📊 *Info Grup*\n\n` + `Nama: ${groupInfo.subject}\n` + `ID: ${groupId}\n` + `Deskripsi: ${groupInfo.desc || '-'}\n` + `Total Member: ${participants.length}\n` + `Total Admin: ${admins.length}\n` + `Dibuat oleh: ${groupInfo.owner || '-'}` });
            } catch (error) {
                await socket.sendMessage(sender, { text: '❌ Gagal mendapatkan info grup.' });
            }
        }

        // Leave Group Command
        if (messageContent.startsWith('!leave')) {
            const groupId = messageContent.split(' ')[1];
            try {
                await socket.groupLeave(groupId);
                await socket.sendMessage(sender, { text: '✅ Berhasil keluar dari grup!' });
            } catch (error) {
                await socket.sendMessage(sender, { text: '❌ Gagal keluar dari grup.' });
            }
        }

        // Clone Bot Command
        if (messageContent === '!clonebot') {
            if (isClone) {
                await socket.sendMessage(sender, { text: '❌ Fitur ini hanya tersedia untuk bot utama!' });
                return;
            }
            
            await socket.sendMessage(sender, { text: '🤖 *Memulai Proses Cloning Bot*\n\nSilakan masukkan nomor telepon untuk bot clone dengan format *!clonephone [nomor]*.' });

            // Simpan status untuk menunggu input nomor telepon
            tempData.set(sender + '_awaiting_clone_phone', true);
        }

       // Proses menerima nomor telepon untuk cloning
       if (messageContent.startsWith('!clonephone') && tempData.get(sender + '_awaiting_clone_phone')) {
           const clonePhoneNumber = messageContent.split(' ')[1];
           if (!clonePhoneNumber) {
               await socket.sendMessage(sender, { text: '❌ Harap masukkan nomor telepon dengan format *!clonephone [nomor]*.' });
               return;
           }
           tempData.delete(sender + '_awaiting_clone_phone');
           tempData.set(sender + '_awaiting_clone_method', { phone: clonePhoneNumber });
           await socket.sendMessage(sender, { text: '📡 Pilih metode koneksi:\n\n1️⃣ Pairing Code (balas dengan *!clonemethod 1*)\n2️⃣ QR Code (balas dengan *!clonemethod 2*)' });
       }

       // Proses menerima metode koneksi untuk cloning
       if (messageContent.startsWith('!clonemethod') && tempData.has(sender + '_awaiting_clone_method')) {
           const methodChoice = messageContent.split(' ')[1];
           const cloneData = tempData.get(sender + '_awaiting_clone_method');

           if (methodChoice !== '1' && methodChoice !== '2') {
               await socket.sendMessage(sender, { text: '❌ Pilihan tidak valid. Gunakan *!clonemethod 1* atau *!clonemethod 2*.' });
               return;
           }
           
           tempData.delete(sender + '_awaiting_clone_method');
           const cloneSessionName = `clone_${Date.now()}`;
           await startBot(cloneSessionName, true, socket);
           await socket.sendMessage(sender, { text: `✅ Bot clone berhasil dibuat!\n\n📱 Nomor: ${cloneData.phone}\n🔄 Metode: ${methodChoice === '1' ? 'Pairing Code' : 'QR Code'}` });
       }

       // Handle VCF for adding members
       if (msg.message?.documentMessage?.mimetype === 'text/vcard' && tempData.has(sender + '_adding_members')) {
           await handleVCFForAddMembers(socket, sender, msg);
       }
   });

   return socket;
}

// Start the main bot
startBot().catch(console.error);

module.exports = { startBot };
