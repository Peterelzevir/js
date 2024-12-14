from telethon import TelegramClient, events
from telethon.tl.functions.channels import InviteToChannelRequest
from telethon.tl.functions.users import GetFullUserRequest
from telethon.tl.functions.channels import GetParticipantsRequest
from telethon.errors import (
    UserPrivacyRestrictedError,
    UserNotMutualContactError,
    ChatAdminRequiredError,
    PeerIdInvalidError,
)
from telethon.tl.types import PeerChannel
from telethon.tl.types import ChannelParticipantsSearch

# Konfigurasi API Telegram Anda
API_ID = '23207350'  # Ganti dengan API ID Anda
API_HASH = '03464b6c80a5051eead6835928e48189'  # Ganti dengan API Hash Anda
SESSION_NAME = 'lololo'  # Nama sesi file lokal

# Nama perangkat nyata
client = TelegramClient(
    SESSION_NAME,
    API_ID,
    API_HASH,
    device_model="Programmer",  # Nama perangkat nyata
    system_version="V3 Hiyaok New Version 10.22",  # Versi sistem nyata
    app_version="@hiyaok programmer new version"  # Versi aplikasi nyata
)

# Masukkan daftar admin userbot
ADMIN_IDS = [5988451717, 5896345049]  # Ganti dengan ID admin yang diizinkan

# Fungsi untuk memeriksa apakah pengirim adalah admin
def is_admin(sender_id):
    return sender_id in ADMIN_IDS

# Perbaikan fungsi invite (mendukung ID & username)
@client.on(events.NewMessage(pattern='/inv (.+)'))
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
        if not (chat.megagroup or chat.broadcast):  # Validasi tipe grup
            await event.reply("⚠️ Perintah ini hanya dapat digunakan di grup atau channel.")
            return

        group_id = chat.id
        entity = await client.get_entity(target)  # Mendukung ID & username
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

# Perbaikan fungsi bulk invite (mendukung ID & username)
@client.on(events.NewMessage(pattern='/invbulk (.+)'))
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
    if not (chat.megagroup or chat.broadcast):  # Validasi tipe grup
        await event.reply("⚠️ Perintah ini hanya dapat digunakan di grup atau channel.")
        return

    group_id = chat.id

    for target in targets:
        try:
            entity = await client.get_entity(target)  # Mendukung ID & username
            await client(InviteToChannelRequest(group_id, [entity]))
            success.append(target)
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

# Perbaikan fungsi /info (mendukung ID & username)
@client.on(events.NewMessage(pattern='/info (.+)'))
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
        # Mendukung ID & username
        entity = await client.get_entity(target)
        user = await client(GetFullUserRequest(entity.id))
        user_data = user.user

        # Mendapatkan foto profil jika ada
        photo = await client.download_profile_photo(user_data.id, file="profile.jpg") if user_data.photo else None

        # Membuat detail info pengguna
        details = (
            f"📋 **Informasi Pengguna**:\n"
            f"👤 Nama: {user_data.first_name or ''} {user_data.last_name or ''}\n"
            f"🔗 Username: @{user_data.username or 'Tidak ada'}\n"
            f"🆔 ID: {user_data.id}\n"
            f"⏰ Last Seen: {user_data.status or 'Tidak diketahui'}"
        )

        # Kirim detail info pengguna (beserta foto profil jika ada)
        await event.reply(details, file=photo)

    except UserPrivacyRestrictedError:
        await event.reply(f"🚫 Pengguna dengan ID/username `{target}` memiliki pengaturan privasi yang ketat.")
    except PeerIdInvalidError:
        await event.reply(f"❌ ID/Username `{target}` tidak valid atau pengguna tidak ditemukan.")
    except Exception as e:
        await event.reply(f"❌ Gagal mendapatkan info pengguna `{target}`: {str(e)}")

@client.on(events.NewMessage(pattern='/ad (.+)'))
async def add_members(event):
    # Memastikan pengirim adalah admin
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

        source_chat = await event.get_chat()  # Mendapatkan chat sumber
        if source_chat.broadcast:
            await event.reply("⚠️ Perintah ini hanya dapat digunakan di grup biasa.")
            return

        await event.delete()  # Menghapus pesan perintah

        participants = await client(GetParticipantsRequest(
            source_chat.id, ChannelParticipantsSearch(''), offset=0, limit=limit, hash=0
        ))

        total_members = len(participants.users)
        if total_members == 0:
            await client.send_message(
                target_group_id,
                "❌ Tidak ada anggota di grup sumber untuk diundang."
            )
            return

        invited = []
        failed = []

        for user in participants.users[:limit]:
            try:
                await client(InviteToChannelRequest(target_group_id, [user.id]))
                invited.append(user.username or user.id)
            except UserPrivacyRestrictedError:
                failed.append((user.username or user.id, "Pengaturan privasi"))
            except UserNotMutualContactError:
                failed.append((user.username or user.id, "Bukan kontak bersama"))
            except PeerIdInvalidError:
                failed.append((user.username or user.id, "ID tidak valid"))
            except Exception as e:
                failed.append((user.username or user.id, str(e)))

        result = f"🎉 Total berhasil diundang: {len(invited)}\n" if invited else ""
        result += f"❌ Total gagal diundang: {len(failed)}\n" if failed else ""
        result += "\n".join([f"- {t}: {r}" for t, r in failed]) if failed else ""

        await client.send_message(
            target_group_id,
            f"📢 Proses pengundangan selesai:\n\n{result}"
        )

    except ValueError:
        await event.reply("❗ Gunakan perintah dengan benar: /ad <id grup tujuan> <jumlah>")
    except Exception as e:
        await event.reply(f"❌ Terjadi kesalahan: {str(e)}")

@client.on(events.NewMessage(pattern='/id'))
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

# Menjalankan client
client.start()
print("Userbot aktif dengan program 'hiyaok'.")
client.run_until_disconnected()
