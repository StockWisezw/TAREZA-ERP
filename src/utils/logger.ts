export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private level: LogLevel = LogLevel.INFO;

  constructor() {
    // Enable DEBUG logs in local dev mode
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      this.level = LogLevel.DEBUG;
    }
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  debug(message: string, data?: any) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(`%c[DEBUG] ${message}`, 'color: #9b5de5; font-weight: bold;', data !== undefined ? data : '');
      this.send({ level: 'debug', message, data });
    }
  }

  info(message: string, data?: any) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(`%c[INFO] ${message}`, 'color: #00bbf9; font-weight: bold;', data !== undefined ? data : '');
      this.send({ level: 'info', message, data });
    }
  }

  warn(message: string, data?: any) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`%c[WARN] ${message}`, 'color: #f15bb5; font-weight: bold;', data !== undefined ? data : '');
      this.send({ level: 'warn', message, data });
    }
  }

  error(message: string, error?: Error | unknown) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`%c[ERROR] ${message}`, 'color: #f72585; font-weight: bold;', error !== undefined ? error : '');
      this.send({
        level: 'error',
        message,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : String(error || ''),
      });
    }
  }

  private async send(payload: any) {
    try {
      // Send telemetry logs asynchronously strictly in hosted non-local environments
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            timestamp: new Date().toISOString(),
            url: window.location.href,
          }),
        }).catch(() => {
          // Swallow payload transport failures to protect main loop
        });
      }
    } catch {
      // Fail silent
    }
  }
}

export const logger = new Logger();
