interface LogLevel {
  DEBUG: number;
  INFO: number;
  WARN: number;
  ERROR: number;
}

class Logger {
  private static instance: Logger;
  private logLevel: number = 0; // DEBUG level by default
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
    debug: typeof console.debug;
  };
  private isMonkeyPatched: boolean = false;

  private levels: LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  private constructor() {
    // Store original console methods before monkey-patching
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console)
    };
    
    // Auto-monkey-patch console methods
    this.setupConsoleInterception();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    return `[${timestamp}] ${level.padEnd(7)} ${message}`;
  }

  private async log(level: keyof LogLevel, message: string, source: string = 'bot', metadata?: any): Promise<void> {
    if (this.levels[level] >= this.logLevel) {
      const formattedMessage = this.formatMessage(level, message);
      
      // Use original console to avoid infinite recursion
      this.originalConsole.log(formattedMessage);
      
      // Store log in database and emit via WebSocket
      try {
        const savedLog = await this.persistLog(level, message, source, metadata);
        this.broadcastLog(level, message, source, metadata, savedLog?.id);
      } catch (error) {
        // Don't let logging errors break the application
        this.originalConsole.error('Failed to persist/broadcast log:', error);
      }
    }
  }

  private async persistLog(level: string, message: string, source: string, metadata?: any): Promise<any> {
    try {
      const { storage } = await import('../storage');
      const savedLog = await storage.saveConsoleLog({
        level,
        message,
        source,
        metadata: metadata ? JSON.stringify(metadata) : null
      });
      return savedLog;
    } catch (error) {
      // Silent fail for logging persistence - don't break the application
      // Database might be unavailable (Neon endpoint disabled, etc.)
      return {
        id: Date.now(),
        level,
        message,
        source,
        metadata: metadata ? JSON.stringify(metadata) : null,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private broadcastLog(level: string, message: string, source: string, metadata?: any, logId?: number): void {
    try {
      if (global.consoleWebSocketServer) {
        const logEntry = {
          id: logId || Math.floor(Math.random() * 1000000), // Fallback ID if not available
          level,
          message,
          source,
          metadata,
          timestamp: new Date().toISOString()
        };
        
        global.consoleWebSocketServer.clients.forEach((client) => {
          if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify(logEntry));
          }
        });
      }
    } catch (error) {
      // Silent fail for WebSocket broadcasting
    }
  }

  debug(message: string): void {
    this.log('DEBUG', message);
  }

  info(message: string): void {
    this.log('INFO', message);
  }

  warn(message: string): void {
    this.log('WARN', message);
  }

  error(message: string): void {
    this.log('ERROR', message);
  }

  setLevel(level: keyof LogLevel): void {
    this.logLevel = this.levels[level];
  }

  /**
   * Monkey-patch console methods to capture ALL application logs
   * This ensures we never miss any logs from Express, libraries, or user code
   */
  private setupConsoleInterception(): void {
    if (this.isMonkeyPatched) return;

    // Monkey-patch console.log
    console.log = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      // Call original console.log first to maintain normal behavior
      this.originalConsole.log(...args);
      
      // Then capture for our logging system (bypass recursion)
      this.persistLog('INFO', message, 'console').then(savedLog => {
        this.broadcastLog('INFO', message, 'console', undefined, savedLog?.id);
      }).catch(() => {/* Silent fail */});
    };

    // Monkey-patch console.error
    console.error = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      // Call original console.error first
      this.originalConsole.error(...args);
      
      // Then capture for our logging system (bypass recursion)
      this.persistLog('ERROR', message, 'console').then(savedLog => {
        this.broadcastLog('ERROR', message, 'console', undefined, savedLog?.id);
      }).catch(() => {/* Silent fail */});
    };

    // Monkey-patch console.warn
    console.warn = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      // Call original console.warn first
      this.originalConsole.warn(...args);
      
      // Then capture for our logging system (bypass recursion)
      this.persistLog('WARN', message, 'console').then(savedLog => {
        this.broadcastLog('WARN', message, 'console', undefined, savedLog?.id);
      }).catch(() => {/* Silent fail */});
    };

    // Monkey-patch console.info
    console.info = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      // Call original console.info first
      this.originalConsole.info(...args);
      
      // Then capture for our logging system (bypass recursion)
      this.persistLog('INFO', message, 'console').then(savedLog => {
        this.broadcastLog('INFO', message, 'console', undefined, savedLog?.id);
      }).catch(() => {/* Silent fail */});
    };

    // Monkey-patch console.debug
    console.debug = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      // Call original console.debug first
      this.originalConsole.debug(...args);
      
      // Then capture for our logging system (bypass recursion)
      this.persistLog('DEBUG', message, 'console').then(savedLog => {
        this.broadcastLog('DEBUG', message, 'console', undefined, savedLog?.id);
      }).catch(() => {/* Silent fail */});
    };

    // Capture process uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      const metadata = { 
        stack: error.stack,
        name: error.name 
      };
      this.persistLog('ERROR', `Uncaught Exception: ${error.message}`, 'process', metadata).then(savedLog => {
        this.broadcastLog('ERROR', `Uncaught Exception: ${error.message}`, 'process', metadata, savedLog?.id);
      }).catch(() => {/* Silent fail */});
    });

    process.on('unhandledRejection', (reason, promise) => {
      const metadata = { 
        promise: promise.toString(),
        reason: reason 
      };
      this.persistLog('ERROR', `Unhandled Rejection: ${reason}`, 'process', metadata).then(savedLog => {
        this.broadcastLog('ERROR', `Unhandled Rejection: ${reason}`, 'process', metadata, savedLog?.id);
      }).catch(() => {/* Silent fail */});
    });

    this.isMonkeyPatched = true;
    this.originalConsole.log('🔍 Logger: Console interception enabled - capturing ALL application logs');
  }

  /**
   * Restore original console methods (for testing or cleanup)
   */
  private restoreConsole(): void {
    if (!this.isMonkeyPatched) return;

    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
    console.debug = this.originalConsole.debug;

    this.isMonkeyPatched = false;
    this.originalConsole.log('🔍 Logger: Console methods restored');
  }

  /**
   * Get access to original console methods for internal use
   */
  getOriginalConsole() {
    return this.originalConsole;
  }
}

export const logger = Logger.getInstance();