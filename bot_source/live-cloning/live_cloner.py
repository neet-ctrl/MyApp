#!/usr/bin/env python3
"""
Live Cloning Bot - Web Interface Integration
Based on telegram-live-sender by mehdiirh
Adapted for web-based control and management
"""

import sys
import os
import json
import logging
import asyncio
import signal
from typing import Dict, List, Any, Optional
from datetime import datetime
import time
import re

# Add current directory to Python path
sys.path.append(os.path.dirname(__file__))

from telethon.sync import TelegramClient
from telethon import events
from telethon.tl.custom import Message
from telethon.errors import SessionPasswordNeededError, PhoneCodeInvalidError

# Configure logging
logging.basicConfig(
    format='[%(levelname) 5s/%(asctime)s] %(name)s: %(message)s',
    level=logging.INFO
)

class LiveCloner:
    def __init__(self, session_string: str = None, config_path: str = None):
        self.session_string = session_string
        self.config_path = config_path or 'config.json'
        self.client: Optional[TelegramClient] = None
        self.config = self.load_config()
        self.is_running = False
        self.processed_messages = 0
        self.status_file = 'status.json'
        self.log_file = 'live_cloner.log'
        
        # Initialize with default config if not exists
        if not os.path.exists(self.config_path):
            self.save_default_config()
            
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)

    def signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        logging.info(f"Received signal {signum}, shutting down gracefully...")
        self.is_running = False
        if self.client:
            try:
                self.client.disconnect()
            except:
                pass
        sys.exit(0)

    def load_config(self) -> Dict:
        """Load configuration from file"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logging.error(f"Error loading config: {e}")
        
        return self.get_default_config()

    def get_default_config(self) -> Dict:
        """Get default configuration"""
        return {
            "api_id": int(os.getenv('TG_API_ID', '21')),
            "api_hash": os.getenv('TG_API_HASH', 'default_hash'),
            "bot_enabled": True,
            "sudo": [],
            "filter_words": True,
            "add_signature": False,
            "signature": "",
            "entities": [],
            "filters": []
        }

    def save_default_config(self):
        """Save default configuration to file"""
        config = self.get_default_config()
        with open(self.config_path, 'w') as f:
            json.dump(config, f, indent=2)

    def update_config(self, new_config: Dict):
        """Update configuration and save to file"""
        self.config.update(new_config)
        with open(self.config_path, 'w') as f:
            json.dump(self.config, f, indent=2)

    def update_status(self, status_data: Dict):
        """Update status file with current state"""
        status = {
            "running": self.is_running,
            "processed_messages": self.processed_messages,
            "last_activity": datetime.now().isoformat(),
            "session_valid": self.client and self.client.is_connected() if self.client else False,
            "bot_enabled": self.config.get("bot_enabled", True),
            "filter_words": self.config.get("filter_words", True),
            "add_signature": self.config.get("add_signature", False),
            "signature": self.config.get("signature", ""),
            "total_links": len(self.config.get("entities", [])),
            **status_data
        }
        
        with open(self.status_file, 'w') as f:
            json.dump(status, f, indent=2)

    async def test_session(self) -> Dict:
        """Test session string validity and return user info"""
        try:
            if not self.session_string:
                raise ValueError("Session string not provided")
            
            client = TelegramClient("temp_session", self.config["api_id"], self.config["api_hash"])
            
            # Import session from string
            await client.start(session=self.session_string)
            
            if await client.is_user_authorized():
                me = await client.get_me()
                user_info = {
                    "id": me.id,
                    "username": me.username or "No username",
                    "firstName": me.first_name or "Unknown",
                    "lastName": me.last_name or ""
                }
                await client.disconnect()
                return {"success": True, "userInfo": user_info}
            else:
                await client.disconnect()
                return {"success": False, "error": "Session not authorized"}
                
        except Exception as e:
            logging.error(f"Session test failed: {e}")
            return {"success": False, "error": str(e)}

    async def start_client(self):
        """Initialize and start Telegram client"""
        try:
            if not self.session_string:
                raise ValueError("Session string is required")
            
            self.client = TelegramClient("live_cloner", self.config["api_id"], self.config["api_hash"])
            
            # Start client with session string
            await self.client.start(session=self.session_string)
            
            if not await self.client.is_user_authorized():
                raise ValueError("Session is not authorized")
            
            me = await self.client.get_me()
            logging.info(f"Connected as: {me.first_name} (@{me.username}) - ID: {me.id}")
            
            # Register event handlers
            self.register_event_handlers()
            
            return True
            
        except Exception as e:
            logging.error(f"Failed to start client: {e}")
            self.update_status({"error": str(e)})
            return False

    def register_event_handlers(self):
        """Register Telegram event handlers"""
        
        @self.client.on(events.NewMessage(incoming=True))
        async def check_status(message: Message):
            if not self.config.get("bot_enabled", True):
                return
            
            # Allow messages from self and sudo users
            if await message.get_sender() == await self.client.get_me() or message.sender_id in self.config.get("sudo", []):
                return
            else:
                raise events.StopPropagation

        @self.client.on(events.NewMessage())
        async def forwarder(message: Message):
            try:
                chat_id = message.chat.id if message.chat else message.chat_id
            except AttributeError:
                chat_id = message.chat_id

            # Check if this chat has any forwarding rules
            entities = self.config.get("entities", [])
            target_entities = []
            
            for entity_pair in entities:
                if len(entity_pair) >= 2 and entity_pair[0] == chat_id:
                    target_entities.append(entity_pair[1])

            if not target_entities:
                return

            # Handle polls differently
            if message.poll:
                for target in target_entities:
                    await message.forward_to(target)
                self.processed_messages += 1
                return

            message_text = message.text or ""

            # Apply word filters if enabled
            if self.config.get("filter_words", True):
                for filter_pair in self.config.get("filters", []):
                    if len(filter_pair) >= 2:
                        from_word, to_word = filter_pair[0], filter_pair[1]
                        message_text = re.sub(r'(?i){}'.format(re.escape(from_word)), to_word, message_text)

            # Add signature if enabled
            if self.config.get("add_signature", False) and self.config.get("signature"):
                if message_text:
                    message_text = f"{message_text}\n\n{self.config['signature']}"

            # Handle reply messages
            replied_message = None
            reply_to = None
            if message.is_reply:
                replied_message = await message.get_reply_message()
                replied_message_id = replied_message.id if replied_message else None

            # Forward to all target entities
            for target in target_entities:
                try:
                    if message.media:
                        # Forward media messages
                        sent_message = await self.client.send_message(
                            target, 
                            message_text, 
                            file=message.media,
                            reply_to=reply_to
                        )
                    else:
                        # Send text message
                        sent_message = await self.client.send_message(
                            target, 
                            message_text, 
                            reply_to=reply_to
                        )
                    
                    # Store message mapping for replies
                    self.store_message_mapping(chat_id, message.id, target, sent_message.id)
                    
                except Exception as e:
                    logging.error(f"Failed to forward message to {target}: {e}")
                
                # Small delay between forwards
                await asyncio.sleep(0.5)

            self.processed_messages += 1
            
            # Update status periodically
            if self.processed_messages % 10 == 0:
                self.update_status({})

        # Admin command handlers
        self.register_admin_commands()

    def register_admin_commands(self):
        """Register admin command handlers"""
        
        @self.client.on(events.NewMessage(incoming=True))
        async def forbid_non_sudo_commands(message: Message):
            sender = await message.get_sender()
            me = await self.client.get_me()
            if sender == me or message.sender_id in self.config.get("sudo", []):
                return
            else:
                raise events.StopPropagation

        @self.client.on(events.NewMessage(pattern=r'^[Ss]ync$'))
        async def sync_dialogs(message: Message):
            replied_message = await message.respond('Syncing dialogs...')
            try:
                dialogs = await self.client.get_dialogs()
                await replied_message.edit(f"✅ Successfully synced {len(dialogs)} chats")
            except Exception as e:
                await replied_message.edit(f'❗️ Error in syncing chats:\n {e}')

        @self.client.on(events.NewMessage(
            pattern=r'^[Ll]ink @?(-?[1-9a-zA-Z][a-zA-Z0-9_]{4,}) to @?(-?[1-9a-zA-Z][a-zA-Z0-9_]{4,})$'))
        async def link_entities(message: Message):
            msg = message.raw_text.replace('@', '')
            pattern = re.compile(r'^[Ll]ink @?(-?[1-9a-zA-Z][a-zA-Z0-9_]{4,}) to @?(-?[1-9a-zA-Z][a-zA-Z0-9_]{4,})$')
            match = pattern.match(msg)
            
            if not match:
                return

            processing = await message.reply('Processing...')
            base_entity_str = match.group(1).lower()
            target_entity_str = match.group(2).lower()

            try:
                base_entity_id = int(base_entity_str)
            except ValueError:
                base_entity_id = base_entity_str

            try:
                target_entity_id = int(target_entity_str)
            except ValueError:
                target_entity_id = target_entity_str

            try:
                base_entity = await self.client.get_entity(base_entity_id)
                target_entity = await self.client.get_entity(target_entity_id)
                
                # Add to config
                entities = self.config.get("entities", [])
                new_config = [base_entity.id, target_entity.id]
                
                # Check for cycles
                for config in entities:
                    if len(config) >= 2 and config[0] == target_entity.id and config[1] == base_entity.id:
                        await processing.edit('❗️ Cycle detected! This would cause an infinite loop.')
                        return
                
                if new_config not in entities:
                    entities.append(new_config)
                    self.config["entities"] = entities
                    self.update_config(self.config)
                    
                    base_title = getattr(base_entity, 'title', getattr(base_entity, 'first_name', 'Unknown'))
                    target_title = getattr(target_entity, 'title', getattr(target_entity, 'first_name', 'Unknown'))
                    
                    await processing.edit(f"✅ [ `{base_title}` ] linked to [ `{target_title}` ]")
                else:
                    await processing.edit('❗️ This link already exists')
                    
            except Exception as e:
                await processing.edit(f'❗️ Error: {e}')

        @self.client.on(events.NewMessage(pattern=r'^[Uu]nlink @?(-?[1-9a-zA-Z][a-zA-Z0-9_]{4,})$'))
        async def unlink_entities(message: Message):
            msg = message.raw_text.replace('@', '')
            pattern = re.compile(r'^[Uu]nlink @?([1-9a-zA-Z][a-zA-Z0-9_]{4,})$')
            match = pattern.match(msg)
            
            if not match:
                return

            processing = await message.reply('Processing...')
            base_entity_str = match.group(1).lower()

            try:
                base_entity_id = int(base_entity_str)
            except ValueError:
                base_entity_id = base_entity_str

            try:
                base_entity = await self.client.get_entity(base_entity_id)
                entities = self.config.get("entities", [])
                
                count = 0
                for config in entities[:]:
                    if len(config) >= 2 and config[0] == base_entity.id:
                        entities.remove(config)
                        count += 1
                
                if count > 0:
                    self.config["entities"] = entities
                    self.update_config(self.config)
                    
                    base_title = getattr(base_entity, 'title', getattr(base_entity, 'first_name', 'Unknown'))
                    await processing.edit(f"✅ [ `{base_title}` ] unlinked from {count} entities")
                else:
                    await processing.edit('❗️ No links found for this entity')
                    
            except Exception as e:
                await processing.edit(f'❗️ Error: {e}')

        # Additional command handlers for filters, settings, etc.
        self.register_filter_commands()
        self.register_settings_commands()

    def register_filter_commands(self):
        """Register word filter command handlers"""
        
        @self.client.on(events.NewMessage(pattern=r'^[Aa]dd filter \"(.+)\" to \"(.+)\"$'))
        async def add_filter(message: Message):
            pattern = re.compile(r'^[Aa]dd filter \"(.+)\" to \"(.+)\"$')
            match = pattern.match(message.raw_text)
            
            if not match:
                return

            from_word = match.group(1)
            to_word = match.group(2)
            
            filters = self.config.get("filters", [])
            
            # Check for cycles and duplicates
            for filter_pair in filters:
                if len(filter_pair) >= 2:
                    if filter_pair[0] == to_word and filter_pair[1] == from_word:
                        await message.reply('❗️ Cycle detected! This would cause an infinite loop.')
                        return
                    if filter_pair[0] == from_word:
                        await message.reply(f'❗️ Word **{from_word}** is already filtered to **{filter_pair[1]}**')
                        return
            
            new_filter = [from_word, to_word]
            if new_filter not in filters:
                filters.append(new_filter)
                self.config["filters"] = filters
                self.update_config(self.config)
                await message.reply(f"✅ **{from_word}** will be edited to **{to_word}** (case insensitive)")
            else:
                await message.reply('❗️ This filter already exists')

        @self.client.on(events.NewMessage(pattern=r'^[Rr]emove filter \"(.+)\"$'))
        async def remove_filter(message: Message):
            pattern = re.compile(r'^[Rr]emove filter \"(.+)\"$')
            match = pattern.match(message.raw_text)
            
            if not match:
                return

            from_word = match.group(1)
            filters = self.config.get("filters", [])
            
            count = 0
            for filter_pair in filters[:]:
                if len(filter_pair) >= 2 and filter_pair[0] == from_word:
                    filters.remove(filter_pair)
                    count += 1
            
            if count > 0:
                self.config["filters"] = filters
                self.update_config(self.config)
                await message.reply(f"✅ **{from_word}** filters erased.")
            else:
                await message.reply('❗️ This filter does not exist.')

        @self.client.on(events.NewMessage(pattern=r'^[Ff]ilters$'))
        async def get_filters(message: Message):
            filters = self.config.get("filters", [])
            
            if not filters:
                await message.reply("❗️ No filters submitted.")
                return

            text = "📁 Filter list: \n\n"
            for filter_pair in filters:
                if len(filter_pair) >= 2:
                    text += f"**{filter_pair[0]}** ➡️ **{filter_pair[1]}**\n"

            await message.reply(text)

    def register_settings_commands(self):
        """Register settings command handlers"""
        
        @self.client.on(events.NewMessage(pattern=r'^[Ss]ettings'))
        async def get_settings(message: Message):
            text = "⚙️ Settings: \n\n"
            text += f"`Bot status   ` ➡ **{'On' if self.config.get('bot_enabled', True) else 'Off'}**\n"
            text += f"`Filter words ` ➡ **{'Enabled' if self.config.get('filter_words', True) else 'Disabled'}**\n"
            text += f"`Add signature` ➡ **{'Enabled' if self.config.get('add_signature', False) else 'Disabled'}**\n"
            
            if self.config.get("signature"):
                text += f"`Signature    ` ⬇️ \n**{self.config['signature']}**"
            else:
                text += "`Signature    ` ➡ **Not defined**"

            await message.reply(text)

        @self.client.on(events.NewMessage(pattern=r'^[Ll]inks'))
        async def get_linked_entities(message: Message):
            entities = self.config.get("entities", [])
            
            if not entities:
                await message.reply("❗️ There is no linked entities.")
                return

            text = "🖇 Linked entities: \n\n"
            for entity_pair in entities:
                if len(entity_pair) >= 2:
                    text += f"**{entity_pair[0]}** ➡️ **{entity_pair[1]}**\n"

            await message.reply(text)

        @self.client.on(events.NewMessage(pattern=r'^[Oo](:?n|ff)$'))
        async def change_bot_status(message: Message):
            command = message.raw_text.lower()
            
            if command == 'on':
                self.config["bot_enabled"] = True
                self.update_config(self.config)
                await message.reply('👀 Bot turned on')
            elif command == 'off':
                self.config["bot_enabled"] = False
                self.update_config(self.config)
                await message.reply('😴 Bot turned off')

        @self.client.on(events.NewMessage(pattern=r'^[Ff]ilters [Oo](:?n|ff)$'))
        async def change_filters_status(message: Message):
            pattern = re.compile(r'^[Ff]ilters ([Oo](:?n|ff))$')
            match = pattern.match(message.raw_text)
            
            if not match:
                return

            command = match.group(1).lower()
            
            if command == 'on':
                self.config["filter_words"] = True
                self.update_config(self.config)
                await message.reply('✅ Filter words enabled')
            elif command == 'off':
                self.config["filter_words"] = False
                self.update_config(self.config)
                await message.reply('✅ Filter words disabled')

        @self.client.on(events.NewMessage(pattern=r'^[Ss]ign [Oo](:?n|ff)$'))
        async def change_signature_status(message: Message):
            pattern = re.compile(r'^[Ss]ign ([Oo](:?n|ff))$')
            match = pattern.match(message.raw_text)
            
            if not match:
                return

            command = match.group(1).lower()
            
            if command == 'on':
                self.config["add_signature"] = True
                self.update_config(self.config)
                await message.reply('✅ Adding signature enabled')
            elif command == 'off':
                self.config["add_signature"] = False
                self.update_config(self.config)
                await message.reply('✅ Adding signature disabled')

        @self.client.on(events.NewMessage(pattern=r'^[Ss]ign text (.+)$'))
        async def change_signature_text(message: Message):
            pattern = re.compile(r'^[Ss]ign text (.+)$')
            match = pattern.match(message.raw_text)
            
            if not match:
                return

            signature = match.group(1)
            self.config["signature"] = signature
            self.update_config(self.config)
            await message.reply(f'✅ Signature updated:\n{signature}')

        @self.client.on(events.NewMessage(pattern=r'^[Hh]elp$'))
        async def get_help(message: Message):
            help_text = """
🤖 **Live Cloning Bot Commands**

**Entity Management:**
• `sync` - Sync all chats with bot
• `link @source to @target` - Link source to target entity
• `unlink @source` - Unlink source from all targets
• `links` - Show all linked entities

**Word Filters:**
• `add filter "word1" to "word2"` - Filter word1 to word2
• `remove filter "word1"` - Remove all filters for word1
• `filters` - Show all word filters
• `filters on|off` - Enable/disable word filtering

**Settings:**
• `settings` - Show current settings
• `on|off` - Turn bot on/off
• `sign on|off` - Enable/disable signature
• `sign text [text]` - Set signature text
• `help` - Show this help message

**Note:** Bot only responds to itself and sudo users.
            """
            await message.reply(help_text)

    def store_message_mapping(self, base_entity: int, base_message_id: int, target_entity: int, target_message_id: int):
        """Store message mapping for reply handling"""
        try:
            mapping_file = 'message_mappings.json'
            mappings = {}
            
            if os.path.exists(mapping_file):
                with open(mapping_file, 'r') as f:
                    mappings = json.load(f)
            
            key = f"{base_entity}:{base_message_id}"
            if key not in mappings:
                mappings[key] = []
            
            mappings[key].append([target_entity, target_message_id])
            
            with open(mapping_file, 'w') as f:
                json.dump(mappings, f, indent=2)
                
        except Exception as e:
            logging.error(f"Failed to store message mapping: {e}")

    async def run(self):
        """Main run loop"""
        try:
            self.is_running = True
            self.update_status({"message": "Starting live cloning bot..."})
            
            if not await self.start_client():
                self.is_running = False
                return
            
            logging.info("LIVE CLONING BOT STARTED! 🚀")
            self.update_status({"message": "Live cloning bot is running"})
            
            # Run until disconnected
            await self.client.run_until_disconnected()
            
        except Exception as e:
            logging.error(f"Error in main loop: {e}")
            self.update_status({"error": str(e)})
        finally:
            self.is_running = False
            if self.client:
                await self.client.disconnect()
            self.update_status({"message": "Bot stopped"})

    def stop(self):
        """Stop the bot gracefully"""
        logging.info("Stopping live cloning bot...")
        self.is_running = False
        if self.client:
            try:
                self.client.disconnect()
            except:
                pass

async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Live Cloning Bot')
    parser.add_argument('--session', required=True, help='Telegram session string')
    parser.add_argument('--config', help='Config file path')
    parser.add_argument('--test-session', action='store_true', help='Test session validity only')
    
    args = parser.parse_args()
    
    cloner = LiveCloner(session_string=args.session, config_path=args.config)
    
    if args.test_session:
        # Test session and exit
        result = await cloner.test_session()
        print(json.dumps(result))
        return
    
    # Run the cloner
    await cloner.run()

if __name__ == "__main__":
    asyncio.run(main())