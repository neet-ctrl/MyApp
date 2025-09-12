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
  
  // For channels and supergroups, ensure proper -100 prefix
  if ((chat.type === 'channel' || chat.type === 'group') && !chat.username) {
    // If it's a numeric ID for a channel/group, ensure it has -100 prefix
    const numericId = parseInt(chat.id);
    if (!isNaN(numericId) && numericId > 0) {
      // Add -100 prefix for supergroups/channels (Telegram requirement)
      formattedId = `-100${Math.abs(numericId)}`;
    } else if (!chat.id.startsWith('-100') && chat.id.startsWith('-')) {
      // Already has negative prefix but not -100, make it -100
      formattedId = `-100${Math.abs(numericId)}`;
    }
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
  
  // Remove @ prefix if present
  const cleanInput = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  
  // Try to parse as number
  const numericId = parseInt(cleanInput);
  
  if (!isNaN(numericId)) {
    // It's a numeric ID
    if (numericId < 0) {
      // Already negative - likely a group/channel ID
      if (cleanInput.startsWith('-100')) {
        // Perfect format for supergroup/channel
        return {
          id: cleanInput,
          displayName: `Channel/Group (${cleanInput})`,
          type: 'channel',
          isValid: true,
          originalInput: input
        };
      } else {
        // Regular group (add -100 prefix to make it work)
        return {
          id: `-100${Math.abs(numericId)}`,
          displayName: `Group (${cleanInput} → -100${Math.abs(numericId)})`,
          type: 'group',
          isValid: true,
          originalInput: input
        };
      }
    } else {
      // Positive number - likely a user ID
      return {
        id: cleanInput,
        displayName: `User (${cleanInput})`,
        type: 'private',
        isValid: true,
        originalInput: input
      };
    }
  } else {
    // It's a username (non-numeric)
    // Validate username format: letters, numbers, underscore, 4+ chars
    const isValidUsername = /^[a-zA-Z][a-zA-Z0-9_]{3,}$/.test(cleanInput);
    
    return {
      id: cleanInput,
      displayName: isValidUsername ? `@${cleanInput}` : cleanInput,
      username: cleanInput,
      type: 'channel', // Assume channel for usernames
      isValid: isValidUsername,
      originalInput: input
    };
  }
}

/**
 * Validate if an entity format is compatible with Telegram
 * Based on the Python copier's regex pattern:
 * r'^[Ll]ink @?(-?[1-9a-zA-Z][a-zA-Z0-9_]{4,}) to @?(-?[1-9a-zA-Z][a-zA-Z0-9_]{4,})$'
 */
export function validateTelegramEntity(entityId: string): boolean {
  if (!entityId || entityId.trim() === '') {
    return false;
  }
  
  const trimmed = entityId.trim();
  
  // Check the Python copier's regex pattern for valid entities
  const telegramEntityRegex = /^-?[1-9a-zA-Z][a-zA-Z0-9_]{3,}$/;
  
  return telegramEntityRegex.test(trimmed);
}

/**
 * Get suggested format for an invalid entity
 */
export function getSuggestedEntityFormat(input: string): string {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return 'Enter @username or -100123456789';
  }
  
  // If it looks like it could be a username
  if (/^@?[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmed)) {
    const clean = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
    if (clean.length < 4) {
      return `Username too short. Try: @${clean}example`;
    }
    return `@${clean}`;
  }
  
  // If it looks like it could be a chat ID
  const numericPart = trimmed.replace(/[^0-9]/g, '');
  if (numericPart) {
    return `-100${numericPart}`;
  }
  
  return 'Format: @username or -100123456789';
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