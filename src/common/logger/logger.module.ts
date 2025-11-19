import { Module, Global } from '@nestjs/common';
import {
  WINSTON_MODULE_PROVIDER,
  WINSTON_MODULE_NEST_PROVIDER,
} from 'nest-winston';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createWinstonLogger } from './winston.config';
import { Logger } from '@nestjs/common';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: WINSTON_MODULE_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const appName =
          configService.get<string>('app.name') || 'CondoMarket API';
        const logLevel =
          configService.get<string>('app.logging.level') || 'info';
        const logger = createWinstonLogger(appName, logLevel);
        console.log(
          `✓ Winston logger created with ${logger.transports.length} transport(s)`,
        );
        return logger;
      },
      inject: [ConfigService],
    },
    {
      provide: WINSTON_MODULE_NEST_PROVIDER,
      useFactory: () => {
        return new Logger();
      },
    },
  ],
  exports: [WINSTON_MODULE_PROVIDER, WINSTON_MODULE_NEST_PROVIDER],
})
export class LoggerModule {}
