const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidDecode,
    downloadContentFromMessage,
    getContentType,
    generateWAMessageFromContent,
    proto
} = require('@whiskeysockets/baileys')
const pino = require('pino')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const FileType = require('file-type')
const path = require('path')
const { exec } = require('child_process')
const axios = require('axios')
const readline = require('readline')
const ffmpeg = require('fluent-ffmpeg')
const { removeBackgroundFromImageUrl } = require('remove.bg')
const Jimp = require('jimp')

// Constants
const WATERMARK = '\n\n_Powered by @hiyaok on Telegram_'
const BOT_NAME = 'Pinemark'
const SESSION_DIR = './sessions'
const TEMP_DIR = './temp'

const ASCII_ART = `
╔═════════════════════════════════════╗
║     ╔═╗╦╔╗╔╔═╗╔╦╗╔═╗╦═╗╦╔═         ║
║     ╠═╝║║║║║╣ ║║║╠═╣╠╦╝╠╩╗         ║
║     ╩  ╩╝╚╝╚═╝╩ ╩╩ ╩╩╚═╩ ╩         ║
║                                     ║
║        WhatsApp Bot Pine        ║
╚═════════════════════════════════════╝`

const CLONE_ASCII = `
╔════════════════════════════════════╗
║     ╔═╗╦  ╔═╗╔╗╔╔═╗  ╔╗ ╔═╗╔╦╗    ║
║     ║  ║  ║ ║║║║║╣   ╠╩╗║ ║ ║     ║
║     ╚═╝╩═╝╚═╝╝╚╝╚═╝  ╚═╝╚═╝ ╩     ║
║                                    ║
║      Clone Session Manager         ║
╚════════════════════════════════════╝`

// Create directories
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR)
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR)

// Initialize readline
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

// Utility Functions
const serialize = (msg) => ({
    ...msg,
    id: msg.key.id,
    from: msg.key.remoteJid,
    fromMe: msg.key.fromMe,
    type: getContentType(msg.message)
})

const sendButton = async (sock, jid, text, buttons) => {
    try {
        return await sock.sendMessage(jid, {
            text,
            buttons: buttons.map(b => ({
                buttonId: b.id,
                buttonText: { displayText: b.text },
                type: 1
            })),
            headerType: 1
        })
    } catch {
        // Fallback to poll if buttons not supported
        return await sock.sendMessage(jid, {
            poll: {
                name: text,
                values: buttons.map(b => b.text),
                selectableCount: 1
            }
        })
    }
}

const sendPoll = async (sock, jid, text, options) => {
    return await sock.sendMessage(jid, {
        poll: {
            name: text,
            values: options,
            selectableCount: 1
        }
    })
}

const downloadMedia = async (message, type) => {
    const stream = await downloadContentFromMessage(message[`${type}Message`], type)
    let buffer = Buffer.from([])
    for await(const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
    }
    return buffer
}

const processSticker = async (imagePath) => {
    const image = await Jimp.read(imagePath)
    await image.resize(512, Jimp.AUTO)
    await image.writeAsync(imagePath)
    
    return {
        name: BOT_NAME,
        author: '@hiyaok',
        categories: ['🤖', '✨'],
        id: '12345',
        quality: 50,
        background: 'transparent'
    }
}

// Help Menu
const helpMenu = `${ASCII_ART}

*Welcome to ${BOT_NAME} Bot!* 🤖

*Sticker Commands:*
➤ .sticker - Convert image to sticker
➤ .foto - Convert sticker to image

*Downloader Commands:*
➤ .tiktok <url> - Download TikTok video
➤ .ig <url> - Download Instagram content

*Search Commands:*
➤ .pinterest <query> - Search Pinterest images

*Other Commands:*
➤ .clone <number> - Clone bot to another number
➤ .menu - Show this help menu

*Additional Features:*
• Auto AI response for text messages
• Auto background removal for images

Made with ❤️ by Pinemark Team ${WATERMARK}`

// Message Handler
const messageHandler = (sock) => async ({ messages }) => {
    const msg = serialize(messages[0])
    
    if (msg.fromMe) return
    
    const content = JSON.stringify(msg.message)
    const from = msg.from
    const type = msg.type
    
    const body = type === 'conversation' ? msg.message.conversation :
                type === 'imageMessage' ? msg.message.imageMessage.caption :
                type === 'videoMessage' ? msg.message.videoMessage.caption : ''
    
    const command = body.slice(1).trim().split(/ +/).shift().toLowerCase()
    const args = body.trim().split(/ +/).slice(1)
    const isCommand = body.startsWith('.')

    // Command handler
    try {
        // Help Menu
        if (command === 'menu' || command === 'help') {
            await sock.sendMessage(from, { text: helpMenu }, { quoted: msg })
            return
        }

        // Clone Bot
        if (command === 'clone') {
            if (!args[0]) {
                await sock.sendMessage(from, { 
                    text: '*⚠️ Please provide a target number\nFormat: .clone 6281234567890*' + WATERMARK 
                }, { quoted: msg })
                return
            }

            const processingMsg = await sock.sendMessage(from, { 
                text: `${CLONE_ASCII}\n\n*🤖 Initializing ${BOT_NAME} clone process...*` + WATERMARK 
            })

            try {
                const sessionPath = path.join(SESSION_DIR, `clone-${args[0]}`)
                const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
                
                const cloneSock = makeWASocket({
                    printQRInTerminal: false,
                    auth: state,
                    logger: pino({ level: 'silent' }),
                    browser: [`${BOT_NAME} Clone`, 'Safari', '']
                })

                // Send login method poll
                await sendPoll(sock, from, 
                    `${CLONE_ASCII}\n\n*Choose login method for clone:*`,
                    ['QR Code', 'Pairing Code', 'Cancel']
                )

                // Handle poll response
                sock.ev.on('messages.upsert', async ({ messages }) => {
                    const pollMsg = messages[0]
                    if (pollMsg.message?.pollUpdateMessage) {
                        const selectedOption = pollMsg.message.pollUpdateMessage.vote
                        
                        if (selectedOption === 'QR Code') {
                            cloneSock.ev.on('connection.update', async ({ connection, qr }) => {
                                if (qr) {
                                    await sock.sendMessage(from, {
                                        image: Buffer.from(qr, 'base64'),
                                        caption: `${CLONE_ASCII}\n\n*🔄 Scan this QR Code to login*\n\nQR Code will expire in 60 seconds.${WATERMARK}`
                                    })
                                }
                                handleCloneConnection(connection, cloneSock, sock, from, args[0], sessionPath, processingMsg)
                            })
                        } 
                        else if (selectedOption === 'Pairing Code') {
                            try {
                                const pairingCode = await cloneSock.requestPairingCode(args[0])
                                await sock.sendMessage(from, {
                                    text: `${CLONE_ASCII}\n\n*🔑 Your pairing code:*\n\n${pairingCode}${WATERMARK}`
                                })
                                
                                cloneSock.ev.on('connection.update', ({ connection }) => {
                                    handleCloneConnection(connection, cloneSock, sock, from, args[0], sessionPath, processingMsg)
                                })
                            } catch (error) {
                                console.error('Pairing code error:', error)
                                await sock.sendMessage(from, {
                                    text: `${CLONE_ASCII}\n\n*❌ Failed to generate pairing code*` + WATERMARK
                                })
                            }
                        }
                        else if (selectedOption === 'Cancel') {
                            await sock.sendMessage(from, {
                                text: `${CLONE_ASCII}\n\n*❌ Clone process cancelled*` + WATERMARK,
                                edit: processingMsg.key
                            })
                            fs.rmSync(sessionPath, { recursive: true, force: true })
                        }
                    }
                })

                cloneSock.ev.on('creds.update', saveCreds)
                cloneSock.ev.on('messages.upsert', messageHandler(cloneSock))

            } catch (error) {
                console.error('Clone error:', error)
                await sock.sendMessage(from, { 
                    text: `${CLONE_ASCII}\n\n*❌ Failed to initialize clone*` + WATERMARK,
                    edit: processingMsg.key 
                })
            }
            return
        }

        // Sticker Command
        if (command === 'sticker' && type === 'imageMessage') {
            const processingMsg = await sock.sendMessage(from, {
                text: '_Converting image to sticker..._' + WATERMARK
            }, { quoted: msg })

            try {
                const buffer = await downloadMedia(msg.message, 'image')
                const tempFile = path.join(TEMP_DIR, `${msg.id}.png`)
                fs.writeFileSync(tempFile, buffer)

                const stickerMetadata = await processSticker(tempFile)
                await sock.sendImageAsSticker(from, tempFile, stickerMetadata)
                
                fs.unlinkSync(tempFile)
                await sock.sendMessage(from, { delete: processingMsg.key })
            } catch (error) {
                console.error('Sticker error:', error)
                await sock.sendMessage(from, {
                    edit: processingMsg.key,
                    text: '*❌ Failed to create sticker*' + WATERMARK
                })
            }
        }

        // TikTok Download
        if (command === 'tiktok') {
            if (!args[0]) {
                await sock.sendMessage(from, {
                    text: '*⚠️ Please provide a TikTok URL*' + WATERMARK
                }, { quoted: msg })
                return
            }

            const processingMsg = await sock.sendMessage(from, {
                text: '_Processing TikTok download..._' + WATERMARK
            }, { quoted: msg })

            try {
                const response = await axios.get(`https://api.ryzendesu.vip/api/downloader/aiodown?url=${args[0]}`)
                const videoData = response.data.data.data
                
                const caption = `*${BOT_NAME} TikTok Downloader*\n\n` +
                    `*Title:* ${videoData.title}\n` +
                    `*Author:* ${videoData.author.nickname}\n` +
                    `*Duration:* ${videoData.duration}s\n` +
                    `*Views:* ${videoData.play_count}\n` +
                    `*Likes:* ${videoData.digg_count}` +
                    WATERMARK

                await sock.sendMessage(from, {
                    video: { url: videoData.hdplay },
                    caption: caption,
                    mimetype: 'video/mp4'
                }, { quoted: msg })

                await sock.sendMessage(from, { delete: processingMsg.key })
            } catch (error) {
                console.error('TikTok error:', error)
                await sock.sendMessage(from, {
                    edit: processingMsg.key,
                    text: '*❌ Failed to download TikTok video*' + WATERMARK
                })
            }
        }

        // Instagram Download
        if (command === 'ig') {
            if (!args[0]) {
                await sock.sendMessage(from, {
                    text: '*⚠️ Please provide an Instagram URL*' + WATERMARK
                }, { quoted: msg })
                return
            }

            const processingMsg = await sock.sendMessage(from, {
                text: '_Processing Instagram download..._' + WATERMARK
            }, { quoted: msg })

            try {
                const response = await axios.get(`https://api.ryzendesu.vip/api/downloader/igdl?url=${args[0]}`)
                const mediaUrl = response.data.data[0].url

                await sock.sendMessage(from, {
                    video: { url: mediaUrl },
                    caption: `*${BOT_NAME} Instagram Downloader*` + WATERMARK,
                    mimetype: 'video/mp4'
                }, { quoted: msg })

                await sock.sendMessage(from, { delete: processingMsg.key })
            } catch (error) {
                console.error('Instagram error:', error)
                await sock.sendMessage(from, {
                    edit: processingMsg.key,
                    text: '*❌ Failed to download Instagram media*' + WATERMARK
                })
            }
        }

        // Pinterest Search
        if (command === 'pinterest') {
            if (!args[0]) {
                await sock.sendMessage(from, {
                    text: '*⚠️ Please provide a search query*' + WATERMARK
                }, { quoted: msg })
                return
            }

            const processingMsg = await sock.sendMessage(from, {
                text: '_Searching Pinterest..._' + WATERMARK
            }, { quoted: msg })

            try {
                const query = args.join(' ')
                const response = await axios.get(`https://api.ryzendesu.vip/api/search/pinterest?query=${query}`)

                for (const imageUrl of response.data) {
                    await sock.sendMessage(from, {
                        image: { url: imageUrl },
                        caption: `*${BOT_NAME} Pinterest Search*` + WATERMARK
                    }, { quoted: msg })
                }

                await sock.sendMessage(from, { delete: processingMsg.key })
            } catch (error) {
                console.error('Pinterest error:', error)
                await sock.sendMessage(from, {
                    edit: processingMsg.key,
                    text: '*❌ Failed to search Pinterest*' + WATERMARK
                })
            }
        }

        // Auto AI Response for Text
        if (type === 'conversation' && !isCommand) {
            const processingMsg = await sock.sendMessage(from, {
                text: '_Thinking..._' + WATERMARK
            }, { quoted: msg })

            try {
                const response = await axios.get(`https://api.ryzendesu.vip/api/ai/claude?text=${encodeURIComponent(body)}`)
                await sock.sendMessage(from, {
                    edit: processingMsg.key,
                    text: `*🤖 ${response.data.response}*` + WATERMARK
                })
            } catch (error) {
                console.error('AI error:', error)
                await sock.sendMessage(from, {
                    edit: processingMsg.key,
                    text: '*❌ Failed to get AI response*' + WATERMARK
                })
            }
        }

        // Auto Background Removal for Images
        if (type === 'imageMessage' && !isCommand) {
            const processingMsg = await sock.sendMessage(from, {
                text: '_Removing background..._' + WATERMARK
            }, { quoted: msg })

            try {
                const buffer = await downloadMedia(msg.message, 'image')
                const tempFile = path.join(TEMP_DIR, `${msg.id}.png`)
                fs.writeFileSync(tempFile, buffer)

                const response = await axios.get(`https://api.ryzendesu.vip/api/ai/removebg?url=${encodeURIComponent(tempFile)}`, {
                    responseType: 'arraybuffer'
                })

                await sock.sendMessage(from, {
                    image: response.data,
                    caption: `*${BOT_NAME} Background Removal*` + WATERMARK
                }, { quoted: msg })

                fs.unlinkSync(tempFile)
                await sock.sendMessage(from, { delete: processingMsg.key })
            } catch (error) {
                console.error('Background removal error:', error)
                await sock.sendMessage(from, {
                    edit: processingMsg.key,
                    text: '*❌ Failed to remove background*' + WATERMARK
                })
            }
        }

    } catch (error) {
        console.error('Command error:', error)
        await sock.sendMessage(from, {
            text: '*❌ An error occurred*' + WATERMARK
        }, { quoted: msg })
    }
}

// Helper function for clone connection handling
const handleCloneConnection = async (connection, cloneSock, sock, from, number, sessionPath, processingMsg) => {
    if (connection === 'open') {
        await sock.sendMessage(from, { 
            text: `${CLONE_ASCII}\n\n*✅ ${BOT_NAME} clone connected successfully!*\n\n*Number:* ${number}\n*Status:* Online\n\n_All features are ready to use._${WATERMARK}`,
            edit: processingMsg.key 
        })
    } else if (connection === 'close') {
        const shouldReconnect = (cloneSock.lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut
        
        if (shouldReconnect) {
            await sock.sendMessage(from, { 
                text: `${CLONE_ASCII}\n\n*⚠️ Clone connection lost, reconnecting...*` + WATERMARK 
            })
        } else {
            await sock.sendMessage(from, { 
                text: `${CLONE_ASCII}\n\n*❌ Clone session ended*` + WATERMARK 
            })
            fs.rmSync(sessionPath, { recursive: true, force: true })
        }
    }
}

// Start Bot Function
async function startBot() {
    console.log(ASCII_ART)
    console.log('\nWelcome to Pinemark WhatsApp Bot!\n')
    
    rl.question('Enter your phone number (with country code): ', async (number) => {
        console.log('\nProcessing...')
        
        rl.question('\nChoose login method:\n1. QR Code\n2. Pairing Code\nEnter choice (1/2): ', async (choice) => {
            try {
                const { state, saveCreds } = await useMultiFileAuthState(path.join(SESSION_DIR, 'main-bot'))
                
                const sock = makeWASocket({
                    printQRInTerminal: true, // Always enable QR printing
                    auth: state,
                    logger: pino({ level: 'silent' }),
                    browser: [BOT_NAME, 'Safari', '']
                })

                // Connection Update Handler
                sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
                    if(connection === 'close') {
                        const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut
                        
                        if(shouldReconnect) {
                            console.log('Connection lost, reconnecting...')
                            startBot()
                        } else {
                            console.log('Connection closed. You are logged out.')
                            process.exit(0)
                        }
                    } else if(connection === 'open') {
                        console.log(`
╭━━━━━━━━━━━━━━━━━━━━━╮
┃   PINEMARK CONNECTED! ┃
┃━━━━━━━━━━━━━━━━━━━━━┃
┃ Status : Online      ┃
┃ Number : ${number}   ┃
┃ Name   : ${BOT_NAME} ┃
╰━━━━━━━━━━━━━━━━━━━━━╯
`)
                    }
                    
                    // Handle QR code generation
                    if(choice === '1' && qr) {
                        console.log('Scan this QR code to login:')
                    } 
                })

                // Generate pairing code if selected
                if(choice === '2') {
                    setTimeout(async () => {
                        try {
                            const code = await sock.requestPairingCode(number)
                            console.log(`
╭━━━━━━━━━━━━━━━━━━━━━╮
┃   PAIRING CODE       ┃
┃━━━━━━━━━━━━━━━━━━━━━┃
┃ Code: ${code}        ┃
╰━━━━━━━━━━━━━━━━━━━━━╯
`)
                        } catch (error) {
                            console.error('Failed to generate pairing code:', error)
                        }
                    }, 3000) // Add delay to ensure connection is ready
                }

                // Credentials Update Handler
                sock.ev.on('creds.update', saveCreds)

                // Message Handler
                sock.ev.on('messages.upsert', messageHandler(sock))

            } catch (error) {
                console.error('Error starting bot:', error)
                process.exit(1)
            }
        })
    })
}

// Initial Start
startBot()
