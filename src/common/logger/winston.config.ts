import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';

// Custom format to include correlation ID
const correlationIdFormat = winston.format((info) => {
  // Correlation ID can be added to the logger context
  return info;
});

export const createWinstonLogger = (appName: string, logLevel: string) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        correlationIdFormat(),
        isDevelopment
          ? nestWinstonModuleUtilities.format.nestLike(appName, {
              colors: true,
              prettyPrint: true,
            })
          : winston.format.json(),
      ),
    }),
  ];

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

  return winston.createLogger({
    level: logLevel,
    transports,
    exceptionHandlers: [
      new winston.transports.File({ filename: 'logs/exceptions.log' }),
    ],
    rejectionHandlers: [
      new winston.transports.File({ filename: 'logs/rejections.log' }),
    ],
  });
};
