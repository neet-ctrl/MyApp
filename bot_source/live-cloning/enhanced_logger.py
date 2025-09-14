#!/usr/bin/env python3
"""
Comprehensive Live Cloning Logger - Tracks every detail requested by user
Logs: API ID, API Hash, Session String, Account Info, Entity Links, Package Versions, File Locations, Process Flow
"""

import sys
import os
import json
import logging
import platform
import subprocess
from datetime import datetime
from typing import Dict, List, Any, Optional
import pkg_resources

class ComprehensiveLogger:
    def __init__(self, log_file: str = "comprehensive_live_cloning.log"):
        self.log_file = log_file
        self.setup_logging()
        self.session_info = {}
        self.config_info = {}
        self.entity_info = {}
        self.package_info = {}
        self.process_info = {}
        
    def setup_logging(self):
        """Setup comprehensive logging"""
        logging.basicConfig(
            level=logging.DEBUG,
            format='[%(asctime)s] %(levelname)s: %(message)s',
            handlers=[
                logging.FileHandler(self.log_file),
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger(__name__)
        
    def log_separator(self, title: str):
        """Log section separator"""
        separator = "=" * 80
        self.logger.info(f"\n{separator}")
        self.logger.info(f" {title.center(76)} ")
        self.logger.info(f"{separator}")
        
    def log_system_info(self):
        """Log comprehensive system information"""
        self.log_separator("SYSTEM INFORMATION")
        
        # Python version and platform
        self.logger.info(f"Python Version: {platform.python_version()}")
        self.logger.info(f"Platform: {platform.platform()}")
        self.logger.info(f"Architecture: {platform.architecture()}")
        self.logger.info(f"Machine: {platform.machine()}")
        self.logger.info(f"Node: {platform.node()}")
        self.logger.info(f"System: {platform.system()}")
        self.logger.info(f"Processor: {platform.processor()}")
        
        # Current working directory and file locations
        self.logger.info(f"Current Working Directory: {os.getcwd()}")
        self.logger.info(f"Script Location: {os.path.abspath(__file__)}")
        self.logger.info(f"Python Executable: {sys.executable}")
        
    def log_package_versions(self):
        """Log all package versions"""
        self.log_separator("PACKAGE VERSIONS")
        
        # Get telethon version specifically
        try:
            import telethon
            self.logger.info(f"Telethon Version: {telethon.__version__}")
            self.package_info['telethon'] = telethon.__version__
        except Exception as e:
            self.logger.error(f"Failed to get Telethon version: {e}")
            
        # Get all installed packages
        try:
            installed_packages = [d for d in pkg_resources.working_set]
            relevant_packages = ['telethon', 'cryptg', 'tgcrypto', 'aiohttp', 'requests', 'asyncio']
            
            for pkg in installed_packages:
                if any(rel in pkg.project_name.lower() for rel in relevant_packages):
                    self.logger.info(f"{pkg.project_name}: {pkg.version}")
                    self.package_info[pkg.project_name] = pkg.version
                    
        except Exception as e:
            self.logger.error(f"Failed to get package versions: {e}")
            
    def log_environment_variables(self):
        """Log environment variables (safely)"""
        self.log_separator("ENVIRONMENT VARIABLES")
        
        env_vars = ['TG_API_ID', 'TG_API_HASH', 'LIVE_CLONING_INSTANCE_ID', 'NODE_ENV', 'PATH']
        for var in env_vars:
            value = os.getenv(var)
            if var in ['TG_API_HASH']:
                # Mask sensitive data
                masked_value = value[:8] + '...' if value else 'Not Set'
                self.logger.info(f"{var}: {masked_value}")
            else:
                self.logger.info(f"{var}: {value}")
                
    def log_config_sources(self):
        """Log configuration file locations and sources"""
        self.log_separator("CONFIGURATION SOURCES")
        
        config_files = [
            'config.json',
            '../config/live_cloning_persistent_settings.json',
            '../config/bot-config.json',
            'plugins/jsons/config.json',
            'plugins/jsons/entities.json'
        ]
        
        for config_file in config_files:
            full_path = os.path.abspath(config_file)
            exists = os.path.exists(config_file)
            self.logger.info(f"Config File: {config_file}")
            self.logger.info(f"  Full Path: {full_path}")
            self.logger.info(f"  Exists: {exists}")
            
            if exists:
                try:
                    with open(config_file, 'r') as f:
                        content = json.load(f)
                        self.logger.info(f"  Content Keys: {list(content.keys())}")
                        
                        # Log specific important fields
                        if 'api_id' in content:
                            self.logger.info(f"  API ID Source: {content['api_id']}")
                            self.config_info['api_id_source'] = config_file
                            self.config_info['api_id'] = content['api_id']
                            
                        if 'api_hash' in content:
                            self.logger.info(f"  API Hash Source: {content['api_hash'][:8]}...")
                            self.config_info['api_hash_source'] = config_file
                            
                        if 'sessionString' in content:
                            self.logger.info(f"  Session String Source: {config_file}")
                            self.logger.info(f"  Session String Length: {len(content['sessionString'])}")
                            self.config_info['session_string_source'] = config_file
                            
                        if 'entities' in content and isinstance(content['entities'], list):
                            self.logger.info(f"  Entity Links Count: {len(content['entities'])}")
                            self.logger.info(f"  Entity Links: {content['entities']}")
                            self.config_info['entity_links'] = content['entities']
                            self.config_info['entity_links_source'] = config_file
                            
                except Exception as e:
                    self.logger.error(f"  Error reading {config_file}: {e}")
            self.logger.info("")
            
    def log_api_credentials(self, api_id: int, api_hash: str):
        """Log API credentials safely"""
        self.log_separator("API CREDENTIALS")
        
        self.logger.info(f"API ID: {api_id}")
        self.logger.info(f"API ID Type: {type(api_id)}")
        self.logger.info(f"API Hash: {api_hash[:8]}...")
        self.logger.info(f"API Hash Length: {len(api_hash)}")
        
        # Check if these match environment variables
        env_api_id = os.getenv('TG_API_ID')
        env_api_hash = os.getenv('TG_API_HASH')
        
        self.logger.info(f"Environment API ID: {env_api_id}")
        self.logger.info(f"Environment API Hash: {env_api_hash[:8] if env_api_hash else 'Not Set'}...")
        self.logger.info(f"API ID Matches Env: {str(api_id) == env_api_id}")
        self.logger.info(f"API Hash Matches Env: {api_hash == env_api_hash}")
        
    def log_session_details(self, session_string: str):
        """Log session string details"""
        self.log_separator("SESSION STRING DETAILS")
        
        self.logger.info(f"Session String Length: {len(session_string)}")
        self.logger.info(f"Session String First 20 chars: {session_string[:20]}...")
        self.logger.info(f"Session String Last 20 chars: ...{session_string[-20:]}")
        
        # Analyze session string format
        try:
            import base64
            # Try to decode session string
            decoded = base64.b64decode(session_string + '==')  # Add padding
            self.logger.info(f"Session String Base64 Decoded Length: {len(decoded)}")
        except Exception as e:
            self.logger.error(f"Session String Base64 Decode Error: {e}")
            
    def log_client_connection(self, client, user_info: dict):
        """Log client connection details"""
        self.log_separator("CLIENT CONNECTION DETAILS")
        
        self.logger.info(f"Connected User ID: {user_info.get('id')}")
        self.logger.info(f"Connected Username: {user_info.get('username', 'No username')}")
        self.logger.info(f"Connected First Name: {user_info.get('firstName', 'Unknown')}")
        self.logger.info(f"Connected Last Name: {user_info.get('lastName', '')}")
        self.logger.info(f"Client Connection State: {client.is_connected()}")
        
        # Log client details
        try:
            self.logger.info(f"Client DC ID: {getattr(client, '_dc_id', 'Unknown')}")
            self.logger.info(f"Client Session: {type(client.session).__name__}")
        except Exception as e:
            self.logger.error(f"Error getting client details: {e}")
            
    def log_entity_resolution_process(self, entities: List[List[int]]):
        """Log detailed entity resolution process"""
        self.log_separator("ENTITY RESOLUTION PROCESS")
        
        self.logger.info(f"Total Entity Pairs to Process: {len(entities)}")
        
        # Collect all unique entity IDs
        unique_entities = set()
        for entity_pair in entities:
            if len(entity_pair) >= 2:
                unique_entities.add(entity_pair[0])
                unique_entities.add(entity_pair[1])
                
        self.logger.info(f"Unique Entity IDs: {list(unique_entities)}")
        
        # Log entity ID analysis
        for entity_id in unique_entities:
            self.logger.info(f"Entity ID: {entity_id}")
            self.logger.info(f"  Type: {type(entity_id)}")
            self.logger.info(f"  Value Range Check: {-2147483648 <= entity_id <= 2147483647}")
            self.logger.info(f"  Is 32-bit safe: {-2147483648 <= entity_id <= 2147483647}")
            self.logger.info(f"  Is 64-bit: {entity_id > 2147483647}")
            
            # Log binary representation
            try:
                self.logger.info(f"  Binary: {bin(entity_id)}")
                self.logger.info(f"  Hex: {hex(entity_id)}")
            except Exception as e:
                self.logger.error(f"  Error converting {entity_id}: {e}")
                
    def log_entity_resolution_attempt(self, entity_id: int, success: bool, result=None, error=None):
        """Log individual entity resolution attempt"""
        self.logger.info(f"Resolving Entity {entity_id}:")
        self.logger.info(f"  Success: {success}")
        
        if success and result:
            entity_name = getattr(result, 'title', getattr(result, 'first_name', f'ID:{entity_id}'))
            entity_type = type(result).__name__
            self.logger.info(f"  Name: {entity_name}")
            self.logger.info(f"  Type: {entity_type}")
            self.logger.info(f"  ID: {getattr(result, 'id', 'Unknown')}")
        elif error:
            self.logger.error(f"  Error: {error}")
            self.logger.error(f"  Error Type: {type(error).__name__}")
            
            # Special handling for struct.error
            if 'struct.error' in str(error):
                self.logger.error(f"  32-bit Integer Overflow Detected!")
                self.logger.error(f"  Entity ID {entity_id} > 2147483647 (32-bit max)")
                self.logger.error(f"  This indicates Telethon version compatibility issue")
                
    def log_telethon_analysis(self):
        """Analyze Telethon configuration and capabilities"""
        self.log_separator("TELETHON ANALYSIS")
        
        try:
            import telethon
            from telethon import version
            
            self.logger.info(f"Telethon Version: {version.__version__}")
            self.logger.info(f"Telethon Location: {telethon.__file__}")
            
            # Check if cryptg is available
            try:
                import cryptg
                self.logger.info(f"Cryptg Available: Yes, Version: {cryptg.__version__ if hasattr(cryptg, '__version__') else 'Unknown'}")
            except ImportError:
                self.logger.info("Cryptg Available: No")
                
            # Check struct module capabilities
            import struct
            self.logger.info(f"Struct Module: {struct}")
            
            # Test 32-bit vs 64-bit integer handling
            test_ids = [4949360302, 8154976061, 7634388518, 7521656991]
            for test_id in test_ids:
                try:
                    packed = struct.pack('i', test_id)
                    self.logger.info(f"Entity {test_id}: 32-bit pack SUCCESS")
                except struct.error as e:
                    self.logger.error(f"Entity {test_id}: 32-bit pack FAILED - {e}")
                    
        except Exception as e:
            self.logger.error(f"Telethon analysis failed: {e}")
            
    def log_command_line_args(self):
        """Log command line arguments"""
        self.log_separator("COMMAND LINE ARGUMENTS")
        
        self.logger.info(f"Script Name: {sys.argv[0]}")
        self.logger.info(f"Arguments Count: {len(sys.argv) - 1}")
        for i, arg in enumerate(sys.argv[1:], 1):
            if '--session' in sys.argv and i == sys.argv.index('--session') + 1:
                self.logger.info(f"Arg {i}: {arg[:20]}... (Session String)")
            else:
                self.logger.info(f"Arg {i}: {arg}")
                
    def log_dialogs_sync(self, dialogs_count: int, dialogs_info: List = None):
        """Log dialog synchronization details"""
        self.log_separator("DIALOGS SYNCHRONIZATION")
        
        self.logger.info(f"Total Dialogs Synced: {dialogs_count}")
        
        if dialogs_info:
            self.logger.info("Dialog Details:")
            for i, dialog in enumerate(dialogs_info[:10]):  # Log first 10
                try:
                    dialog_name = getattr(dialog.entity, 'title', getattr(dialog.entity, 'first_name', 'Unknown'))
                    dialog_id = getattr(dialog.entity, 'id', 'Unknown')
                    dialog_type = type(dialog.entity).__name__
                    self.logger.info(f"  {i+1}. {dialog_name} (ID: {dialog_id}, Type: {dialog_type})")
                except Exception as e:
                    self.logger.error(f"  {i+1}. Error getting dialog info: {e}")
                    
            if len(dialogs_info) > 10:
                self.logger.info(f"  ... and {len(dialogs_info) - 10} more dialogs")
                
    def create_summary_report(self):
        """Create a summary report of all logged information"""
        self.log_separator("COMPREHENSIVE SUMMARY REPORT")
        
        summary = {
            "timestamp": datetime.now().isoformat(),
            "system_info": {
                "python_version": platform.python_version(),
                "platform": platform.platform(),
                "working_directory": os.getcwd()
            },
            "package_info": self.package_info,
            "config_info": self.config_info,
            "session_info": self.session_info,
            "entity_info": self.entity_info,
            "process_info": self.process_info
        }
        
        summary_file = f"live_cloning_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
            
        self.logger.info(f"Summary report saved to: {summary_file}")
        
        # Log key findings
        self.logger.info("KEY FINDINGS:")
        self.logger.info(f"  - API ID: {self.config_info.get('api_id', 'Unknown')}")
        self.logger.info(f"  - Session String Source: {self.config_info.get('session_string_source', 'Unknown')}")
        self.logger.info(f"  - Entity Links Source: {self.config_info.get('entity_links_source', 'Unknown')}")
        self.logger.info(f"  - Entity Links Count: {len(self.config_info.get('entity_links', []))}")
        self.logger.info(f"  - Telethon Version: {self.package_info.get('telethon', 'Unknown')}")
        
        return summary

# Export the logger for use in live_cloner.py
comprehensive_logger = ComprehensiveLogger()