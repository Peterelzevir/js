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
# Konfigurasi Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename='userbot.log'
)
logger = logging.getLogger(__name__)

# Konfigurasi Keamanan dan Konfigurasi
CONFIG_FILE = 'config.json'
DEFAULT_CONFIG = {
    'api_id': '23207350',
    'api_hash': '03464b6c80a5051eead6835928e48189',
    'session_name': 'loloo',
    'admin_ids': [5988451717, 5896345049],
    'proxy_list': [],
    'rate_limit': {
        'invite_cooldown': 3,
        'max_invites_per_hour': 100
    }
}

def load_config():
    try:
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(DEFAULT_CONFIG, f, indent=4)
        return DEFAULT_CONFIG

# Muat Konfigurasi
CONFIG = load_config()

# Fungsi Tambahan: Cek IP Publik dan Proxy
def get_public_ip():
    try:
        return urllib.request.urlopen('https://api.ipify.org').read().decode('utf8')
    except Exception as e:
        logger.error(f"Gagal mendapatkan IP publik: {e}")
        return "IP tidak dapat dideteksi"

def check_proxy_status(proxy_list):
    active_proxies = []
    for proxy in proxy_list:
        try:
            # Implementasi pengecekan proxy
            # Contoh sederhana, perlu disesuaikan dengan kebutuhan
            urllib.request.urlopen(f'http://{proxy}', timeout=5)
            active_proxies.append(proxy)
        except Exception as e:
            logger.warning(f"Proxy {proxy} tidak aktif: {e}")
    return active_proxies

# Inisialisasi Client dengan Proxy Opsional
def create_client(config):
    proxy = None
    active_proxies = check_proxy_status(config['proxy_list'])
    
    if active_proxies:
        proxy_url = active_proxies[0]
        proxy = {
            'hostname': proxy_url.split(':')[0],
            'port': int(proxy_url.split(':')[1])
        }
        logger.info(f"Menggunakan proxy: {proxy_url}")

    client = TelegramClient(
        config['session_name'], 
        config['api_id'], 
        config['api_hash'],
        proxy=proxy,
        device_model="Programmer V3",
        system_version="Hiyaok New Version 10.22",
        app_version="@hiyaok advanced userbot"
    )
    return client

# Inisialisasi Client
client = create_client(CONFIG)

def is_admin(sender_id):
    return sender_id in CONFIG['admin_ids']

# Decorator untuk logging dan monitoring
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
@log_command
async def advanced_add_members(event):
    if not is_admin(event.sender_id):
        await event.reply("❌ Anda tidak memiliki izin untuk menggunakan fitur ini.")
        return

    args = event.pattern_match.group(1)
    if not args:
        await event.reply("❗ Gunakan perintah dengan benar: /ad <id grup tujuan> <jumlah>")
        return

    try:
        target_group_id, limit = args.split(' ')
        target_group_id = int(target_group_id.strip())
        limit = int(limit.strip())

        source_chat = await event.get_chat()
        if source_chat.broadcast:
            await event.reply("⚠️ Perintah ini hanya dapat digunakan di grup biasa.")
            return

        await event.delete()

        participants = await client(GetParticipantsRequest(
            source_chat.id, ChannelParticipantsSearch(''), offset=0, limit=limit, hash=0
        ))

        total_members = len(participants.users)
        if total_members == 0:
            for admin_id in ADMIN_IDS:
                await client.send_message(
                    admin_id,
                    "❌ Tidak ada anggota di grup sumber untuk diundang."
                )
            return

        invited_successfully = []
        failed_invites = []

        for user in participants.users[:limit]:
            try:
                # Invite user
                await client(InviteToChannelRequest(target_group_id, [user.id]))
                
                # Jeda untuk menghindari flood
                await asyncio.sleep(3)
                
                invited_successfully.append(user.username or str(user.id))
                
                if len(invited_successfully) >= limit:
                    break

            except UserPrivacyRestrictedError:
                failed_invites.append((user.username or str(user.id), "Privasi Terbatas"))
            except UserNotMutualContactError:
                failed_invites.append((user.username or str(user.id), "Bukan Kontak Bersama"))
            except FloodWaitError as e:
                # Mengatasi flood wait
                await asyncio.sleep(e.seconds)
            except Exception as e:
                failed_invites.append((user.username or str(user.id), str(e)))

        # Kirim laporan hanya ke admin
        report = "🔔 Laporan Invite Otomatis:\n\n"
        report += f"✅ Berhasil: {len(invited_successfully)}\n"
        report += f"❌ Gagal: {len(failed_invites)}\n\n"
        
        if failed_invites:
            report += "Detail Gagal:\n"
            report += "\n".join([f"- {user}: {reason}" for user, reason in failed_invites])

        # Kirim laporan ke semua admin
        for admin_id in ADMIN_IDS:
            await client.send_message(admin_id, report)

    except ValueError:
        await event.reply("❗ Format salah. Gunakan: /ad <id_grup> <jumlah>")
    except Exception as e:
        await event.reply(f"❌ Kesalahan: {str(e)}")

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

# Fitur Monitoring Tambahan
@client.on(events.NewMessage(pattern='/status'))
@log_command
async def bot_status(event):
    if not is_admin(event.sender_id):
        return await event.reply("❌ Anda tidak memiliki izin.")

    status_info = f"""
🤖 Status Userbot:
📡 IP Publik: {get_public_ip()}
⏰ Waktu Aktif: {datetime.now()}
👥 Admin Terdaftar: {len(CONFIG['admin_ids'])}
🔌 Proxy Aktif: {len(check_proxy_status(CONFIG['proxy_list']))}
    """
    await event.reply(status_info)

# Jalankan Client
def main():
    print("🚀 Userbot 'Hiyaok Advanced' sedang diinisialisasi...")
    logger.info("Memulai userbot dengan konfigurasi advanced")
    client.start()
    client.run_until_disconnected()

if __name__ == '__main__':
    main()
