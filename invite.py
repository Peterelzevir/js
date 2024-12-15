import asyncio
import logging
import os
from datetime import datetime
from telethon import TelegramClient, events
from telethon.tl.functions.channels import (
    InviteToChannelRequest, 
    GetParticipantsRequest
)
from telethon.tl.functions.users import GetFullUserRequest
from telethon.tl.types import (
    ChannelParticipantsSearch, 
    PeerChannel
)
from telethon.errors import (
    UserPrivacyRestrictedError,
    UserNotMutualContactError,
    ChatAdminRequiredError,
    PeerIdInvalidError,
    FloodWaitError
)

# Konfigurasi Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename='userbot.log'
)
logger = logging.getLogger(__name__)

# Konfigurasi API Telegram
API_ID = '23207350'
API_HASH = '03464b6c80a5051eead6835928e48189'
SESSION_NAME = 'macbook'

# Nama perangkat nyata
client = TelegramClient(
    SESSION_NAME,
    API_ID,
    API_HASH,
    device_model="iPhone 16 Pro Max",
    system_version="iOS 18",
    app_version="device hiyaok"
)

# Masukkan daftar admin userbot
ADMIN_IDS = [5988451717, 5896345049]

# Fungsi untuk memeriksa apakah pengirim adalah admin
def is_admin(sender_id):
    return sender_id in ADMIN_IDS

# Decorator untuk logging perintah
def log_command(func):
    async def wrapper(event):
        sender = await event.get_sender()
        logger.info(f"Command {func.__name__} dipanggil oleh {sender.username or sender.id}")
        return await func(event)
    return wrapper

# Fungsi Invite Single (mendukung ID & username)
@client.on(events.NewMessage(pattern='/inv (.+)'))
@log_command
async def invite_single(event):
    if not is_admin(event.sender_id):
        await event.reply("❌ Anda tidak memiliki izin untuk menggunakan fitur ini.")
        return

    args = event.pattern_match.group(1)
    if not args:
        await event.reply("❗ Gunakan perintah dengan benar: /inv [id/username]")
        return

    target = args.strip()

    try:
        chat = await event.get_chat()
        if not (chat.megagroup or chat.broadcast):
            await event.reply("⚠️ Perintah ini hanya dapat digunakan di grup atau channel.")
            return

        group_id = chat.id
        entity = await client.get_entity(target)
        await client(InviteToChannelRequest(group_id, [entity]))
        await event.reply(f"✅ {target} berhasil diundang ke grup 🎉")
    except UserPrivacyRestrictedError:
        await event.reply(f"🚫 {target} tidak dapat diundang karena pengaturan privasi.")
    except UserNotMutualContactError:
        await event.reply(f"⚠️ {target} tidak dapat diundang karena bukan kontak bersama.")
    except ChatAdminRequiredError:
        await event.reply("⚠️ Bot membutuhkan akses admin untuk mengundang pengguna ke grup ini.")
    except PeerIdInvalidError:
        await event.reply(f"❌ {target} tidak valid atau tidak ditemukan.")
    except Exception as e:
        await event.reply(f"❌ Gagal mengundang {target}: {str(e)}")

# Fungsi Invite Bulk (mendukung ID & username)
@client.on(events.NewMessage(pattern='/invbulk (.+)'))
@log_command
async def invite_bulk(event):
    if not is_admin(event.sender_id):
        await event.reply("❌ Anda tidak memiliki izin untuk menggunakan fitur ini.")
        return

    args = event.pattern_match.group(1)
    if not args:
        await event.reply("❗ Gunakan perintah dengan benar: /invbulk [id1/username1],[id2/username2]")
        return

    targets = [t.strip() for t in args.split(',')]
    success = []
    failed = []

    chat = await event.get_chat()
    if not (chat.megagroup or chat.broadcast):
        await event.reply("⚠️ Perintah ini hanya dapat digunakan di grup atau channel.")
        return

    group_id = chat.id

    for target in targets:
        try:
            entity = await client.get_entity(target)
            await client(InviteToChannelRequest(group_id, [entity]))
            success.append(target)
            await asyncio.sleep(3)  # Jeda antar invite
        except UserPrivacyRestrictedError:
            failed.append((target, "Pengaturan privasi"))
        except UserNotMutualContactError:
            failed.append((target, "Bukan kontak bersama"))
        except PeerIdInvalidError:
            failed.append((target, "ID/Username tidak valid"))
        except Exception as e:
            failed.append((target, str(e)))

    result = "🎉 Berhasil diundang: " + ", ".join(success) + "\n" if success else ""
    result += "❌ Gagal diundang:\n" + "\n".join([f"- {t}: {r}" for t, r in failed]) if failed else ""
    await event.reply(result)

# Fungsi Informasi Pengguna
@client.on(events.NewMessage(pattern='/info (.+)'))
@log_command
async def get_user_info(event):
    if not is_admin(event.sender_id):
        await event.reply("❌ Anda tidak memiliki izin untuk menggunakan fitur ini.")
        return

    args = event.pattern_match.group(1)
    if not args:
        await event.reply("❗ Gunakan perintah dengan benar: /info [id/username]")
        return

    target = args.strip()

    try:
        entity = await client.get_entity(target)
        user = await client(GetFullUserRequest(entity.id))
        user_data = user.user

        photo = await client.download_profile_photo(user_data.id, file="profile.jpg") if user_data.photo else None

        details = (
            f"📋 **Informasi Pengguna**:\n"
            f"👤 Nama: {user_data.first_name or ''} {user_data.last_name or ''}\n"
            f"🔗 Username: @{user_data.username or 'Tidak ada'}\n"
            f"🆔 ID: {user_data.id}\n"
            f"⏰ Last Seen: {user_data.status or 'Tidak diketahui'}"
        )

        await event.reply(details, file=photo)

    except UserPrivacyRestrictedError:
        await event.reply(f"🚫 Pengguna dengan ID/username `{target}` memiliki pengaturan privasi yang ketat.")
    except PeerIdInvalidError:
        await event.reply(f"❌ ID/Username `{target}` tidak valid atau pengguna tidak ditemukan.")
    except Exception as e:
        await event.reply(f"❌ Gagal mendapatkan info pengguna `{target}`: {str(e)}")

# Fungsi Add Member dari Sumber Grup ke Tujuan
@client.on(events.NewMessage(pattern='/ad (.+)'))
async def add_members(event):
    if not is_admin(event.sender_id):
        await event.reply("❌ Anda tidak memiliki izin untuk menggunakan fitur ini.")
        return

    args = event.pattern_match.group(1)
    if not args:
        await event.reply("❗ Gunakan perintah dengan benar: /ad <id grup tujuan> <jumlah>")
        return

    try:
        # Parse arguments
        target_group_id, limit = args.split(' ')
        target_group_id = int(target_group_id.strip())
        limit = int(limit.strip())

        # Ambil grup sumber (grup tempat perintah dikirimkan)
        source_chat = await event.get_chat()
        if source_chat.broadcast:
            await event.reply("⚠️ Perintah ini hanya dapat digunakan di grup biasa.")
            return

        await event.delete()  # Hapus perintah dari grup

        # Ambil daftar anggota dari grup sumber
        participants = await client(GetParticipantsRequest(
            source_chat.id, ChannelParticipantsSearch(''), offset=0, limit=limit, hash=0
        ))

        # Proses hanya sejumlah `limit`
        users_to_invite = [user.id for user in participants.users[:limit]]

        # Undang pengguna dalam satu batch
        try:
            await client(InviteToChannelRequest(target_group_id, users_to_invite))
            success_count = len(users_to_invite)
            fail_count = 0
        except Exception as e:
            success_count = 0
            fail_count = len(users_to_invite)
            await client.send_message(
                target_group_id,
                f"❌ Gagal mengundang anggota: {str(e)}"
            )
            return

        # Kirim ringkasan hasil
        await client.send_message(
            target_group_id,
            f"📢 Proses pengundangan selesai:\n\n🎉 Total berhasil diundang: {success_count}\n❌ Total gagal diundang: {fail_count}"
        )

    except ValueError:
        await event.reply("❗ Gunakan perintah dengan benar: /ad <id grup tujuan> <jumlah>")
    except Exception as e:
        await event.reply(f"❌ Terjadi kesalahan: {str(e)}")

# fitur list
@client.on(events.NewMessage(pattern='/list (.+)'))
async def list_members(event):
    if not is_admin(event.sender_id):
        await event.reply("❌ Anda tidak memiliki izin untuk menggunakan fitur ini.")
        return

    args = event.pattern_match.group(1)
    if not args:
        await event.reply("❗ Gunakan perintah dengan benar: /list <jumlah>")
        return

    try:
        limit = int(args.strip())

        # Ambil grup sumber (grup tempat perintah dikirimkan)
        source_chat = await event.get_chat()
        if source_chat.broadcast:
            await event.reply("⚠️ Perintah ini hanya dapat digunakan di grup biasa.")
            return

        # Ambil daftar anggota grup
        participants = await client(GetParticipantsRequest(
            source_chat.id, ChannelParticipantsSearch(''), offset=0, limit=limit, hash=0
        ))

        # Ambil username atau ID dari anggota grup
        usernames = [
            (user.username or f"id_{user.id}") for user in participants.users[:limit]
        ]

        # Format daftar username menjadi satu string
        usernames_list = ', '.join(usernames)

        # Kirim daftar ke admin bot
        for admin_id in ADMIN_IDS:  # `ADMIN_IDS` adalah daftar ID admin
            await client.send_message(
                admin_id,
                f"📃 **Daftar anggota grup**:\n\n{usernames_list}"
            )

        await event.reply("✅ hai!")
    except ValueError:
        await event.reply("❗ Gunakan perintah dengan benar: /list <jumlah>")
    except Exception as e:
        await event.reply(f"❌ Terjadi kesalahan: {str(e)}")

# Fungsi Mendapatkan ID Grup
@client.on(events.NewMessage(pattern='/id'))
@log_command
async def get_group_id(event):
    # Memastikan pengirim adalah admin
    if not is_admin(event.sender_id):
        await event.reply("❌ Anda tidak memiliki izin untuk menggunakan fitur ini.")
        return

    # Mendapatkan informasi chat tempat perintah dikirim
    chat = await event.get_chat()  

    # Memastikan chat adalah grup
    if not chat.broadcast:  # chat.broadcast akan False untuk grup biasa
        await event.reply(f"📋 ID grup ini adalah: `{chat.id}`")
    else:
        await event.reply("⚠️ Perintah ini hanya dapat digunakan di grup biasa.")

# Fitur Status Bot
@client.on(events.NewMessage(pattern='/status'))
@log_command
async def bot_status(event):
    if not is_admin(event.sender_id):
        return await event.reply("❌ Anda tidak memiliki izin.")

    status_info = f"""
🤖 Status Userbot Hiyaok:
👥 Admin Terdaftar: {len(ADMIN_IDS)}
⏰ Waktu Aktif: {datetime.now()}
📡 Versi: V3 Hiyaok New Version 10.22
    """
    await event.reply(status_info)

# Menjalankan client
def main():
    print("🚀 Userbot 'Hiyaok Advanced' sedang diinisialisasi...")
    logger.info("Memulai userbot dengan konfigurasi lengkap")
    client.start()
    client.run_until_disconnected()

if __name__ == '__main__':
    main()
