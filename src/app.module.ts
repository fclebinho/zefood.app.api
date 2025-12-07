import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { OrdersModule } from './orders/orders.module';
import { DriversModule } from './drivers/drivers.module';
import { WebsocketModule } from './websocket/websocket.module';
import { UploadModule } from './upload/upload.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminModule } from './admin/admin.module';
import { TrackingModule } from './tracking/tracking.module';
import { SettingsModule } from './settings/settings.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    GeocodingModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RestaurantsModule,
    OrdersModule,
    DriversModule,
    WebsocketModule,
    UploadModule,
    PaymentsModule,
    AdminModule,
    TrackingModule,
    SettingsModule,
  ],
})
export class AppModule {}
