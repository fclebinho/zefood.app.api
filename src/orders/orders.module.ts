import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { TrackingModule } from '../tracking/tracking.module';
import { RestaurantFinanceModule } from '../restaurant-finance/restaurant-finance.module';
import { DriverFinanceModule } from '../driver-finance/driver-finance.module';

@Module({
  imports: [
    TrackingModule,
    forwardRef(() => RestaurantFinanceModule),
    forwardRef(() => DriverFinanceModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
