const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    makeInMemoryStore,
    proto,
    getContentType,
    generateWAMessageFromContent,
    downloadContentFromMessage
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const pino = require('pino')
const path = require('path')
const fs = require('fs')
const FileType = require('file-type')
const { exec } = require('child_process')
const axios = require('axios')
const readline = require('readline')
const ffmpeg = require('fluent-ffmpeg')
const { removeBackgroundFromImageUrl } = require('remove.bg')
const Jimp = require('jimp')

// Constants & ASCII Art
const WATERMARK = '\n\n_Powered by @hiyaok on Telegram_'
const BOT_NAME = 'Pinemark'
const SESSION_DIR = './sessions'
const TEMP_DIR = './temp'
const RECONNECT_INTERVAL = 3000
const MAX_RECONNECT_RETRIES = 3

// Art
const ASCII_ART = `
╔═════════════════════════════════════╗
║     ╔═╗╦╔╗╔╔═╗╔╦╗╔═╗╦═╗╦╔═         ║
║     ╠═╝║║║║║╣ ║║║╠═╣╠╦╝╠╩╗         ║
║     ╩  ╩╝╚╝╚═╝╩ ╩╩ ╩╩╚═╩ ╩         ║
║                                     ║
║        WhatsApp Bot Pine            ║
╚═════════════════════════════════════╝`

const CLONE_ASCII = `
╔════════════════════════════════════╗
║     ╔═╗╦  ╔═╗╔╗╔╔═╗  ╔╗ ╔═╗╔╦╗    ║
║     ║  ║  ║ ║║║║║╣   ╠╩╗║ ║ ║     ║
║     ╚═╝╩═╝╚═╝╝╚╝╚═╝  ╚═╝╚═╝ ╩     ║
║                                    ║
║      Clone Session Manager         ║
╚════════════════════════════════════╝`

// Initialize store
const store = makeInMemoryStore({ 
    logger: pino().child({ level: 'debug', stream: 'store' }) 
})
store.readFromFile('./baileys_store.json')
setInterval(() => {
    store.writeToFile('./baileys_store.json')
}, 10_000)

// Initialize logger
const logger = pino({ 
    level: 'debug',
    transport: {
        target: 'pino-pretty',
        options: {
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    }
})

// Initialize readline
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

// Create required directories
for (const dir of [SESSION_DIR, TEMP_DIR]) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        logger.info(`Created directory: ${dir}`)
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

// Utility Functions
const serialize = (msg) => {
    if (!msg.message) return msg
    const type = getContentType(msg.message)
    return {
        ...msg,
        type,
        id: msg.key.id,
        from: msg.key.remoteJid,
        fromMe: msg.key.fromMe,
        pushName: msg.pushName,
        participant: msg.key.participant
    }
}

const downloadMedia = async (message, type) => {
    const stream = await downloadContentFromMessage(message[`${type}Message`], type)
    let buffer = Buffer.from([])
    for await(const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
    }
    return buffer
}

// Core WhatsApp Connection
const connectToWhatsApp = async (sessionDir = './auth_info_baileys', options = {}) => {
    const { version, isLatest } = await fetchLatestBaileysVersion()
    logger.info(`Using WA v${version.join('.')}, isLatest: ${isLatest}`)

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)

    // Socket configuration
    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: options.printQR ?? true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        generateHighQualityLinkPreview: true,
        browser: [BOT_NAME, 'Chrome', '4.0.0'],
        getMessage: async key => {
            if(store) {
                const msg = await store.loadMessage(key.remoteJid, key.id)
                return msg?.message || undefined
            }
            return proto.Message.fromObject({})
        },
        markOnlineOnConnect: true,
        defaultQueryTimeoutMs: 60000,
        msgRetryCounterMap: {},
        syncFullHistory: false,
        patchMessageBeforeSending: (message) => {
            const requiresPatch = !!(
                message.buttonsMessage 
                || message.templateMessage
                || message.listMessage
            );
            if (requiresPatch) {
                message = {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadataVersion: 2,
                                deviceListMetadata: {},
                            },
                            ...message,
                        },
                    },
                };
            }
            return message;
        }
    })

    // Bind store
    store.bind(sock.ev)

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        
        if(qr) {
            logger.info('QR Code received, please scan using WhatsApp app')
            if(options.onQR) options.onQR(qr)
        }

        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
            
            logger.info('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect)

            if(shouldReconnect) {
                setTimeout(async () => {
                    await connectToWhatsApp(sessionDir, options)
                }, RECONNECT_INTERVAL)
            } else {
                logger.info('Connection closed. You are logged out.')
                if(options.onLoggedOut) options.onLoggedOut()
            }
        } else if(connection === 'open') {
            logger.info('WhatsApp connection established')
            if(options.onConnected) options.onConnected(sock)
        }
    })

    // Save credentials
    sock.ev.on('creds.update', saveCreds)

    // Message handling
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if(type !== 'notify') return

        for (const message of messages) {
            if(!message) continue
            
            try {
                await handleMessage(sock, message)
            } catch (error) {
                logger.error('Error handling message:', error)
            }
        }
    })

    // Other events
    sock.ev.on('presence.update', json => logger.debug('presence update:', json))
    sock.ev.on('groups.upsert', json => logger.debug('groups update:', json))
    sock.ev.on('groups.update', json => logger.debug('groups metadata update:', json))
    sock.ev.on('group-participants.update', json => logger.debug('group participants update:', json))
    sock.ev.on('messages.reaction', json => logger.debug('message reaction:', json))

    return sock
}

// Message Handler
const handleMessage = async (sock, msg) => {
    const serialized = serialize(msg)
    if (serialized.fromMe) return

    const type = serialized.type
    const from = serialized.from
    const body = type === 'conversation' ? serialized.message.conversation :
                type === 'imageMessage' ? serialized.message.imageMessage.caption :
                type === 'videoMessage' ? serialized.message.videoMessage.caption : ''

    const isCommand = body.startsWith('.')
    if (!isCommand) return handleNonCommand(sock, serialized, body)

    const [command, ...args] = body.slice(1).toLowerCase().trim().split(' ')
    
    try {
        switch(command) {
            case 'menu':
            case 'help':
                await sock.sendMessage(from, { text: helpMenu })
                break

            case 'sticker':
                if (type !== 'imageMessage') {
                    await sock.sendMessage(from, { text: '*⚠️ Please send an image with caption .sticker*' })
                    return
                }
                await handleStickerCommand(sock, serialized)
                break

            case 'tiktok':
                await handleTikTokCommand(sock, serialized, args)
                break

            case 'ig':
                await handleInstagramCommand(sock, serialized, args)
                break

            case 'pinterest':
                await handlePinterestCommand(sock, serialized, args)
                break

            case 'clone':
                await handleCloneCommand(sock, serialized, args)
                break

            default:
                await sock.sendMessage(from, { text: '*⚠️ Unknown command*' + WATERMARK })
        }
    } catch (error) {
        logger.error(`Error handling command ${command}:`, error)
        await sock.sendMessage(from, { text: '*❌ An error occurred*' + WATERMARK })
    }
}

// Command Handlers
const handleStickerCommand = async (sock, msg) => {
    const processingMsg = await sock.sendMessage(msg.from, {
        text: '_Converting image to sticker..._' + WATERMARK
    }, { quoted: msg })

    try {
        const buffer = await downloadMedia(msg.message, 'image')
        const tempFile = path.join(TEMP_DIR, `${msg.id}.png`)
        fs.writeFileSync(tempFile, buffer)

        const image = await Jimp.read(tempFile)
        await image.resize(512, Jimp.AUTO)
        await image.writeAsync(tempFile)

        await sock.sendImageAsSticker(msg.from, tempFile, {
            pack: BOT_NAME,
            author: '@hiyaok',
            categories: ['🤖', '✨'],
            id: '12345',
            quality: 50,
            background: 'transparent'
        })

        fs.unlinkSync(tempFile)
        await sock.sendMessage(msg.from, { delete: processingMsg.key })
    } catch (error) {
        logger.error('Sticker creation error:', error)
        await sock.sendMessage(msg.from, {
            edit: processingMsg.key,
            text: '*❌ Failed to create sticker*' + WATERMARK
        })
    }
}

const handleTikTokCommand = async (sock, msg, args) => {
    if (!args[0]) {
        await sock.sendMessage(msg.from, {
            text: '*⚠️ Please provide a TikTok URL*' + WATERMARK
        }, { quoted: msg })
        return
    }

    const processingMsg = await sock.sendMessage(msg.from, {
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

        await sock.sendMessage(msg.from, {
            video: { url: videoData.hdplay },
            caption: caption,
            mimetype: 'video/mp4'
        }, { quoted: msg })

        await sock.sendMessage(msg.from, { delete: processingMsg.key })
    } catch (error) {
        logger.error('TikTok download error:', error)
        await sock.sendMessage(msg.from, {
            edit: processingMsg.key,
            text: '*❌ Failed to download TikTok video*' + WATERMARK
        })
    }
}

// ... [Lanjutkan dengan handler Instagram, Pinterest, Clone, dan fitur lainnya]

// Start Bot Function
const startBot = async () => {
    console.log(ASCII_ART)
    logger.info('Starting Pinemark WhatsApp Bot')
    
    rl.question('Enter phone number (with country code): ', async (number) => {
        logger.debug('Phone number entered:', number)
        
        rl.question(
            '\nChoose login method:\n1. QR Code\n2. Pairing Code\nEnter choice (1/2): ',
            async (choice) => {
                const options = {
                    printQR: choice === '1',
                    async onQR(qr) {
                        if (choice === '2') {
                            try {
                                const code = await sock.requestPairingCode(number)
                                logger.info('='.repeat(50))
                                logger.info('PAIRING CODE:', code)
                                logger.info('='.repeat(50))
                            } catch (err) {
                                logger.error('Failed to get pairing code:', err)
                            }
                        }
                    },
                    onConnected(sock) {
                        logger.info('Bot connected successfully!')
                    },
                    onLoggedOut() {
                        logger.error('Bot logged out')
                        process.exit(1)
                    }
                }

                try {
                    const sessionDir = path.join(SESSION_DIR, 'main-bot')
                    await connectToWhatsApp(sessionDir, options)
                } catch (err) {
                    logger.error('Failed to start bot:', err)
                    process.exit(1)
                }
            }
        )
    })
}

// Handle non-command messages (AI & Background Removal)
const handleNonCommand = async (sock, msg, body) => {
    const type = msg.type
    const from = msg.from

    if (type === 'conversation') {
        // AI Response
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
            logger.error('AI response error:', error)
            await sock.sendMessage(from, {
                edit: processingMsg.key,
                text: '*❌ Failed to get AI response*' + WATERMARK
            })
        }
    }
    else if (type === 'imageMessage') {
        // Background Removal
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
            logger.error('Background removal error:', error)
            await sock.sendMessage(from, {
                edit: processingMsg.key,
                text: '*❌ Failed to remove background*' + WATERMARK
            })
        }
    }
}

// Instagram Handler
const handleInstagramCommand = async (sock, msg, args) => {
    if (!args[0]) {
        await sock.sendMessage(msg.from, {
            text: '*⚠️ Please provide an Instagram URL*' + WATERMARK
        }, { quoted: msg })
        return
    }

    const processingMsg = await sock.sendMessage(msg.from, {
        text: '_Processing Instagram download..._' + WATERMARK
    }, { quoted: msg })

    try {
        const response = await axios.get(`https://api.ryzendesu.vip/api/downloader/igdl?url=${args[0]}`)
        const mediaUrl = response.data.data[0].url

        await sock.sendMessage(msg.from, {
            video: { url: mediaUrl },
            caption: `*${BOT_NAME} Instagram Downloader*` + WATERMARK,
            mimetype: 'video/mp4'
        }, { quoted: msg })

        await sock.sendMessage(msg.from, { delete: processingMsg.key })
    } catch (error) {
        logger.error('Instagram download error:', error)
        await sock.sendMessage(msg.from, {
            edit: processingMsg.key,
            text: '*❌ Failed to download Instagram media*' + WATERMARK
        })
    }
}

// Pinterest Handler
const handlePinterestCommand = async (sock, msg, args) => {
    if (!args[0]) {
        await sock.sendMessage(msg.from, {
            text: '*⚠️ Please provide a search query*' + WATERMARK
        }, { quoted: msg })
        return
    }

    const processingMsg = await sock.sendMessage(msg.from, {
        text: '_Searching Pinterest..._' + WATERMARK
    }, { quoted: msg })

    try {
        const query = args.join(' ')
        const response = await axios.get(`https://api.ryzendesu.vip/api/search/pinterest?query=${query}`)

        for (const imageUrl of response.data) {
            await sock.sendMessage(msg.from, {
                image: { url: imageUrl },
                caption: `*${BOT_NAME} Pinterest Search*` + WATERMARK
            }, { quoted: msg })
        }

        await sock.sendMessage(msg.from, { delete: processingMsg.key })
    } catch (error) {
        logger.error('Pinterest search error:', error)
        await sock.sendMessage(msg.from, {
            edit: processingMsg.key,
            text: '*❌ Failed to search Pinterest*' + WATERMARK
        })
    }
}

// Clone Handler
const handleCloneCommand = async (sock, msg, args) => {
    if (!args[0]) {
        await sock.sendMessage(msg.from, { 
            text: '*⚠️ Please provide a target number\nFormat: .clone 6281234567890*' + WATERMARK 
        }, { quoted: msg })
        return
    }

    const processingMsg = await sock.sendMessage(msg.from, { 
        text: `${CLONE_ASCII}\n\n*🤖 Initializing ${BOT_NAME} clone process...*` + WATERMARK 
    })

    try {
        const sessionPath = path.join(SESSION_DIR, `clone-${args[0]}`)
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
        
        const options = {
            printQR: false,
            async onQR(qr) {
                await sock.sendMessage(msg.from, {
                    image: Buffer.from(qr, 'base64'),
                    caption: `${CLONE_ASCII}\n\n*🔄 Scan this QR Code to login*\n\nQR Code will expire in 60 seconds.${WATERMARK}`
                })
            },
            async onConnected(cloneSock) {
                await sock.sendMessage(msg.from, { 
                    text: `${CLONE_ASCII}\n\n*✅ ${BOT_NAME} clone connected successfully!*\n\n*Number:* ${args[0]}\n*Status:* Online\n\n_All features are ready to use._${WATERMARK}`,
                    edit: processingMsg.key 
                })
            },
            async onLoggedOut() {
                await sock.sendMessage(msg.from, { 
                    text: `${CLONE_ASCII}\n\n*❌ Clone session ended*` + WATERMARK 
                })
                fs.rmSync(sessionPath, { recursive: true, force: true })
            }
        }

        await connectToWhatsApp(sessionPath, options)

    } catch (error) {
        logger.error('Clone error:', error)
        await sock.sendMessage(msg.from, { 
            text: `${CLONE_ASCII}\n\n*❌ Failed to initialize clone*` + WATERMARK,
            edit: processingMsg.key 
        })
    }
}

// Error handling
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err)
})

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err)
})

// Start the bot
startBot()

module.exports = {
    connectToWhatsApp,
    startBot
}
