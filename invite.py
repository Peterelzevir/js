import os
import asyncio
import random
from pyrogram import Client, errors
from pyfiglet import figlet_format
from colorama import Fore, Style, init
import json
import logging
import getpass

# Inisialisasi Colorama
init(autoreset=True)

# Konfigurasi Logging
logging.basicConfig(
    level=logging.INFO,
    format=f'{Fore.CYAN}[%(levelname)s]{Style.RESET_ALL} %(message)s',
    handlers=[
        logging.FileHandler("invite_log.txt"),
        logging.StreamHandler()
    ]
)

# Fungsi untuk Menampilkan Banner
def display_banner():
    title = figlet_format("HIYAOK PROGRAMMER")
    subtitle = "TOOLS INVITE by @hiyaok"
    print(Fore.CYAN + title + Style.RESET_ALL)
    print(Fore.YELLOW + subtitle + Style.RESET_ALL)
    print(Fore.MAGENTA + "=" * 50 + Style.RESET_ALL)

# Kelas Telegram Invite Tool
class TelegramInviteTool:
    def __init__(self):
        self.accounts = {}
        self.config_file = 'accounts.json'
        self.load_accounts()

    def load_accounts(self):
        """Muat daftar akun dari file JSON."""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    self.accounts = json.load(f)
            except:
                self.accounts = {}

    def save_accounts(self):
        """Simpan daftar akun ke file JSON."""
        with open(self.config_file, 'w') as f:
            json.dump(self.accounts, f)

    async def add_account(self):
        """Tambah akun baru dengan login Telegram."""
        print(f"{Fore.CYAN}[Tambah Akun Telegram]{Style.RESET_ALL}")
        api_id = input(f"{Fore.YELLOW}Masukkan API ID: {Style.RESET_ALL}")
        api_hash = input(f"{Fore.YELLOW}Masukkan API Hash: {Style.RESET_ALL}")
        phone_number = input(f"{Fore.YELLOW}Masukkan Nomor Telepon (dengan kode negara): {Style.RESET_ALL}")

        app = Client(
            session_name=f"{phone_number}",
            api_id=int(api_id),
            api_hash=api_hash,
            device_model="iPhone 16 Pro Max",
            system_version="iOS 18",
            lang_code="id"
        )

        try:
            await app.start()
            # Minta kode OTP atau password 2FA jika diperlukan
            if app.is_user_authorized:
                session_str = await app.export_session_string()
                self.accounts[phone_number] = {
                    'api_id': api_id,
                    'api_hash': api_hash,
                    'session_string': session_str
                }
                self.save_accounts()
                print(f"{Fore.GREEN}✓ Akun berhasil ditambahkan!{Style.RESET_ALL}")
            else:
                print(f"{Fore.YELLOW}Memerlukan kode verifikasi atau 2FA...{Style.RESET_ALL}")
                await app.send_code(phone_number)
                code = input(f"{Fore.GREEN}Masukkan kode OTP yang diterima: {Style.RESET_ALL}")
                password = getpass.getpass(f"{Fore.GREEN}Masukkan password 2FA (jika ada): {Style.RESET_ALL}")
                await app.sign_in(phone_number, code, password)
                session_str = await app.export_session_string()
                self.accounts[phone_number] = {
                    'api_id': api_id,
                    'api_hash': api_hash,
                    'session_string': session_str
                }
                self.save_accounts()
                print(f"{Fore.GREEN}✓ Akun berhasil ditambahkan setelah 2FA!{Style.RESET_ALL}")
        except Exception as e:
            print(f"{Fore.RED}✗ Gagal menambahkan akun: {e}{Style.RESET_ALL}")
        finally:
            await app.stop()

    async def invite_members(self):
        """Proses undangan member dari grup target ke grup tujuan."""
        if not self.accounts:
            print(f"{Fore.RED}✗ Tidak ada akun yang tersimpan.{Style.RESET_ALL}")
            return

        # Pilih akun
        print(f"{Fore.CYAN}[Daftar Akun Tersimpan]{Style.RESET_ALL}")
        for idx, phone in enumerate(self.accounts.keys(), start=1):
            print(f"{Fore.YELLOW}{idx}. {phone}{Style.RESET_ALL}")

        account_choice = int(input(f"{Fore.GREEN}Pilih akun untuk digunakan: {Style.RESET_ALL}"))
        selected_phone = list(self.accounts.keys())[account_choice - 1]
        selected_account = self.accounts[selected_phone]

        # Input grup
        source_group = input(f"{Fore.YELLOW}Masukkan username/link grup sumber: {Style.RESET_ALL}")
        dest_group = input(f"{Fore.YELLOW}Masukkan username/link grup tujuan: {Style.RESET_ALL}")
        max_invites = int(input(f"{Fore.YELLOW}Masukkan jumlah maksimal member untuk diundang: {Style.RESET_ALL}"))

        # Konfigurasi klien
        app = Client(
            session_string=selected_account['session_string'],
            api_id=int(selected_account['api_id']),
            api_hash=selected_account['api_hash']
        )

        try:
            await app.start()

            # Join grup
            await app.join_chat(source_group)
            await app.join_chat(dest_group)

            # Ambil peserta grup sumber
            participants = await app.get_chat_members(source_group)
            print(f"{Fore.GREEN}✓ {len(participants)} anggota ditemukan di grup sumber.{Style.RESET_ALL}")

            # Proses undangan
            invited_count = 0
            for participant in participants[:max_invites]:
                try:
                    await app.add_chat_members(dest_group, participant.user.id)
                    invited_count += 1
                    logging.info(f"✓ {participant.user.first_name} berhasil diundang.")
                    await asyncio.sleep(random.uniform(3, 6))
                except errors.FloodWait as e:
                    logging.warning(f"FloodWait: Harus tunggu {e.value} detik.")
                    await asyncio.sleep(e.value + 5)
                except Exception as e:
                    logging.error(f"✗ Gagal mengundang {participant.user.first_name}: {e}")

            print(f"{Fore.GREEN}✓ Proses selesai. Total anggota yang berhasil diundang: {invited_count}{Style.RESET_ALL}")
        finally:
            await app.stop()

    def main_menu(self):
        """Menu utama."""
        while True:
            display_banner()
            print(f"{Fore.GREEN}1. Tambah Akun")
            print("2. Undang Member")
            print("3. Keluar{Style.RESET_ALL}")
            choice = input(f"{Fore.YELLOW}Pilih menu (1-3): {Style.RESET_ALL}")

            if choice == '1':
                asyncio.run(self.add_account())
            elif choice == '2':
                asyncio.run(self.invite_members())
            elif choice == '3':
                break
            else:
                print(f"{Fore.RED}Pilihan tidak valid!{Style.RESET_ALL}")

# Jalankan program
if __name__ == "__main__":
    tool = TelegramInviteTool()
    tool.main_menu()
