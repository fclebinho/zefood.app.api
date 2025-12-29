import { Module } from '@nestjs/common';
import { RestaurantFinanceService } from './restaurant-finance.service';
import { MyFinanceController, RestaurantFinanceController, AdminFinanceController } from './restaurant-finance.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [MyFinanceController, RestaurantFinanceController, AdminFinanceController],
  providers: [RestaurantFinanceService],
  exports: [RestaurantFinanceService],
})
export class RestaurantFinanceModule {}
