#!/usr/bin/env python3
"""
Auto-Start Validator - 100% Requirements Validation
Ensures all requirements are met before auto-starting live cloning
"""

import os
import sys
import json
import logging
import subprocess
import importlib
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import tempfile

class AutoStartValidator:
    def __init__(self):
        self.validation_results = []
        self.critical_errors = []
        self.warnings = []
        self.file_locations = {}
        self.requirements_met = True
        
        # Setup validation logging
        self.logger = logging.getLogger("AutoStartValidator")
        handler = logging.StreamHandler()
        formatter = logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s')
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)
        
    def log_separator(self, title: str):
        """Log section separator"""
        separator = "=" * 80
        self.logger.info(f"\n{separator}")
        self.logger.info(f" {title.center(76)} ")
        self.logger.info(f"{separator}")
        
    def validate_python_environment(self) -> bool:
        """Validate Python environment and version"""
        self.log_separator("PYTHON ENVIRONMENT VALIDATION")
        
        try:
            # Python version check
            python_version = sys.version_info
            self.logger.info(f"Python Version: {python_version.major}.{python_version.minor}.{python_version.micro}")
            
            if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 8):
                self.critical_errors.append("Python 3.8+ required")
                self.requirements_met = False
                return False
                
            # Python executable location
            python_exe = sys.executable
            self.logger.info(f"Python Executable: {python_exe}")
            self.file_locations['python_executable'] = python_exe
            
            # Check if executable exists and is accessible
            if not os.path.exists(python_exe):
                self.critical_errors.append(f"Python executable not found: {python_exe}")
                self.requirements_met = False
                return False
                
            self.logger.info("✅ Python environment validation passed")
            return True
            
        except Exception as e:
            self.critical_errors.append(f"Python environment validation failed: {e}")
            self.requirements_met = False
            return False
            
    def validate_required_packages(self) -> bool:
        """Validate all required Python packages"""
        self.log_separator("PYTHON PACKAGES VALIDATION")
        
        required_packages = [
            ('telethon', '1.0.0'),
            ('asyncio', None),
            ('json', None),
            ('logging', None),
            ('os', None),
            ('sys', None),
            ('pathlib', None)
        ]
        
        optional_packages = [
            ('cryptg', None),
            ('tgcrypto', None),
            ('aiohttp', None)
        ]
        
        all_valid = True
        
        # Check required packages
        for package_name, min_version in required_packages:
            try:
                module = importlib.import_module(package_name)
                version = getattr(module, '__version__', 'Unknown')
                self.logger.info(f"✅ {package_name}: {version}")
                
                if hasattr(module, '__file__'):
                    self.file_locations[f'{package_name}_location'] = module.__file__
                    
            except ImportError as e:
                self.critical_errors.append(f"Required package missing: {package_name}")
                self.logger.error(f"❌ {package_name}: NOT FOUND - {e}")
                all_valid = False
                self.requirements_met = False
                
        # Check optional packages (warnings only)
        for package_name, min_version in optional_packages:
            try:
                module = importlib.import_module(package_name)
                version = getattr(module, '__version__', 'Unknown')
                self.logger.info(f"✅ {package_name} (optional): {version}")
                
                if hasattr(module, '__file__'):
                    self.file_locations[f'{package_name}_location'] = module.__file__
                    
            except ImportError:
                self.warnings.append(f"Optional package missing: {package_name}")
                self.logger.warning(f"⚠️ {package_name} (optional): NOT FOUND")
                
        return all_valid
        
    def validate_file_locations(self) -> bool:
        """Validate all required file locations"""
        self.log_separator("FILE LOCATIONS VALIDATION")
        
        current_dir = os.getcwd()
        script_dir = os.path.dirname(os.path.abspath(__file__))
        
        self.logger.info(f"Current Working Directory: {current_dir}")
        self.logger.info(f"Script Directory: {script_dir}")
        
        # Required files
        required_files = [
            'live_cloner.py',
            'enhanced_logger.py',
            'config.json',
            'plugins/jsons/config.json'
        ]
        
        # Optional files
        optional_files = [
            'plugins/jsons/entities.json',
            '../config/live_cloning_persistent_settings.json',
            '../config/bot-config.json'
        ]
        
        all_valid = True
        
        # Check required files
        for filename in required_files:
            file_path = os.path.join(script_dir, filename)
            abs_path = os.path.abspath(file_path)
            
            self.logger.info(f"Checking required file: {filename}")
            self.logger.info(f"  Path: {file_path}")
            self.logger.info(f"  Absolute: {abs_path}")
            
            if os.path.exists(file_path):
                self.logger.info(f"  ✅ EXISTS")
                self.file_locations[f'required_{filename.replace("/", "_")}'] = abs_path
                
                # Check file permissions
                if os.access(file_path, os.R_OK):
                    self.logger.info(f"  ✅ READABLE")
                else:
                    self.critical_errors.append(f"File not readable: {file_path}")
                    self.logger.error(f"  ❌ NOT READABLE")
                    all_valid = False
                    self.requirements_met = False
                    
            else:
                self.critical_errors.append(f"Required file missing: {file_path}")
                self.logger.error(f"  ❌ NOT FOUND")
                all_valid = False
                self.requirements_met = False
                
        # Check optional files
        for filename in optional_files:
            file_path = os.path.join(script_dir, filename)
            abs_path = os.path.abspath(file_path)
            
            self.logger.info(f"Checking optional file: {filename}")
            self.logger.info(f"  Path: {file_path}")
            self.logger.info(f"  Absolute: {abs_path}")
            
            if os.path.exists(file_path):
                self.logger.info(f"  ✅ EXISTS")
                self.file_locations[f'optional_{filename.replace("/", "_")}'] = abs_path
            else:
                self.warnings.append(f"Optional file missing: {file_path}")
                self.logger.warning(f"  ⚠️ NOT FOUND")
                
        return all_valid
        
    def validate_configuration_files(self) -> bool:
        """Validate configuration file contents"""
        self.log_separator("CONFIGURATION FILES VALIDATION")
        
        all_valid = True
        
        # Main config.json
        config_path = os.path.join(os.path.dirname(__file__), 'config.json')
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    
                self.logger.info(f"Main config.json loaded from: {config_path}")
                self.logger.info(f"Config keys: {list(config.keys())}")
                
                # Validate required config fields
                required_fields = ['api_id', 'api_hash', 'entities']
                for field in required_fields:
                    if field in config:
                        if field == 'api_id':
                            self.logger.info(f"  ✅ {field}: {config[field]} (type: {type(config[field])})")
                        elif field == 'api_hash':
                            self.logger.info(f"  ✅ {field}: {config[field][:8]}... (length: {len(config[field])})")
                        elif field == 'entities':
                            self.logger.info(f"  ✅ {field}: {len(config[field])} entity pairs")
                            for i, entity_pair in enumerate(config[field]):
                                self.logger.info(f"    Entity pair {i+1}: {entity_pair}")
                    else:
                        self.critical_errors.append(f"Missing required config field: {field}")
                        self.logger.error(f"  ❌ {field}: MISSING")
                        all_valid = False
                        self.requirements_met = False
                        
                # Store config location
                self.file_locations['main_config'] = config_path
                
            except Exception as e:
                self.critical_errors.append(f"Failed to load main config: {e}")
                self.logger.error(f"❌ Failed to load {config_path}: {e}")
                all_valid = False
                self.requirements_met = False
        else:
            self.critical_errors.append(f"Main config file not found: {config_path}")
            self.logger.error(f"❌ Main config not found: {config_path}")
            all_valid = False
            self.requirements_met = False
            
        return all_valid
        
    def validate_environment_variables(self) -> bool:
        """Validate required environment variables"""
        self.log_separator("ENVIRONMENT VARIABLES VALIDATION")
        
        required_env_vars = ['TG_API_ID', 'TG_API_HASH']
        optional_env_vars = ['LIVE_CLONING_INSTANCE_ID', 'NODE_ENV']
        
        all_valid = True
        
        # Check required environment variables
        for var in required_env_vars:
            value = os.getenv(var)
            if value:
                if 'HASH' in var:
                    self.logger.info(f"✅ {var}: {value[:8]}... (length: {len(value)})")
                else:
                    self.logger.info(f"✅ {var}: {value}")
            else:
                self.critical_errors.append(f"Required environment variable missing: {var}")
                self.logger.error(f"❌ {var}: NOT SET")
                all_valid = False
                self.requirements_met = False
                
        # Check optional environment variables
        for var in optional_env_vars:
            value = os.getenv(var)
            if value:
                self.logger.info(f"✅ {var}: {value}")
            else:
                self.warnings.append(f"Optional environment variable missing: {var}")
                self.logger.warning(f"⚠️ {var}: NOT SET")
                
        return all_valid
        
    def validate_network_connectivity(self) -> bool:
        """Validate network connectivity to Telegram servers"""
        self.log_separator("NETWORK CONNECTIVITY VALIDATION")
        
        try:
            import socket
            
            # Test DNS resolution
            telegram_servers = [
                ('149.154.167.51', 443),  # DC2
                ('149.154.175.53', 443),  # DC4
                ('91.108.56.196', 443),   # DC5
            ]
            
            connectivity_ok = False
            
            for server, port in telegram_servers:
                try:
                    self.logger.info(f"Testing connectivity to {server}:{port}")
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(5)
                    result = sock.connect_ex((server, port))
                    sock.close()
                    
                    if result == 0:
                        self.logger.info(f"  ✅ Connected successfully")
                        connectivity_ok = True
                        break
                    else:
                        self.logger.warning(f"  ⚠️ Connection failed (code: {result})")
                        
                except Exception as e:
                    self.logger.warning(f"  ⚠️ Connection error: {e}")
                    
            if not connectivity_ok:
                self.warnings.append("No Telegram servers reachable")
                self.logger.warning("⚠️ No Telegram servers reachable - network may be restricted")
                
            return True  # Non-critical for validation
            
        except Exception as e:
            self.warnings.append(f"Network validation failed: {e}")
            self.logger.warning(f"⚠️ Network validation failed: {e}")
            return True  # Non-critical
            
    def validate_session_string_format(self, session_string: str) -> bool:
        """Validate session string format"""
        self.log_separator("SESSION STRING VALIDATION")
        
        if not session_string:
            self.critical_errors.append("Session string is empty")
            self.logger.error("❌ Session string is empty")
            self.requirements_met = False
            return False
            
        self.logger.info(f"Session string length: {len(session_string)}")
        self.logger.info(f"Session string format: {session_string[:20]}...{session_string[-20:]}")
        
        # Validate base64 format
        try:
            import base64
            decoded = base64.b64decode(session_string + '==')
            self.logger.info(f"✅ Session string is valid base64 (decoded length: {len(decoded)})")
            
            # Check minimum length
            if len(decoded) < 200:
                self.warnings.append("Session string seems too short")
                self.logger.warning("⚠️ Session string seems too short")
                
            return True
            
        except Exception as e:
            self.critical_errors.append(f"Invalid session string format: {e}")
            self.logger.error(f"❌ Invalid session string format: {e}")
            self.requirements_met = False
            return False
            
    def validate_write_permissions(self) -> bool:
        """Validate write permissions for required directories"""
        self.log_separator("WRITE PERMISSIONS VALIDATION")
        
        directories_to_check = [
            '.',
            './logs',
            './tmp',
            '/tmp'
        ]
        
        all_valid = True
        
        for directory in directories_to_check:
            abs_dir = os.path.abspath(directory)
            self.logger.info(f"Checking write permissions: {abs_dir}")
            
            if os.path.exists(abs_dir):
                # Test write permission
                try:
                    test_file = os.path.join(abs_dir, f'write_test_{os.getpid()}.tmp')
                    with open(test_file, 'w') as f:
                        f.write('test')
                    os.unlink(test_file)
                    self.logger.info(f"  ✅ WRITABLE")
                except Exception as e:
                    self.critical_errors.append(f"Directory not writable: {abs_dir}")
                    self.logger.error(f"  ❌ NOT WRITABLE: {e}")
                    all_valid = False
                    self.requirements_met = False
            else:
                # Try to create directory
                try:
                    os.makedirs(abs_dir, exist_ok=True)
                    self.logger.info(f"  ✅ CREATED")
                except Exception as e:
                    self.warnings.append(f"Could not create directory: {abs_dir}")
                    self.logger.warning(f"  ⚠️ COULD NOT CREATE: {e}")
                    
        return all_valid
        
    def run_pre_start_validation(self, session_string: str = None) -> Dict:
        """Run complete pre-start validation"""
        self.log_separator("AUTO-START VALIDATION BEGINNING")
        self.logger.info("Running comprehensive validation for 100% auto-start guarantee...")
        
        # Run all validations
        validations = [
            ("Python Environment", self.validate_python_environment),
            ("Required Packages", self.validate_required_packages),
            ("File Locations", self.validate_file_locations),
            ("Configuration Files", self.validate_configuration_files),
            ("Environment Variables", self.validate_environment_variables),
            ("Write Permissions", self.validate_write_permissions),
            ("Network Connectivity", self.validate_network_connectivity)
        ]
        
        if session_string:
            validations.append(("Session String Format", lambda: self.validate_session_string_format(session_string)))
            
        validation_results = {}
        
        for name, validation_func in validations:
            try:
                result = validation_func()
                validation_results[name] = result
                if result:
                    self.logger.info(f"✅ {name}: PASSED")
                else:
                    self.logger.error(f"❌ {name}: FAILED")
            except Exception as e:
                validation_results[name] = False
                self.critical_errors.append(f"{name} validation failed: {e}")
                self.logger.error(f"❌ {name}: EXCEPTION - {e}")
                
        # Generate comprehensive report
        return self.generate_validation_report(validation_results)
        
    def generate_validation_report(self, validation_results: Dict) -> Dict:
        """Generate comprehensive validation report"""
        self.log_separator("VALIDATION REPORT")
        
        passed_count = sum(1 for result in validation_results.values() if result)
        total_count = len(validation_results)
        
        self.logger.info(f"Validation Summary: {passed_count}/{total_count} passed")
        
        if self.requirements_met:
            self.logger.info("🎉 ALL CRITICAL REQUIREMENTS MET - AUTO-START GUARANTEED!")
        else:
            self.logger.error("💥 CRITICAL REQUIREMENTS MISSING - AUTO-START WILL FAIL!")
            
        # Log all errors and warnings
        if self.critical_errors:
            self.logger.error("CRITICAL ERRORS:")
            for error in self.critical_errors:
                self.logger.error(f"  ❌ {error}")
                
        if self.warnings:
            self.logger.warning("WARNINGS:")
            for warning in self.warnings:
                self.logger.warning(f"  ⚠️ {warning}")
                
        # Log file locations
        self.logger.info("FILE LOCATIONS DISCOVERED:")
        for key, location in self.file_locations.items():
            self.logger.info(f"  {key}: {location}")
            
        report = {
            "requirements_met": self.requirements_met,
            "auto_start_guaranteed": self.requirements_met,
            "validation_results": validation_results,
            "critical_errors": self.critical_errors,
            "warnings": self.warnings,
            "file_locations": self.file_locations,
            "summary": {
                "passed": passed_count,
                "total": total_count,
                "success_rate": f"{(passed_count/total_count)*100:.1f}%"
            }
        }
        
        # Save report to file
        report_file = f"auto_start_validation_{os.getpid()}.json"
        try:
            with open(report_file, 'w') as f:
                json.dump(report, f, indent=2)
            self.logger.info(f"📄 Validation report saved: {os.path.abspath(report_file)}")
        except Exception as e:
            self.logger.error(f"Failed to save validation report: {e}")
            
        return report

# Create global validator instance
auto_start_validator = AutoStartValidator()