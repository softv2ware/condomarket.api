import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import * as chalk from 'chalk';

// Custom format to include correlation ID
const correlationIdFormat = winston.format((info) => {
  // Correlation ID can be added to the logger context
  return info;
});

export const createWinstonLogger = (appName: string, logLevel: string) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  const consoleTransport = new winston.transports.Console({
    format: isDevelopment
      ? winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.errors({ stack: true }),
          correlationIdFormat(),
          winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
            if (!chalk || typeof chalk.gray !== 'function') {
              // Fallback if chalk isn't loaded
              const ctx = context ? `[${context}]` : '';
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
              return `${timestamp} ${level.toUpperCase()} ${ctx} ${message} ${metaStr}`;
            }
            
            const ctx = context ? chalk.cyan(`[${context}]`) : '';
            const metaStr = Object.keys(meta).length ? chalk.gray(JSON.stringify(meta)) : '';
            
            let coloredLevel = level.toUpperCase();
            if (level === 'info') coloredLevel = chalk.green(coloredLevel);
            else if (level === 'warn') coloredLevel = chalk.yellow(coloredLevel);
            else if (level === 'error') coloredLevel = chalk.red(coloredLevel);
            else if (level === 'debug') coloredLevel = chalk.blue(coloredLevel);
            
            return `${chalk.gray(timestamp)} ${coloredLevel} ${ctx} ${message} ${metaStr}`;
          }),
        )
      : winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
  });

  const transports: winston.transport[] = [consoleTransport];

  // Add file transports in production
  if (process.env.NODE_ENV === 'production') {
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    );
  }

  const loggerOptions: winston.LoggerOptions = {
    level: logLevel,
    transports,
    silent: false, // Ensure logger is not silenced
  };

  // Only add file-based exception handlers in production
  if (process.env.NODE_ENV === 'production') {
    loggerOptions.exceptionHandlers = [
      new winston.transports.File({ filename: 'logs/exceptions.log' }),
    ];
    loggerOptions.rejectionHandlers = [
      new winston.transports.File({ filename: 'logs/rejections.log' }),
    ];
  }

  const logger = winston.createLogger(loggerOptions);
  
  // Verify transports are added
  console.log(`Winston logger created with ${logger.transports.length} transport(s)`);
  
  return logger;
};
