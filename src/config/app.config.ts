import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  name: process.env.APP_NAME || 'CondoMarket API',
  port: parseInt(process.env.PORT || '3000', 10),
  
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
    destination: process.env.UPLOAD_DESTINATION || './uploads',
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
}));
