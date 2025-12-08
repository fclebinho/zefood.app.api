import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [ConfigModule, forwardRef(() => WebsocketModule), SettingsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
