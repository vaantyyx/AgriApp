// @ts-check
import pino from 'pino';
import * as Sentry from '@sentry/node';

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined,
});

// Every route in this codebase catches its own errors and logs them via
// logger.error({ err }, '...') rather than letting them bubble to Express's
// error middleware — so hooking this one call site forwards nearly every
// caught exception in the app to Sentry, without touching 40+ individual
// catch blocks. No-op (falls through to the original method) when
// SENTRY_DSN isn't set.
if (process.env.SENTRY_DSN) {
  const originalError = logger.error.bind(logger);
  logger.error = (...args) => {
    originalError(...args);
    const objArg = args.find((a) => a && typeof a === 'object' && 'err' in a);
    if (objArg?.err) Sentry.captureException(objArg.err);
  };
}
