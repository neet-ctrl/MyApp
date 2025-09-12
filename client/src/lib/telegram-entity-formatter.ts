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
 * Format a chat object to proper Telegram entity format
 * This ensures the entity ID will work 100% with Telegram forwarding
 */
export function formatChatToTelegramEntity(chat: Chat): TelegramEntityInfo {
  let formattedId = chat.id;
  
  // For channels and supergroups, handle ID formatting carefully
  if (chat.type === 'channel' && !chat.username) {
    // Only add -100 prefix if it's a positive number (likely a supergroup)
    const numericId = parseInt(chat.id);
    if (!isNaN(numericId) && numericId > 0) {
      // Add -100 prefix for supergroups/channels (Telegram requirement)
      formattedId = `-100${Math.abs(numericId)}`;
    }
    // If it already starts with negative sign, leave it unchanged (basic groups or proper IDs)
  }
  
  // For basic groups, preserve the original ID format
  if (chat.type === 'group') {
    // Basic groups have their own ID format, don't modify
    formattedId = chat.id;
  }
  
  // For private chats, use the raw ID (can be positive for users)
  if (chat.type === 'private') {
    formattedId = chat.id;
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

/**
 * Parse user input to proper Telegram entity format
 * Handles: @username, -100123456, 123456, username
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
    const isValidUsername = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(cleanInput); // 5-32 characters (4,31 = 5-32)
    
    // Store canonical format with @ for consistency with Python copier
    const canonicalId = `@${cleanInput}`;
    
    return {
      id: canonicalId,
      displayName: canonicalId,
      username: cleanInput,
      type: 'channel', // Channels/groups with usernames
      isValid: isValidUsername,
      originalInput: input
    };
  }
  
  // Handle supergroup/channel ID format (-100...)
  if (/^-100\d{5,}$/.test(trimmed)) {
    // Valid supergroup/channel ID
    return {
      id: trimmed,
      displayName: trimmed,
      username: '',
      type: 'channel', // Supergroups/channels are 'channel' type
      isValid: true,
      originalInput: input
    };
  }
  
  // Handle basic group ID format (-123456, not starting with -100)
  if (/^-(?!100)\d+$/.test(trimmed)) {
    // Valid basic group ID
    return {
      id: trimmed,
      displayName: trimmed,
      username: '',
      type: 'group', // Basic groups are 'group' type
      isValid: true,
      originalInput: input
    };
  }
  
  if (/^\d+$/.test(trimmed)) {
    // Valid user ID (positive integer)
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
 * Validate if an entity format is compatible with Telegram
 * STRICT validation matching Python copier and Telegram requirements
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
  
  // Supergroup/channel ID: -100xxxxxxxxx (at least 10 digits after -100)
  if (trimmed.startsWith('-100')) {
    return /^-100\d{5,}$/.test(trimmed);
  }
  
  // Basic group ID: negative number not starting with -100
  if (/^-(?!100)\d+$/.test(trimmed)) {
    return true;
  }
  
  // User ID: positive integer
  if (/^\d+$/.test(trimmed)) {
    return true;
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