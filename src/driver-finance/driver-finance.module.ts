import { Module, forwardRef } from '@nestjs/common';
import { DriverFinanceService } from './driver-finance.service';
import { DriverFinanceController, AdminDriverFinanceController } from './driver-finance.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    PrismaModule,
    SettingsModule,
  ],
  controllers: [DriverFinanceController, AdminDriverFinanceController],
  providers: [DriverFinanceService],
  exports: [DriverFinanceService],
})
export class DriverFinanceModule {}
