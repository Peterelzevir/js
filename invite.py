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
        self.config_file = 'accounts.json'
        self.sessions_dir = 'sessions'
        
        # Pastikan direktori sesi ada
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
        """Simpan daftar akun ke file JSON dengan enkripsi sederhana."""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.accounts, f, indent=4)
        except IOError as e:
            logging.error(f"Gagal menyimpan akun: {e}")

    def display_banner(self):
        """Tampilkan banner profesional."""
        os.system('cls' if os.name == 'nt' else 'clear')
        title = figlet_format("INVITE MASTER")
        print(Fore.CYAN + title + Style.RESET_ALL)
        print(Fore.YELLOW + "Telegram Multi-Account Invite Tool" + Style.RESET_ALL)
        print(Fore.MAGENTA + "=" * 50 + Style.RESET_ALL)

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
        """Proses undangan member dengan distribusi akun."""
        if not self.accounts:
            print(f"{Fore.RED}✗ Tidak ada akun tersimpan!{Style.RESET_ALL}")
            return

        # Input detail grup
        source_group = input(f"{Fore.YELLOW}Masukkan username/link grup sumber: {Style.RESET_ALL}")
        dest_group = input(f"{Fore.YELLOW}Masukkan username/link grup tujuan: {Style.RESET_ALL}")
        
        try:
            max_invites = int(input(f"{Fore.YELLOW}Jumlah total member untuk diundang: {Style.RESET_ALL}"))
        except ValueError:
            print(f"{Fore.RED}✗ Input harus angka!{Style.RESET_ALL}")
            return

        # Distribusi tugas antar akun
        invite_results = await self._distribute_invite_tasks(source_group, dest_group, max_invites)
        
        # Tampilkan ringkasan
        self._display_invite_summary(invite_results)

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
                participants = []
                async for member in app.get_chat_members(source_group):
                    if not member.user.is_bot and len(participants) < end_idx:
                        participants.append(member)

                # Proses undangan
                result = await self._process_invites(app, dest_group, participants[start_idx:end_idx])
                
                invite_results.append({
                    'akun': phone,
                    **result
                })

            except Exception as e:
                logging.error(f"Kesalahan pada akun {phone}: {e}")
                print(f"{Fore.RED}Kesalahan pada akun {phone}: {e}{Style.RESET_ALL}")
            finally:
                await app.stop()

        return invite_results

    async def _process_invites(self, app: Client, dest_group: str, participants: List[ChatMember]) -> Dict:
        """Proses undangan dengan penanganan flood."""
        successful_invites = []
        failed_invites = []

        for participant in participants:
            try:
                await app.add_chat_members(dest_group, participant.user.id)
                successful_invites.append(participant.user.first_name)
                await asyncio.sleep(random.uniform(3, 7))
            
            except errors.FloodWait as e:
                print(f"{Fore.YELLOW}FloodWait: Tunggu {e.value} detik.{Style.RESET_ALL}")
                await asyncio.sleep(e.value + 10)
            except Exception as e:
                failed_invites.append((participant.user.first_name, str(e)))

        return {
            'berhasil': len(successful_invites),
            'gagal': len(failed_invites)
        }

    def _display_invite_summary(self, invite_results: List[Dict]):
        """Tampilkan ringkasan hasil invite."""
        print("\n" + "="*50)
        print(f"{Fore.CYAN}Ringkasan Hasil Invite{Style.RESET_ALL}")
        
        total_success = 0
        total_failed = 0
        
        for result in invite_results:
            print(f"{Fore.YELLOW}{result['akun']}: Berhasil {result['berhasil']}, Gagal {result['gagal']}{Style.RESET_ALL}")
            total_success += result['berhasil']
            total_failed += result.get('gagal', 0)
        
        print(f"\n{Fore.GREEN}Total Berhasil: {total_success}{Style.RESET_ALL}")
        print(f"{Fore.RED}Total Gagal: {total_failed}{Style.RESET_ALL}")

    def main_menu(self):
        """Menu utama dengan opsi tambahan."""
        while True:
            self.display_banner()
            print(f"{Fore.GREEN}1. Tambah Akun Telegram")
            print("2. Undang Member Grup")
            print("3. Lihat Daftar Akun")
            print("4. Hapus Akun")
            print("5. Keluar{Style.RESET_ALL}")
            
            choice = input(f"{Fore.YELLOW}Pilih Menu (1-5): {Style.RESET_ALL}")

            try:
                if choice == '1':
                    asyncio.run(self.add_account())
                elif choice == '2':
                    asyncio.run(self.invite_members())
                elif choice == '3':
                    self.view_accounts()
                elif choice == '4':
                    self.remove_account()
                elif choice == '5':
                    print(f"{Fore.CYAN}Terima kasih!{Style.RESET_ALL}")
                    break
                else:
                    print(f"{Fore.RED}Pilihan tidak valid!{Style.RESET_ALL}")
            except Exception as e:
                print(f"{Fore.RED}Kesalahan: {e}{Style.RESET_ALL}")
            
            input("\nTekan Enter untuk melanjutkan...")

    def view_accounts(self):
        """Tampilkan daftar akun tersimpan."""
        if not self.accounts:
            print(f"{Fore.RED}Tidak ada akun tersimpan.{Style.RESET_ALL}")
            return

        print(f"\n{Fore.CYAN}Daftar Akun Tersimpan:{Style.RESET_ALL}")
        for phone, account in self.accounts.items():
            print(f"{Fore.YELLOW}Nomor: {phone}")
            print(f"Nama: {account['first_name']} {account['last_name']}")
            print(f"Username: {account['username']}")
            print(f"User ID: {account['user_id']}{Style.RESET_ALL}")
            print("-" * 30)

    def remove_account(self):
        """Hapus akun dari daftar."""
        self.view_accounts()
        if not self.accounts:
            return

        phone = input(f"{Fore.YELLOW}Masukkan nomor HP akun yang akan dihapus: {Style.RESET_ALL}")
        
        if phone in self.accounts:
            # Hapus file sesi
            session_path = os.path.join(self.sessions_dir, f"{phone}.session")
            if os.path.exists(session_path):
                os.remove(session_path)
            
            # Hapus dari data akun
            del self.accounts[phone]
            self.save_accounts()
            
            print(f"{Fore.GREEN}✓ Akun berhasil dihapus!{Style.RESET_ALL}")
        else:
            print(f"{Fore.RED}✗ Akun tidak ditemukan!{Style.RESET_ALL}")

def main():
    try:
        tool = TelegramInviteTool()
        tool.main_menu()
    except KeyboardInterrupt:
        print(f"\n{Fore.CYAN}Operasi dibatalkan.{Style.RESET_ALL}")
    except Exception as e:
        logging.error(f"Kesalahan fatal: {traceback.format_exc()}")
        print(f"{Fore.RED}Kesalahan fatal: {e}{Style.RESET_ALL}")
        sys.exit(1)

if __name__ == "__main__":
    main()
