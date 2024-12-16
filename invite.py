import os
import asyncio
import random
from pyrogram import Client, errors
from pyrogram.types import User
from pyfiglet import figlet_format
from colorama import Fore, Style, init
import json
import logging
import getpass
import sys
import time

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
            except json.JSONDecodeError:
                self.accounts = {}

    def save_accounts(self):
        """Simpan daftar akun ke file JSON."""
        with open(self.config_file, 'w') as f:
            json.dump(self.accounts, f, indent=4)

    async def add_account(self):
        """Tambah akun baru dengan login Telegram."""
        print(f"{Fore.CYAN}[Tambah Akun Telegram]{Style.RESET_ALL}")
        
        while True:
            try:
                api_id = input(f"{Fore.YELLOW}Masukkan API ID: {Style.RESET_ALL}")
                api_hash = input(f"{Fore.YELLOW}Masukkan API Hash: {Style.RESET_ALL}")
                phone_number = input(f"{Fore.YELLOW}Masukkan Nomor Telepon (dengan kode negara): {Style.RESET_ALL}")

                # Validasi input
                if not api_id or not api_hash or not phone_number:
                    print(f"{Fore.RED}Semua field harus diisi!{Style.RESET_ALL}")
                    continue

                # Gunakan nama sesi yang unik
                session_name = f"sessions/{phone_number}"
                
                app = Client(
                    name=session_name,
                    api_id=int(api_id),
                    api_hash=api_hash,
                    phone_number=phone_number,
                    device_model="iPhone 16 Pro Max",
                    system_version="iOS 18",
                    lang_code="id"
                )

                # Aktifkan mode sesi permanen
                app.set_parse_mode("combined")

                await app.start()

                # Kirim kode verifikasi
                sent_code = await app.send_code(phone_number)
                
                code = input(f"{Fore.GREEN}Masukkan kode OTP yang diterima: {Style.RESET_ALL}")
                
                try:
                    # Coba sign in
                    await app.sign_in(phone_number, sent_code.phone_code_hash, code)
                except errors.SessionPasswordNeeded:
                    # Jika dibutuhkan password 2FA
                    password = getpass.getpass(f"{Fore.GREEN}Masukkan password 2FA: {Style.RESET_ALL}")
                    await app.check_password(password)

                # Simpan sesi dengan metode yang mendukung multi-device
                await app.storage.save()

                # Ambil informasi pengguna untuk konfirmasi
                me = await app.get_me()
                print(f"{Fore.GREEN}✓ Berhasil login sebagai: {me.first_name} {me.last_name or ''}{Style.RESET_ALL}")
                print(f"{Fore.GREEN}✓ Username: @{me.username}{Style.RESET_ALL}")

                # Simpan informasi akun
                self.accounts[phone_number] = {
                    'api_id': api_id,
                    'api_hash': api_hash,
                    'session_name': session_name,
                    'user_id': me.id
                }
                self.save_accounts()

                print(f"{Fore.GREEN}✓ Akun berhasil ditambahkan dan sesi disimpan!{Style.RESET_ALL}")
                break

            except errors.PhoneCodeInvalid:
                print(f"{Fore.RED}✗ Kode OTP tidak valid. Silakan coba lagi.{Style.RESET_ALL}")
            except errors.PhoneCodeExpired:
                print(f"{Fore.RED}✗ Kode OTP sudah kadaluarsa. Silakan minta ulang.{Style.RESET_ALL}")
            except Exception as e:
                print(f"{Fore.RED}✗ Gagal menambahkan akun: {e}{Style.RESET_ALL}")
            finally:
                if 'app' in locals():
                    await app.stop()

    async def distribute_invite_tasks(self, source_group, dest_group, total_members):
        """Distribusikan tugas undangan ke beberapa akun."""
        if not self.accounts:
            print(f"{Fore.RED}✗ Tidak ada akun yang tersimpan.{Style.RESET_ALL}")
            return

        # Hitung pembagian anggota per akun
        num_accounts = len(self.accounts)
        members_per_account = total_members // num_accounts
        extra_members = total_members % num_accounts

        # Simpan hasil invite
        invite_results = []

        # Proses invite dengan pembagian tugas
        for idx, (phone, account_info) in enumerate(self.accounts.items()):
            # Tentukan rentang anggota untuk akun ini
            start_idx = idx * members_per_account
            end_idx = start_idx + members_per_account + (extra_members if idx == num_accounts - 1 else 0)

            print(f"\n{Fore.CYAN}[Proses Invite dengan Akun {phone}]{Style.RESET_ALL}")
            
            # Buat klien untuk akun ini
            app = Client(
                name=account_info['session_name'],
                api_id=int(account_info['api_id']),
                api_hash=account_info['api_hash']
            )

            try:
                await app.start()
                
                # Join grup
                await app.join_chat(source_group)
                await app.join_chat(dest_group)

                # Ambil daftar peserta
                participants = []
                async for member in app.get_chat_members(source_group):
                    if not member.user.is_bot and len(participants) < end_idx:
                        participants.append(member)

                print(f"{Fore.GREEN}✓ {len(participants)} anggota akan diundang.{Style.RESET_ALL}")

                # Proses undangan
                successful_invites = []
                failed_invites = []

                for participant in participants[start_idx:end_idx]:
                    try:
                        # Tambah anggota
                        await app.add_chat_members(dest_group, participant.user.id)
                        successful_invites.append(participant.user.first_name)
                        
                        # Tunggu sebentar untuk menghindari flood
                        await asyncio.sleep(random.uniform(3, 7))
                    
                    except errors.FloodWait as e:
                        print(f"{Fore.YELLOW}FloodWait: Tunggu {e.value} detik.{Style.RESET_ALL}")
                        await asyncio.sleep(e.value + 10)
                    except Exception as e:
                        failed_invites.append((participant.user.first_name, str(e)))

                # Catat hasil
                invite_results.append({
                    'akun': phone,
                    'berhasil': len(successful_invites),
                    'gagal': len(failed_invites)
                })

                # Cetak ringkasan per akun
                print(f"{Fore.GREEN}✓ Berhasil mengundang: {len(successful_invites)}{Style.RESET_ALL}")
                if failed_invites:
                    print(f"{Fore.RED}✗ Gagal mengundang: {len(failed_invites)}{Style.RESET_ALL}")

            except Exception as e:
                print(f"{Fore.RED}Kesalahan pada akun {phone}: {e}{Style.RESET_ALL}")
            finally:
                await app.stop()

        # Tampilkan ringkasan akhir
        print("\n" + "="*50)
        print(f"{Fore.CYAN}Ringkasan Hasil Invite{Style.RESET_ALL}")
        total_success = 0
        total_failed = 0
        for result in invite_results:
            print(f"{Fore.YELLOW}{result['akun']}: Berhasil {result['berhasil']}, Gagal {result['gagal']}{Style.RESET_ALL}")
            total_success += result['berhasil']
            total_failed += result['gagal']
        
        print(f"\n{Fore.GREEN}Total Berhasil: {total_success}{Style.RESET_ALL}")
        print(f"{Fore.RED}Total Gagal: {total_failed}{Style.RESET_ALL}")

    async def invite_members(self):
        """Proses undangan member dari grup target ke grup tujuan."""
        if not self.accounts:
            print(f"{Fore.RED}✗ Tidak ada akun yang tersimpan.{Style.RESET_ALL}")
            return

        # Input grup
        source_group = input(f"{Fore.YELLOW}Masukkan username/link grup sumber: {Style.RESET_ALL}")
        dest_group = input(f"{Fore.YELLOW}Masukkan username/link grup tujuan: {Style.RESET_ALL}")
        
        try:
            max_invites = int(input(f"{Fore.YELLOW}Masukkan jumlah total member untuk diundang: {Style.RESET_ALL}"))
        except ValueError:
            print(f"{Fore.RED}✗ Jumlah undangan harus berupa angka!{Style.RESET_ALL}")
            return

        # Mulai proses distribusi undangan
        await self.distribute_invite_tasks(source_group, dest_group, max_invites)

    def main_menu(self):
        """Menu utama."""
        while True:
            print(f"{Fore.CYAN}{'='*50}{Style.RESET_ALL}")
            print(f"{Fore.GREEN}TELEGRAM MULTI-INVITE TOOL{Style.RESET_ALL}")
            print(f"{Fore.CYAN}{'='*50}{Style.RESET_ALL}")
            
            print(f"{Fore.YELLOW}1. Tambah Akun")
            print("2. Undang Member")
            print("3. Keluar{Style.RESET_ALL}")
            
            try:
                choice = input(f"{Fore.GREEN}Pilih menu (1-3): {Style.RESET_ALL}")

                if choice == '1':
                    asyncio.run(self.add_account())
                elif choice == '2':
                    asyncio.run(self.invite_members())
                elif choice == '3':
                    break
                else:
                    print(f"{Fore.RED}Pilihan tidak valid!{Style.RESET_ALL}")
            
            except KeyboardInterrupt:
                print(f"\n{Fore.YELLOW}Operasi dibatalkan.{Style.RESET_ALL}")
            except Exception as e:
                print(f"{Fore.RED}Terjadi kesalahan: {e}{Style.RESET_ALL}")

def main():
    try:
        tool = TelegramInviteTool()
        tool.main_menu()
    except Exception as e:
        print(f"{Fore.RED}Kesalahan fatal: {e}{Style.RESET_ALL}")
        sys.exit(1)

if __name__ == "__main__":
    main()
