/**
 * Structured logging.
 * Uses pino when installed (production-grade JSON logs) and a no-frills
 * console wrapper otherwise so dev environments do not need the dep yet.
 */

import { config } from './config';

interface Logger {
  level: string;
  trace: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

function tryLoadPino(): Logger | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pino = require('pino');
    return pino({
      level: config.logLevel,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'password', '*.password', 'password_hash'],
        remove: true,
      },
      base: { service: 'pfms-backend', env: config.nodeEnv },
    }) as Logger;
  } catch {
    return null;
  }
}

const pinoLogger = tryLoadPino();

function consoleLogger(level: string, bindings: Record<string, unknown> = {}): Logger {
  const fmt = (lvl: string, args: any[]) => {
    const stamp = new Date().toISOString();
    const payload = args.length === 1 && typeof args[0] === 'object' ? args[0] : { msg: args };
    return JSON.stringify({ time: stamp, level: lvl, ...bindings, ...payload });
  };
  return {
    level,
    trace: (...args: any[]) => console.debug(fmt('trace', args)),
    debug: (...args: any[]) => console.debug(fmt('debug', args)),
    info: (...args: any[]) => console.log(fmt('info', args)),
    warn: (...args: any[]) => console.warn(fmt('warn', args)),
    error: (...args: any[]) => console.error(fmt('error', args)),
    child: (b: Record<string, unknown>) => consoleLogger(level, { ...bindings, ...b }),
  };
}

export const logger: Logger = pinoLogger ?? consoleLogger(config.logLevel);
