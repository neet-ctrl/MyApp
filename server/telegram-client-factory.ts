import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { logger } from './telegram-bot/logger';
import { Logger } from 'telegram/extensions';

export interface TelegramClientConfig {
  apiId: number;
  apiHash: string;
  sessionString?: string;
  session?: StringSession;
}

/**
 * Centralized factory function to create TelegramClient instances with consistent
 * connection options using fallback connections to avoid WebSocket errors.
 */
export function createTelegramClient(config: TelegramClientConfig): TelegramClient {
  const { apiId, apiHash, sessionString, session } = config;
  
  // Use provided session or create from session string
  const clientSession = session || new StringSession(sessionString || '');
  
  logger.info('Creating TelegramClient with fallback connection options');
  
  // Use multiple fallback connection options to avoid WebSocket issues
  return new TelegramClient(clientSession, apiId, apiHash, {
    connectionRetries: 10,
    retryDelay: 1000,
    timeout: 60000,
    useIPV6: false,
    testServers: false,
    autoReconnect: true,
    deviceModel: 'Live Cloning Bot',
    systemVersion: '1.0.0',
    appVersion: '1.0.0',
    langCode: 'en',
    systemLangCode: 'en',
    // Don't force WSS, let it fallback to TCP if needed
    useWSS: false
  });
}

/**
 * Helper function to test a session string without keeping the connection open
 */
export async function testTelegramSession(config: TelegramClientConfig): Promise<{
  success: boolean;
  userInfo?: { id: number; username: string; firstName: string };
  error?: string;
}> {
  let client: TelegramClient | null = null;
  
  try {
    client = createTelegramClient(config);
    
    logger.info('Testing Telegram session connection with improved error handling...');
    
    // Add connection timeout
    const connectPromise = client.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout after 30 seconds')), 30000)
    );
    
    await Promise.race([connectPromise, timeoutPromise]);
    
    // Test if we can get user info
    const me = await client.getMe();
    
    const userInfo = {
      id: parseInt(me.id.toString()),
      username: me.username || '',
      firstName: me.firstName || ''
    };
    
    logger.info(`✅ Session valid for user: ${me.firstName} (@${me.username}) - ID: ${userInfo.id}`);
    
    return {
      success: true,
      userInfo
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`❌ Session test failed: ${errorMessage}`);
    
    // Provide more specific error messages
    let userFriendlyError = errorMessage;
    if (errorMessage.includes('WebSocket connection failed') || errorMessage.includes('Connection timeout')) {
      userFriendlyError = 'Network connection failed. Please check your internet connection and try again.';
    } else if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('AUTH_KEY')) {
      userFriendlyError = 'Invalid session string. Please generate a new session string.';
    } else if (errorMessage.includes('FLOOD_WAIT')) {
      userFriendlyError = 'Too many requests. Please wait a few minutes before trying again.';
    }
    
    return {
      success: false,
      error: userFriendlyError
    };
  } finally {
    if (client) {
      try {
        await client.disconnect();
        logger.info('Telegram client disconnected after session test');
      } catch (disconnectError) {
        logger.warn(`Error disconnecting client: ${disconnectError}`);
      }
    }
  }
}