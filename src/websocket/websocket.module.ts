import { Module, Global } from '@nestjs/common';
import { OrdersGateway } from './orders.gateway';

@Global()
@Module({
  providers: [OrdersGateway],
  exports: [OrdersGateway],
})
export class WebsocketModule {}
