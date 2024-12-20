import os
import asyncio
import random
import sys
import json
import logging
import traceback
from typing import Dict, List, Tuple, Optional
from telethon import TelegramClient
from telethon.tl.functions.channels import InviteToChannelRequest
from telethon.tl.types import InputPeerChannel, InputPeerUser
from telethon.errors import (
    FloodWaitError, 
    UserPrivacyRestrictedError, 
    UserNotMutualContactError, 
    UserChannelsTooMuchError,
    ChannelInvalidError
)
from colorama import Fore, Style, init
from aiolimiter import AsyncLimiter

# Enhanced Logging Configuration
init(autoreset=True)
logging.basicConfig(
    level=logging.INFO,
    format=f'{Fore.CYAN}[%(asctime)s][%(levelname)s]{Style.RESET_ALL} %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler("invite_tool_logs.txt", encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class TelegramInvite:
    def __init__(self):
        self.accounts: Dict[str, Dict] = {}
        self.config_file = 'acck.json'
        self.sessions_dir = 'sessiond'
        
        # More robust rate limiting
        self.global_rate_limiter = AsyncLimiter(3, 10)  # 3 actions per 10 seconds
        
        # Create necessary directories
        os.makedirs(self.sessions_dir, exist_ok=True)
        self.load_accounts()
        
    def load_accounts(self):
        """Enhanced account loading with comprehensive validation."""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    loaded_accounts = json.load(f)
                
                # Comprehensive validation
                validated_accounts = {}
                for phone, account_data in loaded_accounts.items():
                    # Check for required keys
                    required_keys = ['api_id', 'api_hash', 'session_name', 'user_id', 'first_name']
                    if all(key in account_data for key in required_keys):
                        validated_accounts[phone] = account_data
                    else:
                        logger.warning(f"Skipping invalid account: {phone}")
                
                self.accounts = validated_accounts
                logger.info(f"Loaded {len(self.accounts)} valid accounts")
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Error loading accounts: {e}")
            self.accounts = {}

    def save_accounts(self):
        """Enhanced account saving with error handling."""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.accounts, f, indent=4, ensure_ascii=False)
            logger.info("Accounts saved successfully")
        except IOError as e:
            logger.error(f"Failed to save accounts: {e}")

    def display_banner(self):
        """Display a professional and minimalist banner."""
        os.system('cls' if os.name == 'nt' else 'clear')
        print(Fore.CYAN + r"""
 ╔═╗┬ ┬┌┐┌┌─┐┌─┐┬─┐
 ║  ├─┤││││ ┬├┤ ├┬┘
 ╚═╝┴ ┴┘└┘└─┘└─┘┴└─
        """ + Style.RESET_ALL)
        print(Fore.YELLOW + "Telegram Multi-Account Invite Tool" + Style.RESET_ALL)
        print(Fore.MAGENTA + "=" * 40 + Style.RESET_ALL)

    def main_menu(self):
        """Enhanced main menu with robust error handling."""
        while True:
            try:
                # Clear screen and display banner
                self.display_banner()

                # Menu options
                print(f"""
{Fore.GREEN}1. Add Telegram Account{Style.RESET_ALL}
{Fore.GREEN}2. Invite Group Members{Style.RESET_ALL}
{Fore.GREEN}3. View Saved Accounts{Style.RESET_ALL}
{Fore.GREEN}4. Remove Account{Style.RESET_ALL}
{Fore.GREEN}5. Exit{Style.RESET_ALL}
                """)

                # Get user choice
                choice = input(f"{Fore.YELLOW}Select Menu Option (1-5): {Style.RESET_ALL}").strip()

                # Process choice
                if choice == '1':
                    asyncio.run(self.add_telegram_account())
                elif choice == '2':
                    asyncio.run(self.invite_members())
                elif choice == '3':
                    self.view_accounts()
                elif choice == '4':
                    self.remove_account()
                elif choice == '5':
                    print(f"{Fore.CYAN}Thank you for using Telegram Invite Tool! Goodbye.{Style.RESET_ALL}")
                    break
                else:
                    print(f"{Fore.RED}✗ Invalid option! Please select a number between 1 and 5.{Style.RESET_ALL}")

            except KeyboardInterrupt:
                print(f"\n{Fore.CYAN}Operation cancelled by user. Returning to menu.{Style.RESET_ALL}")
            except Exception as e:
                logger.error(f"Unexpected error in main menu: {e}")
                print(f"{Fore.RED}✗ An unexpected error occurred: {e}{Style.RESET_ALL}")

            # Pause before next iteration
            input(f"\n{Fore.YELLOW}Press Enter to return to the main menu...{Style.RESET_ALL}")

    async def add_telegram_account(self):
        """Enhanced account addition with more robust error handling."""
        print(f"{Fore.CYAN}[Add Telegram Account]{Style.RESET_ALL}")

        try:
            # Collect account details
            api_id = input(f"{Fore.YELLOW}Enter API ID: {Style.RESET_ALL}")
            api_hash = input(f"{Fore.YELLOW}Enter API Hash: {Style.RESET_ALL}")
            phone_number = input(f"{Fore.YELLOW}Enter Phone Number (with country code, e.g., +62xxx): {Style.RESET_ALL}")

            # Validate input
            if not all([api_id, api_hash, phone_number]):
                logger.error("All fields are required")
                print(f"{Fore.RED}✗ All fields are mandatory!{Style.RESET_ALL}")
                return

            # Prepare session path
            session_path = os.path.join(self.sessions_dir, phone_number)

            # Custom client configuration for iPhone 16 Pro Max
            client = TelegramClient(
                session=session_path,
                api_id=api_id,
                api_hash=api_hash,
                device_model="iPhone 16 Pro Max",  # Custom device model
                system_version="iOS 18",          # Custom iOS version
                app_version="10.0 (iOS)",         # Adjusted app version
                lang_code="en"                    # Default language code
            )
            
            # Connect and send code
            await client.connect()
            send_code_result = await client.send_code_request(phone_number)

            # Get verification code
            verification_code = input(f"{Fore.GREEN}Enter OTP Code: {Style.RESET_ALL}")

            try:
                await client.sign_in(phone_number, verification_code)
            except SessionPasswordNeededError:
                password = input(f"{Fore.YELLOW}Enter your password: {Style.RESET_ALL}")
                try:
                    await client.sign_in(password=password)
                except Exception as password_error:
                    logger.error(f"Password authentication failed: {password_error}")
                    print(f"{Fore.RED}✗ Password authentication failed: {password_error}{Style.RESET_ALL}")
                    return
            except Exception as login_error:
                logger.error(f"Login failed: {login_error}")
                print(f"{Fore.RED}✗ Login failed: {login_error}{Style.RESET_ALL}")
                return

            # Get user information
            me = await client.get_me()

            # Store account details
            self.accounts[phone_number] = {
                'api_id': str(api_id),
                'api_hash': api_hash,
                'session_name': session_path,
                'user_id': me.id,
                'username': me.username or 'N/A',
                'first_name': me.first_name or 'N/A',
                'last_name': me.last_name or 'N/A'
            }

            # Save accounts and close client
            self.save_accounts()
            await client.disconnect()

            print(f"{Fore.GREEN}✓ Account {me.first_name} added successfully!{Style.RESET_ALL}")

        except Exception as e:
            logger.error(f"Error adding account: {e}")
            print(f"{Fore.RED}✗ Failed to add account: {e}{Style.RESET_ALL}")
            
    async def invite_members(self):
        """Enhanced member invitation with multi-account support."""
        if not self.accounts:
            print(f"{Fore.RED}✗ No accounts saved!{Style.RESET_ALL}")
            return

        # Display and select accounts
        self.view_accounts()
        selected_accounts = self._select_accounts()

        if not selected_accounts:
            print(f"{Fore.RED}✗ No accounts selected!{Style.RESET_ALL}")
            return

        # Collect invitation details
        source_group = input(f"{Fore.YELLOW}Enter source group username/link: {Style.RESET_ALL}")
        dest_group = input(f"{Fore.YELLOW}Enter destination group username/link: {Style.RESET_ALL}")
        
        try:
            max_invites = int(input(f"{Fore.YELLOW}Total number of members to invite: {Style.RESET_ALL}"))
        except ValueError:
            print(f"{Fore.RED}✗ Input must be a number!{Style.RESET_ALL}")
            return

        # Distribute invite tasks across selected accounts
        invite_tasks = []
        num_selected_accounts = len(selected_accounts)
        
        # Calculate member distribution
        members_per_account = max_invites // num_selected_accounts
        extra_members = max_invites % num_selected_accounts

        for idx, phone in enumerate(selected_accounts):
            account_info = self.accounts[phone]
            
            # Calculate start and end indices for member distribution
            start_idx = idx * members_per_account
            end_idx = start_idx + members_per_account + (extra_members if idx == num_selected_accounts - 1 else 0)
            
            invite_task = self._process_account_invites(
                account_info, 
                source_group, 
                dest_group, 
                start_idx, 
                end_idx
            )
            invite_tasks.append(invite_task)

        # Run invite tasks concurrently
        invite_results = await asyncio.gather(*invite_tasks, return_exceptions=True)
        
        # Display comprehensive results
        self._display_invite_summary(selected_accounts, invite_results)

    async def _process_account_invites(
        self, 
        account_info: Dict, 
        source_group: str, 
        dest_group: str, 
        start_idx: int, 
        end_idx: int
    ) -> Dict:
        """Process invites for a single account with detailed logging."""
        logger.info(f"Starting invite process for account: {account_info['first_name']}")
        
        async def get_invite_participants(client, source_group):
            """Helper to fetch participants with error handling."""
            try:
                return await client.get_participants(source_group)
            except Exception as e:
                logger.error(f"Error fetching participants: {e}")
                return []

        async def safe_invite_member(client, group, user):
            """Safely invite a single member with comprehensive error handling."""
            try:
                async with self.global_rate_limiter:
                    await client.send_message(group, '/start')  # Ensure bot interaction
                    result = await client(InviteToChannelRequest(
                        channel=group,
                        users=[user]
                    ))
                    return True, None
            except FloodWaitError as flood:
                logger.warning(f"Flood wait: {flood.seconds} seconds")
                return False, f"Flood Wait ({flood.seconds}s)"
            except (UserPrivacyRestrictedError, UserNotMutualContactError) as privacy_err:
                return False, str(privacy_err)
            except UserChannelsTooMuchError:
                return False, "User in too many channels"
            except Exception as e:
                return False, str(e)

        result = {
            'account_name': account_info['first_name'],
            'total_attempted': 0,
            'successful_invites': 0,
            'failed_invites': 0,
            'errors': []
        }

        # Create Telegram client
        client = TelegramClient(
            account_info['session_name'], 
            account_info['api_id'], 
            account_info['api_hash']
        )

        try:
            await client.connect()
            
            # Fetch source group participants
            participants = await get_invite_participants(client, source_group)
            
            # Slice participants based on distribution
            participants_to_invite = participants[start_idx:end_idx]
            
            # Invite participants
            for user in participants_to_invite:
                result['total_attempted'] += 1
                
                invite_success, error_msg = await safe_invite_member(client, dest_group, user)
                
                if invite_success:
                    result['successful_invites'] += 1
                    logger.info(f"Successfully invited {user.first_name}")
                else:
                    result['failed_invites'] += 1
                    result['errors'].append(f"{user.first_name}: {error_msg}")
                    logger.warning(f"Failed to invite {user.first_name}: {error_msg}")

                # Random delay to mimic human behavior
                await asyncio.sleep(random.uniform(3, 7))

        except Exception as e:
            logger.error(f"Critical error in invite process: {e}")
            result['errors'].append(str(e))
        finally:
            await client.disconnect()

        return result

    def _display_invite_summary(self, accounts, results):
        """Comprehensive invite summary with detailed logging."""
        print("\n" + "=" * 50)
        print(f"{Fore.CYAN}Invite Process Summary{Style.RESET_ALL}")

        total_attempted = 0
        total_successful = 0
        total_failed = 0

        for account, result in zip(accounts, results):
            # Handle potential exceptions in results
            if isinstance(result, Exception):
                logger.error(f"Exception in account {account}: {result}")
                continue

            print(f"\n{Fore.YELLOW}Account: {result['account_name']}{Style.RESET_ALL}")
            print(f"Total Attempted: {result['total_attempted']}")
            print(f"Successful Invites: {result['successful_invites']}")
            print(f"Failed Invites: {result['failed_invites']}")

            total_attempted += result['total_attempted']
            total_successful += result['successful_invites']
            total_failed += result['failed_invites']

            # Log detailed errors
            if result['errors']:
                print(f"{Fore.RED}Errors:{Style.RESET_ALL}")
                for error in result['errors'][:10]:  # Limit to first 10 errors
                    print(f"- {error}")

        print("\n" + "=" * 50)
        print(f"{Fore.GREEN}Total Attempted: {total_attempted}{Style.RESET_ALL}")
        print(f"{Fore.GREEN}Total Successful: {total_successful}{Style.RESET_ALL}")
        print(f"{Fore.RED}Total Failed: {total_failed}{Style.RESET_ALL}")

    def _select_accounts(self) -> List[str]:
        """Enhanced account selection with comprehensive input handling."""
        if len(self.accounts) == 1:
            return list(self.accounts.keys())

        print(f"\n{Fore.CYAN}Select Accounts for Invite Process:{Style.RESET_ALL}")
        
        # Display accounts with indices
        account_list = list(self.accounts.keys())
        for i, phone in enumerate(account_list, 1):
            account = self.accounts[phone]
            print(f"{i}. {phone} - {account['first_name']} {account.get('last_name', '')}")
        
        print("\nEnter account numbers (comma-separated)")
        
        while True:
            selections = input(f"{Fore.YELLOW}Your Selection: {Style.RESET_ALL}")
            
            try:
                # Validate and convert selections
                selected_indices = [int(sel.strip()) for sel in selections.split(',')]
                
                # Validate indices
                if all(1 <= idx <= len(account_list) for idx in selected_indices):
                    return [account_list[idx-1] for idx in selected_indices]
                
                print(f"{Fore.RED}✗ Invalid selection. Please enter valid account numbers.{Style.RESET_ALL}")
            
            except ValueError:
                print(f"{Fore.RED}✗ Invalid input. Please enter numbers separated by commas.{Style.RESET_ALL}")

    def view_accounts(self):
        """Enhanced account viewing with more details."""
        if not self.accounts:
            print(f"{Fore.RED}No accounts saved.{Style.RESET_ALL}")
            return

        print(f"\n{Fore.CYAN}Saved Telegram Accounts:{Style.RESET_ALL}")

        for phone, account in self.accounts.items():
            print(f"{Fore.YELLOW}Phone: {phone}")
            print(f"Name: {account['first_name']} {account.get('last_name', '')}")
            print(f"Username: {account.get('username', 'N/A')}")
            print(f"User ID: {account['user_id']}{Style.RESET_ALL}")
            print("-" * 30)

    def remove_account(self):
        """Enhanced account removal with comprehensive cleanup."""
        self.view_accounts()
        
        if not self.accounts:
            return

        phone = input(f"{Fore.YELLOW}Enter phone number of account to remove: {Style.RESET_ALL}")

        if phone in self.accounts:
            # Attempt to remove session file
            session_path = self.accounts[phone]['session_name']
            
            try:
                # Remove session file if it exists
                if os.path.exists(session_path):
                    os.remove(session_path)
                    logger.info(f"Session file for {phone} removed")

                # Remove account from dictionary
                del self.accounts[phone]
                
                # Save updated accounts
                self.save_accounts()
                
                print(f"{Fore.GREEN}✓ Account successfully removed!{Style.RESET_ALL}")
                logger.info(f"Account {phone} removed successfully")
            
            except Exception as e:
                logger.error(f"Error removing account {phone}: {e}")
                print(f"{Fore.RED}✗ Failed to remove account: {e}{Style.RESET_ALL}")

        else:
            print(f"{Fore.RED}✗ Account not found!{Style.RESET_ALL}")


def main():
    """Main entry point for the Telegram Invite Tool."""
    try:
        # Initialize tool
        tool = TelegramInvite()

        # Display the banner
        tool.display_banner()

        # Run main menu
        tool.main_menu()

    except KeyboardInterrupt:
        print("\nOperation cancelled by user. Exiting program.")
    except Exception as e:
        # Log critical errors with traceback
        import traceback, sys
        print(f"Critical error: {traceback.format_exc()}")
        print(f"✗ A critical error occurred: {e}")
        sys.exit(1)

# Ensure the script can be run directly
if __name__ == "__main__":
    main()
