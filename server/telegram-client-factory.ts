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
 * connection options using TCPObfuscated on port 443 to avoid ECONNREFUSED errors.
 */
export function createTelegramClient(config: TelegramClientConfig): TelegramClient {
  const { apiId, apiHash, sessionString, session } = config;
  
  // Use provided session or create from session string
  const clientSession = session || new StringSession(sessionString || '');
  
  logger.info('Creating TelegramClient with TCPObfuscated on port 443');
  
  // Force the client to use TCPObfuscated connection on port 443
  return new TelegramClient(clientSession, apiId, apiHash, {
    connectionRetries: 5,
    retryDelay: 2000,
    useWSS: true, // Force WebSocket Secure on port 443
    testServers: false,
    timeout: 30000,
    useIPV6: false,
    proxy: undefined,
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
    
    logger.info('Testing Telegram session connection...');
    await client.connect();
    
    const me = await client.getMe();
    
    const userInfo = {
      id: parseInt(me.id.toString()),
      username: me.username || '',
      firstName: me.firstName || ''
    };
    
    logger.info(`Session valid for user: ${me.firstName} (@${me.username})`);
    
    return {
      success: true,
      userInfo
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Session test failed: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage
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