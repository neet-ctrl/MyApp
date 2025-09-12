/**
 * Telegram Entity Formatter
 * Ensures 100% compatibility with Telegram entity IDs and formats
 * Based on the Python copier bot logic from temp-telegram-live-sender
 */
import type { Chat } from '@shared/schema';

export interface TelegramEntityInfo {
  id: string;
  displayName: string;
  username?: string;
  type: 'channel' | 'group' | 'private';
  isValid: boolean;
  originalInput?: string;
}

/**
 * Detect if a chat is a bot based on username patterns
 * Bots typically end with 'bot' and have specific patterns
 */
function isBotEntity(chat: Chat): boolean {
  if (!chat.username) return false;
  
  // Bot usernames typically end with 'bot' (case insensitive)
  const username = chat.username.toLowerCase();
  return username.endsWith('bot');
}

/**
 * Format a chat object using Python copier's exact logic
 * Based on successful examples:
 * - Bots: Always use @username (like @Bashhwhahbot)
 * - Channels/Supergroups: Use -100 prefix or 10... format 
 * - Basic groups: Use negative ID (like -4899269710)
 * - Users: Use positive ID (like 4971189003)
 */
export function formatChatToTelegramEntity(chat: Chat): TelegramEntityInfo {
  // CRITICAL: Bots always use @username format (never numeric ID)
  if (isBotEntity(chat)) {
    return {
      id: `@${chat.username}`,
      displayName: `@${chat.username}`,
      username: chat.username,
      type: 'private', // Bots are private chats
      isValid: true,
      originalInput: chat.id
    };
  }
  
  // For channels with username, prefer @username format (like Python copier)
  if (chat.type === 'channel' && chat.username) {
    return {
      id: `@${chat.username}`,
      displayName: `${chat.title} (@${chat.username})`,
      username: chat.username,
      type: chat.type,
      isValid: true,
      originalInput: chat.id
    };
  }
  
  // For channels/supergroups without username, use proper ID format
  if (chat.type === 'channel') {
    let formattedId = chat.id;
    const numericId = parseInt(chat.id);
    
    if (!isNaN(numericId) && numericId > 0) {
      // Add -100 prefix for supergroups/channels (Python copier format: 1002251706886)
      formattedId = `100${numericId}`; // Remove -100 prefix, just use 10... format
    }
    
    return {
      id: formattedId,
      displayName: chat.title,
      username: chat.username,
      type: chat.type,
      isValid: true,
      originalInput: chat.id
    };
  }
  
  // For basic groups, use negative ID format (like -4899269710)
  if (chat.type === 'group') {
    return {
      id: chat.id, // Keep original format
      displayName: chat.title,
      username: chat.username,
      type: chat.type,
      isValid: true,
      originalInput: chat.id
    };
  }
  
  // For private chats (users), use positive ID (like 4971189003)
  if (chat.type === 'private') {
    return {
      id: chat.id, // Keep original format
      displayName: chat.title,
      username: chat.username,
      type: chat.type,
      isValid: true,
      originalInput: chat.id
    };
  }
  
  // Fallback: return as-is
  return {
    id: chat.id,
    displayName: chat.title,
    username: chat.username,
    type: chat.type,
    isValid: true,
    originalInput: chat.id
  };
}

/**
 * Parse user input using Python copier's exact logic
 * Based on successful examples:
 * - @Bashhwhahbot (bot username) → @Bashhwhahbot
 * - 4971189003 (user ID) → 4971189003  
 * - 1002251706886 (channel with 100... format) → 1002251706886
 * - -4899269710 (basic group) → -4899269710
 */
export function parseEntityInput(input: string): TelegramEntityInfo {
  const trimmed = input.trim();
  
  // Empty input
  if (!trimmed) {
    return {
      id: '',
      displayName: 'Invalid',
      type: 'private',
      isValid: false,
      originalInput: input
    };
  }
  
  // Handle username format (@username or username) - STRICT Telegram rules 5-32 chars
  if (trimmed.startsWith('@') || /^[a-zA-Z]/.test(trimmed)) {
    const cleanInput = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
    const isValidUsername = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(cleanInput); // 5-32 characters total
    
    // Store canonical format with @ for consistency with Python copier
    const canonicalId = `@${cleanInput}`;
    
    // Detect if it's a bot (ends with 'bot')
    const isBot = cleanInput.toLowerCase().endsWith('bot');
    
    return {
      id: canonicalId,
      displayName: canonicalId,
      username: cleanInput,
      type: isBot ? 'private' : 'channel', // Bots are 'private', channels/groups with usernames are 'channel'
      isValid: isValidUsername,
      originalInput: input
    };
  }
  
  // Handle channel/supergroup ID format (100... - Python copier format)
  if (/^100\d{7,}$/.test(trimmed)) {
    // Python copier uses 100... format (not -100...)
    return {
      id: trimmed,
      displayName: trimmed,
      username: '',
      type: 'channel', // Supergroups/channels are 'channel' type
      isValid: true,
      originalInput: input
    };
  }
  
  // Handle supergroup/channel ID format (-100...) - also accept this format
  if (/^-100\d{5,}$/.test(trimmed)) {
    // Convert to Python copier format (remove minus, keep 100...)
    const pythonFormat = trimmed.substring(1); // Remove the minus sign
    return {
      id: pythonFormat,
      displayName: pythonFormat,
      username: '',
      type: 'channel',
      isValid: true,
      originalInput: input
    };
  }
  
  // Handle basic group ID format (-123456, not starting with -100)
  if (/^-(?!100)\d+$/.test(trimmed)) {
    // Valid basic group ID (like -4899269710)
    return {
      id: trimmed,
      displayName: trimmed,
      username: '',
      type: 'group', // Basic groups are 'group' type
      isValid: true,
      originalInput: input
    };
  }
  
  // Handle user ID format (positive integer like 4971189003)
  if (/^\d+$/.test(trimmed) && !trimmed.startsWith('100')) {
    // Valid user ID (positive integer, not starting with 100)
    return {
      id: trimmed,
      displayName: trimmed,
      username: '',
      type: 'private', // User chats are 'private' type
      isValid: true,
      originalInput: input
    };
  }
  
  // Invalid format - don't try to normalize
  return {
    id: trimmed,
    displayName: trimmed,
    username: '',
    type: 'private', // Use valid type even for invalid entities
    isValid: false,
    originalInput: input
  };
}

/**
 * Validate if an entity format matches Python copier's successful patterns
 * Based on working examples: @Bashhwhahbot, 4971189003, 1002251706886, -4899269710
 */
export function validateTelegramEntity(entityId: string): boolean {
  if (!entityId || entityId.trim() === '') {
    return false;
  }
  
  const trimmed = entityId.trim();
  
  // Username format: @username (5-32 characters, starts with letter)
  if (trimmed.startsWith('@')) {
    const username = trimmed.slice(1);
    return /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(username); // 5-32 characters total
  }
  
  // Channel/supergroup ID: 100xxxxxxxxx (Python copier format)
  if (/^100\d{7,}$/.test(trimmed)) {
    return true;
  }
  
  // Also accept -100 format (convert to Python format internally)
  if (trimmed.startsWith('-100')) {
    return /^-100\d{5,}$/.test(trimmed);
  }
  
  // Basic group ID: negative number not starting with -100 (like -4899269710)
  if (/^-(?!100)\d+$/.test(trimmed)) {
    return true;
  }
  
  // User ID: positive integer not starting with 100 (like 4971189003)
  if (/^\d+$/.test(trimmed) && !trimmed.startsWith('100')) {
    const num = parseInt(trimmed);
    return num > 0 && num < 100000000000; // Reasonable user ID range
  }
  
  return false;
}

/**
 * Get suggested format for an invalid entity
 */
export function getSuggestedEntityFormat(input: string): string {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return 'Enter @username (5-32 chars) or -100123456789';
  }
  
  // If it looks like it could be a username
  if (/^@?[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmed)) {
    const clean = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
    if (clean.length < 5) {
      return `Username too short (need 5-32 chars). Try: @${clean}example`;
    }
    if (clean.length > 32) {
      return `Username too long (max 32 chars). Try: @${clean.substring(0, 32)}`;
    }
    return `@${clean}`;
  }
  
  // If it looks like it could be a numeric ID
  if (/^-?\d+$/.test(trimmed)) {
    if (trimmed.startsWith('-100') && trimmed.length < 8) {
      return 'Channel ID too short. Try: -1001234567890';
    }
    if (trimmed.startsWith('-') && !trimmed.startsWith('-100') && trimmed.length < 4) {
      return 'Basic group ID too short. Try: -123456';
    }
  }
  
  return 'Format: @username (5-32 chars), -100123456789 for channels, or -123456 for basic groups';
}

/**
 * Get the formatted entity ID for display
 */
export function getFormattedEntityId(chatId: string): string {
  // For now, return the chatId directly since we need to look up the chat to format it properly
  // This function will be enhanced when called with actual chat data
  return chatId;
}

/**
 * Create a display-friendly entity name for the UI
 */
export function createEntityDisplayName(entity: TelegramEntityInfo, chat?: Chat): string {
  if (chat) {
    return `${chat.title}${chat.username ? ` (@${chat.username})` : ''} [${entity.id}]`;
  }
  
  if (entity.username) {
    return `@${entity.username} [${entity.id}]`;
  }
  
  return `${entity.displayName} [${entity.id}]`;
}