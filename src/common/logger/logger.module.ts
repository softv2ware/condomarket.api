import { Module, Global } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createWinstonLogger } from './winston.config';

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        instance: createWinstonLogger(
          configService.get<string>('app.name') || 'CondoMarket API',
          configService.get<string>('app.logging.level') || 'info',
        ),
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
