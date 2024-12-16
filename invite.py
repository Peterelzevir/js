import os
import asyncio
import random
import sys
import json
import getpass
import logging
import traceback
from typing import Dict, List, Tuple

from pyrogram import Client, errors
from pyrogram.types import User, Chat, ChatMember
from pyfiglet import figlet_format
from colorama import Fore, Style, init
from aiolimiter import AsyncLimiter

# Konfigurasi Logging & Colorama
init(autoreset=True)
logging.basicConfig(
    level=logging.INFO,
    format=f'{Fore.CYAN}[%(levelname)s]{Style.RESET_ALL} %(message)s',
    handlers=[
        logging.FileHandler("invite_tool_logs.txt"),
        logging.StreamHandler()
    ]
)

class TelegramInviteTool:
    def __init__(self):
        self.accounts: Dict[str, Dict] = {}
        self.config_file = 'account1.json'
        self.sessions_dir = 'sessions'
        
        # Konfigurasi rate limiter
        self.rate_limiter = AsyncLimiter(3, 10)
        
        os.makedirs(self.sessions_dir, exist_ok=True)
        self.load_accounts()

    def load_accounts(self):
        """Muat daftar akun dari file JSON dengan validasi mendalam."""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    self.accounts = json.load(f)
                
                # Validasi setiap sesi
                self._validate_sessions()
        except (json.JSONDecodeError, IOError) as e:
            logging.error(f"Kesalahan memuat akun: {e}")
            self.accounts = {}

    def _validate_sessions(self):
        """Validasi dan bersihkan sesi yang tidak valid."""
        accounts_to_remove = []
        
        for phone, account in list(self.accounts.items()):
            session_path = os.path.join(self.sessions_dir, f"{phone}.session")
            
            if not os.path.exists(session_path):
                logging.warning(f"Sesi untuk {phone} hilang. Menghapus akun.")
                accounts_to_remove.append(phone)
        
        # Hapus akun yang kehilangan sesi
        for phone in accounts_to_remove:
            del self.accounts[phone]
        
        if accounts_to_remove:
            self.save_accounts()

    def save_accounts(self):
        """Simpan daftar akun ke file JSON."""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.accounts, f, indent=4)
        except IOError as e:
            logging.error(f"Gagal menyimpan akun: {e}")

    def display_banner(self):
        """Tampilkan banner profesional dan minimalis."""
        os.system('cls' if os.name == 'nt' else 'clear')
        print(Fore.CYAN + r"""
 ╔═╗┬ ┬┌┐┌┌─┐┌─┐┬─┐
 ║  ├─┤││││ ┬├┤ ├┬┘
 ╚═╝┴ ┴┘└┘└─┘└─┘┴└─
        """ + Style.RESET_ALL)
        print(Fore.YELLOW + "Telegram Multi-Account Invite Tool" + Style.RESET_ALL)
        print(Fore.MAGENTA + "=" * 40 + Style.RESET_ALL)

    async def add_account(self):
        """Tambah akun Telegram dengan metode login aman."""
        self.display_banner()
        print(f"{Fore.CYAN}[Tambah Akun Telegram]{Style.RESET_ALL}")
        
        try:
            api_id = input(f"{Fore.YELLOW}Masukkan API ID: {Style.RESET_ALL}")
            api_hash = input(f"{Fore.YELLOW}Masukkan API Hash: {Style.RESET_ALL}")
            phone_number = input(f"{Fore.YELLOW}Masukkan Nomor HP (+62xxx): {Style.RESET_ALL}")

            # Validasi input
            if not all([api_id, api_hash, phone_number]):
                print(f"{Fore.RED}✗ Semua field wajib diisi!{Style.RESET_ALL}")
                return

            session_name = os.path.join(self.sessions_dir, phone_number)
            
            app = Client(
                name=session_name,
                api_id=int(api_id),
                api_hash=api_hash,
                phone_number=phone_number,
                device_model="iPhone 16 Pro Max",
                system_version="iOS 18",
                app_version="10.5.0",
                lang_code="id",
                in_memory=False
            )

            await app.start()
            sent_code = await app.send_code(phone_number)
            
            code = input(f"{Fore.GREEN}Masukkan Kode OTP: {Style.RESET_ALL}")
            
            try:
                await app.sign_in(phone_number, sent_code.phone_code_hash, code)
            except errors.SessionPasswordNeeded:
                password = getpass.getpass(f"{Fore.GREEN}Masukkan Password 2FA: {Style.RESET_ALL}")
                await app.check_password(password)

            # Ambil info pengguna
            me = await app.get_me()
            
            # Simpan informasi akun
            self.accounts[phone_number] = {
                'api_id': api_id,
                'api_hash': api_hash,
                'session_name': session_name,
                'user_id': me.id,
                'username': me.username or 'Tidak ada',
                'first_name': me.first_name,
                'last_name': me.last_name or 'Tidak ada'
            }
            self.save_accounts()

            print(f"{Fore.GREEN}✓ Akun {me.first_name} berhasil ditambahkan!{Style.RESET_ALL}")
        
        except Exception as e:
            logging.error(f"Kesalahan menambah akun: {e}")
            print(f"{Fore.RED}✗ Gagal menambah akun: {e}{Style.RESET_ALL}")
        finally:
            if 'app' in locals():
                await app.stop()

    async def invite_members(self):
        """Proses undangan member dengan pilihan akun lebih fleksibel."""
        if not self.accounts:
            print(f"{Fore.RED}✗ Tidak ada akun tersimpan!{Style.RESET_ALL}")
            return

        # Tampilkan daftar akun untuk dipilih
        self.view_accounts()
        selected_accounts = self._select_accounts()

        if not selected_accounts:
            print(f"{Fore.RED}✗ Tidak ada akun yang dipilih!{Style.RESET_ALL}")
            return

        # Input detail grup
        source_group = input(f"{Fore.YELLOW}Masukkan username/link grup sumber: {Style.RESET_ALL}")
        dest_group = input(f"{Fore.YELLOW}Masukkan username/link grup tujuan: {Style.RESET_ALL}")
        
        try:
            max_invites = int(input(f"{Fore.YELLOW}Jumlah total member untuk diundang: {Style.RESET_ALL}"))
        except ValueError:
            print(f"{Fore.RED}✗ Input harus angka!{Style.RESET_ALL}")
            return

        # Distribusi tugas antar akun terpilih
        temporary_accounts = {phone: self.accounts[phone] for phone in selected_accounts}
        original_accounts = self.accounts.copy()
        self.accounts = temporary_accounts
        
        try:
            invite_results = await self._distribute_invite_tasks(source_group, dest_group, max_invites)
            
            # Tampilkan ringkasan
            self._display_invite_summary(invite_results)
        finally:
            # Kembalikan akun asli
            self.accounts = original_accounts

    def _select_accounts(self) -> List[str]:
        """Memungkinkan pemilihan akun secara fleksibel."""
        if len(self.accounts) == 1:
            return list(self.accounts.keys())

        print(f"\n{Fore.CYAN}Pilih Akun untuk Proses Invite:{Style.RESET_ALL}")
        for i, (phone, account) in enumerate(self.accounts.items(), 1):
            print(f"{i}. {phone} - {account['first_name']} {account['last_name']}")
        
        print("\nMasukkan nomor akun (pisahkan dengan koma jika lebih dari satu)")
        selections = input(f"{Fore.YELLOW}Pilihan Anda: {Style.RESET_ALL}")
        
        selected_accounts = []
        try:
            for sel in selections.split(','):
                idx = int(sel.strip()) - 1
                phone = list(self.accounts.keys())[idx]
                selected_accounts.append(phone)
        except (ValueError, IndexError):
            print(f"{Fore.RED}✗ Pilihan tidak valid!{Style.RESET_ALL}")
        
        return selected_accounts

    async def _distribute_invite_tasks(self, source_group: str, dest_group: str, total_members: int) -> List[Dict]:
        """Distribusikan tugas undangan ke beberapa akun."""
        num_accounts = len(self.accounts)
        members_per_account = total_members // num_accounts
        extra_members = total_members % num_accounts
        invite_results = []

        for idx, (phone, account_info) in enumerate(self.accounts.items()):
            start_idx = idx * members_per_account
            end_idx = start_idx + members_per_account + (extra_members if idx == num_accounts - 1 else 0)

            print(f"\n{Fore.CYAN}[Proses Invite dengan Akun {phone}]{Style.RESET_ALL}")
            
            app = Client(
                name=account_info['session_name'],
                api_id=int(account_info['api_id']),
                api_hash=account_info['api_hash']
            )

            try:
                await app.start()
                await app.join_chat(source_group)
                await app.join_chat(dest_group)

                # Ambil peserta
                participants = await app.get_chat_members(source_group)
                total_invited = 0

                for participant in participants[start_idx:end_idx]:
                    try:
                        if isinstance(participant.user, User):
                            await self.rate_limiter.acquire()
                            await app.add_chat_members(dest_group, participant.user.id)
                            total_invited += 1
                            print(f"{Fore.GREEN}✓ Mengundang {participant.user.first_name} ke {dest_group}{Style.RESET_ALL}")
                    except Exception as e:
                        logging.error(f"Kesalahan saat mengundang {participant.user.id}: {e}")

            except Exception as e:
                logging.error(f"Kesalahan saat menggunakan akun {phone}: {e}")

            invite_results.append({
                'phone': phone,
                'total_invited': total_invited,
                'errors': total_members - total_invited
            })

        return invite_results

    def _display_invite_summary(self, invite_results: List[Dict]):
        """Tampilkan ringkasan hasil undangan."""
        print(f"\n{Fore.CYAN}Ringkasan Hasil Undangan:{Style.RESET_ALL}")
        for result in invite_results:
            print(f"{Fore.YELLOW}Akun: {result['phone']}, Diundang: {result['total_invited']}, Kesalahan: {result['errors']}{Style.RESET_ALL}")

    def view_accounts(self):
        """Tampilkan semua akun yang telah disimpan."""
        if not self.accounts:
            print(f"{Fore.RED}✗ Tidak ada akun yang disimpan!{Style.RESET_ALL}")
            return

        print(f"\n{Fore.CYAN}Akun yang Disimpan:{Style.RESET_ALL}")
        for phone, account in self.accounts.items():
            print(f"{Fore.YELLOW}- {phone} - {account['first_name']} {account['last_name'] or 'Tidak ada'}{Style.RESET_ALL}")

    async def main(self):
        """Menjalankan alat undangan."""
        while True:
            self.display_banner()
            print(f"{Fore.GREEN}1. Tambah Akun\n2. Undang Member\n3. Keluar{Style.RESET_ALL}")
            choice = input(f"{Fore.YELLOW}Pilih opsi: {Style.RESET_ALL}")

            if choice == '1':
                await self.add_account()
            elif choice == '2':
                await self.invite_members()
            elif choice == '3':
                print(f"{Fore.GREEN}✓ Keluar dari program...{Style.RESET_ALL}")
                break
            else:
                print(f"{Fore.RED}✗ Pilihan tidak valid!{Style.RESET_ALL}")

if __name__ == "__main__":
    tool = TelegramInviteTool()
    asyncio.run(tool.main())
