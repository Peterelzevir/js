import asyncio
import os
import json
from pyrogram import Client, errors
from pyrogram.types import User
from colorama import Fore, Style, init

init(autoreset=True)


class TelegramInviteTool:
    def __init__(self):
        self.accounts = {}
        self.config_file = 'accounts.json'
        self.load_accounts()

    def load_accounts(self):
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    self.accounts = json.load(f)
            except:
                self.accounts = {}

    def save_accounts(self):
        with open(self.config_file, 'w') as f:
            json.dump(self.accounts, f)

    async def add_account(self):
        print(f"{Fore.CYAN}[+] Tambah Akun Telegram{Style.RESET_ALL}")
        api_id = input(f"{Fore.YELLOW}Masukkan API ID: {Style.RESET_ALL}")
        api_hash = input(f"{Fore.YELLOW}Masukkan API Hash: {Style.RESET_ALL}")
        phone_number = input(f"{Fore.YELLOW}Masukkan Nomor Telepon: {Style.RESET_ALL}")

        app = Client(
            f"session_{phone_number}",
            api_id=api_id,
            api_hash=api_hash,
            device_model="iPhone 16 Pro Max",
            app_version="iOS 18",
            lang_code="id",
            phone_number=phone_number,
        )

        try:
            await app.start()
            me: User = await app.get_me()
            print(f"{Fore.GREEN}✓ Login berhasil! Akun: {me.first_name} ({me.id}){Style.RESET_ALL}")
            self.accounts[phone_number] = {"api_id": api_id, "api_hash": api_hash}
            self.save_accounts()
        except Exception as e:
            print(f"{Fore.RED}✗ Gagal login: {e}{Style.RESET_ALL}")
        finally:
            await app.stop()

    async def process_invite(self):
        if not self.accounts:
            print(f"{Fore.RED}✗ Tidak ada akun yang tersimpan! Tambahkan akun terlebih dahulu.{Style.RESET_ALL}")
            return

        print(f"{Fore.CYAN}[+] Pilih Akun untuk Proses Undangan:{Style.RESET_ALL}")
        for idx, phone in enumerate(self.accounts.keys(), start=1):
            print(f"{Fore.YELLOW}{idx}. {phone}{Style.RESET_ALL}")

        selected_indexes = input(
            f"{Fore.GREEN}Masukkan nomor akun yang ingin digunakan (pisahkan dengan koma, contoh: 1,2): {Style.RESET_ALL}"
        ).split(",")
        selected_accounts = [list(self.accounts.keys())[int(i) - 1] for i in selected_indexes]

        source_chat = input(f"{Fore.YELLOW}Masukkan username/link grup sumber: {Style.RESET_ALL}")
        dest_chat = input(f"{Fore.YELLOW}Masukkan username/link grup tujuan: {Style.RESET_ALL}")
        max_invites = int(input(f"{Fore.YELLOW}Jumlah maksimal undangan per akun: {Style.RESET_ALL}"))

        tasks = []
        for phone in selected_accounts:
            tasks.append(self.invite_from_account(phone, source_chat, dest_chat, max_invites))
        await asyncio.gather(*tasks)

    async def invite_from_account(self, phone_number, source_chat, dest_chat, max_invites):
        account = self.accounts[phone_number]
        app = Client(
            f"session_{phone_number}",
            api_id=account["api_id"],
            api_hash=account["api_hash"],
        )
        try:
            await app.start()
            source = await app.get_chat_members(source_chat)
            dest = await app.get_chat(dest_chat)
            members_to_invite = [member for member in source if not member.user.is_bot][:max_invites]

            print(f"{Fore.CYAN}[{phone_number}] Memulai proses undangan ke {dest_chat}...{Style.RESET_ALL}")
            for member in members_to_invite:
                try:
                    await asyncio.sleep(2)
                    await app.add_chat_members(dest.id, member.user.id)
                    print(f"{Fore.GREEN}[{phone_number}] ✓ Berhasil mengundang: {member.user.first_name}{Style.RESET_ALL}")
                except errors.FloodWait as e:
                    print(f"{Fore.RED}[{phone_number}] ✗ FloodWait: Menunggu {e.value} detik{Style.RESET_ALL}")
                    await asyncio.sleep(e.value)
                except errors.UserPrivacyRestricted:
                    print(f"{Fore.YELLOW}[{phone_number}] ✗ Tidak bisa mengundang (privasi): {member.user.first_name}{Style.RESET_ALL}")
                except Exception as e:
                    print(f"{Fore.RED}[{phone_number}] ✗ Gagal mengundang {member.user.first_name}: {e}{Style.RESET_ALL}")
        except errors.AuthKeyUnregistered:
            print(f"{Fore.RED}[{phone_number}] ✗ Akun ini kehilangan sesi. Menghapus dari daftar akun.{Style.RESET_ALL}")
            del self.accounts[phone_number]
            self.save_accounts()
        finally:
            await app.stop()

    def main_menu(self):
        while True:
            print(f"\n{Fore.CYAN}=== Telegram Invite Tool ==={Style.RESET_ALL}")
            print(f"{Fore.GREEN}1. Tambah Akun")
            print("2. Proses Undangan Member")
            print("3. Keluar{Style.RESET_ALL}")

            pilihan = input(f"{Fore.YELLOW}Pilih menu (1-3): {Style.RESET_ALL}")

            if pilihan == '1':
                asyncio.run(self.add_account())
            elif pilihan == '2':
                asyncio.run(self.process_invite())
            elif pilihan == '3':
                print(f"{Fore.CYAN}Sampai jumpa!{Style.RESET_ALL}")
                break
            else:
                print(f"{Fore.RED}Pilihan tidak valid! Silakan coba lagi.{Style.RESET_ALL}")


def main():
    tool = TelegramInviteTool()
    tool.main_menu()


if __name__ == "__main__":
    main()
