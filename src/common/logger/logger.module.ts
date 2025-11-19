import { Module, Global } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createWinstonLogger } from './winston.config';

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const appName = configService.get<string>('app.name') || 'CondoMarket API';
        const logLevel = configService.get<string>('app.logging.level') || 'info';
        console.log(`Creating Winston logger: ${appName}, level: ${logLevel}`);
        const instance = createWinstonLogger(appName, logLevel);
        console.log(`Winston instance has ${instance.transports?.length || 0} transports`);
        return { instance };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
