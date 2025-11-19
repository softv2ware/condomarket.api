import { Module } from '@nestjs/common';
import { BlockingService } from './blocking.service';
import { BlockingController } from './blocking.controller';
import { PrismaService } from '~/prisma';

@Module({
  controllers: [BlockingController],
  providers: [BlockingService, PrismaService],
  exports: [BlockingService],
})
export class BlockingModule {}
