import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { SettingsModule } from '../settings/settings.module';

// Gateway imports
import { StripeGateway } from './gateways/stripe/stripe.gateway';
import { MercadoPagoGateway } from './gateways/mercadopago/mercadopago.gateway';
import { PagSeguroGateway } from './gateways/pagseguro/pagseguro.gateway';
import { GatewayRegistry } from './gateways/gateway.registry';

@Module({
  imports: [ConfigModule, forwardRef(() => WebsocketModule), SettingsModule],
  controllers: [PaymentsController],
  providers: [
    // Payment gateways
    StripeGateway,
    MercadoPagoGateway,
    PagSeguroGateway,
    // Gateway registry (manages all gateways)
    GatewayRegistry,
    // Main payment service
    PaymentsService,
  ],
  exports: [PaymentsService, GatewayRegistry, StripeGateway, MercadoPagoGateway, PagSeguroGateway],
})
export class PaymentsModule {}
