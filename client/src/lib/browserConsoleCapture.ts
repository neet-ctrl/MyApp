// Global browser console capture utility
// This captures browser console logs from the very beginning of app load

export interface BrowserConsoleLog {
  id: number;
  level: string;
  message: string;
  timestamp: number;
  args: any[];
}

class BrowserConsoleCapture {
  private logs: BrowserConsoleLog[] = [];
  private logId = 0;
  private originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  } | null = null;
  private isIntercepted = false;
  private maxLogs = 1000;

  constructor() {
    // Start capturing immediately when this module loads
    this.startCapture();
  }

  private formatArgs(args: any[]): string {
    return args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
  }

  private createLogEntry(level: string, args: any[]): BrowserConsoleLog {
    return {
      id: this.logId++,
      level: level.toUpperCase(),
      message: this.formatArgs(args),
      timestamp: Date.now(),
      args: [...args]
    };
  }

  startCapture() {
    if (this.isIntercepted || !window.console) return;

    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console)
    };

    // Patch console methods
    const patchMethod = (method: keyof typeof console, level: string) => {
      const original = this.originalConsole![method as keyof typeof this.originalConsole];
      (console as any)[method] = (...args: any[]) => {
        // Call original method to preserve native console behavior
        original.apply(console, args);
        
        // Capture log for our console component
        const logEntry = this.createLogEntry(level, args);
        this.logs = [logEntry, ...this.logs].slice(0, this.maxLogs);
      };
    };

    patchMethod('log', 'log');
    patchMethod('info', 'info');
    patchMethod('warn', 'warn');
    patchMethod('error', 'error');
    patchMethod('debug', 'debug');

    this.isIntercepted = true;

    // Also capture unhandled rejections and errors
    window.addEventListener('unhandledrejection', (event) => {
      const logEntry = this.createLogEntry('unhandledrejection', [{
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack
      }]);
      this.logs = [logEntry, ...this.logs].slice(0, this.maxLogs);
    });

    window.addEventListener('error', (event) => {
      const logEntry = this.createLogEntry('error', [{
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack
      }]);
      this.logs = [logEntry, ...this.logs].slice(0, this.maxLogs);
    });
  }

  stopCapture() {
    if (!this.isIntercepted || !this.originalConsole) return;

    // Restore original console methods
    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.debug = this.originalConsole.debug;

    this.isIntercepted = false;
    this.originalConsole = null;
  }

  getLogs(): BrowserConsoleLog[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  addLog(level: string, args: any[]) {
    const logEntry = this.createLogEntry(level, args);
    this.logs = [logEntry, ...this.logs].slice(0, this.maxLogs);
  }

  isCapturing(): boolean {
    return this.isIntercepted;
  }
}

// Create global instance that starts immediately
export const globalBrowserConsoleCapture = new BrowserConsoleCapture();

// Export types for use in components