import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Headers,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService, CreatePaymentDto } from './payments.service';
import { PaymentMethod } from '@prisma/client';

class ProcessPaymentDto {
  orderId: string;
  method: PaymentMethod;
  cardToken?: string;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('available-methods')
  async getAvailableMethods() {
    return this.paymentsService.getAvailablePaymentMethods();
  }

  @Post('process')
  @UseGuards(JwtAuthGuard)
  async processPayment(@Body() dto: ProcessPaymentDto, @Request() req: any) {
    return this.paymentsService.processPayment(dto, req.user.sub);
  }

  @Post('stripe/create-intent/:orderId')
  @UseGuards(JwtAuthGuard)
  async createStripeIntent(@Param('orderId') orderId: string, @Request() req: any) {
    return this.paymentsService.createStripePaymentIntent(orderId, req.user.sub);
  }

  @Post('mercadopago/create-preference/:orderId')
  @UseGuards(JwtAuthGuard)
  async createMercadoPagoPreference(@Param('orderId') orderId: string, @Request() req: any) {
    return this.paymentsService.createMercadoPagoPreference(orderId, req.user.sub);
  }

  @Post('pix/:orderId')
  @UseGuards(JwtAuthGuard)
  async createPixPayment(@Param('orderId') orderId: string, @Request() req: any) {
    return this.paymentsService.processPayment(
      { orderId, method: PaymentMethod.PIX },
      req.user.sub,
    );
  }

  // Webhook endpoints (no auth)
  @Post('webhook/stripe')
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      return { received: false };
    }
    await this.paymentsService.handleStripeWebhook(rawBody, signature);
    return { received: true };
  }

  @Post('webhook/mercadopago')
  async handleMercadoPagoWebhook(@Body() data: any) {
    await this.paymentsService.handleMercadoPagoWebhook(data);
    return { received: true };
  }

  // Development endpoint to simulate payment confirmation
  @Post('simulate/:orderId')
  @UseGuards(JwtAuthGuard)
  async simulatePayment(@Param('orderId') orderId: string) {
    await this.paymentsService.simulatePaymentConfirmation(orderId);
    return { success: true };
  }
}
