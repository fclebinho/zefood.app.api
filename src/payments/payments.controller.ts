import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  Headers,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService, CreatePaymentDto } from './payments.service';
import { PaymentMethod } from '@prisma/client';

class CardDataDto {
  @IsString()
  @IsNotEmpty()
  cardNumber: string;

  @IsString()
  @IsNotEmpty()
  cardholderName: string;

  @IsString()
  @IsNotEmpty()
  expirationMonth: string;

  @IsString()
  @IsNotEmpty()
  expirationYear: string;

  @IsString()
  @IsNotEmpty()
  securityCode: string;

  @IsString()
  @IsNotEmpty()
  identificationType: string;

  @IsString()
  @IsNotEmpty()
  identificationNumber: string;
}

class ProcessPaymentDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsString()
  @IsOptional()
  cardToken?: string;

  @ValidateNested()
  @Type(() => CardDataDto)
  @IsOptional()
  cardData?: CardDataDto;

  @IsString()
  @IsOptional()
  savedCardId?: string;

  @IsString()
  @IsOptional()
  securityCode?: string;
}

class SaveCardDto {
  @ValidateNested()
  @Type(() => CardDataDto)
  @IsNotEmpty()
  cardData: CardDataDto;
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

  // ==================== SAVED CARDS ====================

  @Get('cards')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getSavedCards(@Request() req: any) {
    return this.paymentsService.getSavedCards(req.user.sub);
  }

  @Post('cards')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async saveCard(@Body() dto: SaveCardDto, @Request() req: any) {
    return this.paymentsService.saveCard(req.user.sub, dto.cardData);
  }

  @Delete('cards/:cardId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async deleteCard(@Param('cardId') cardId: string, @Request() req: any) {
    await this.paymentsService.deleteCard(req.user.sub, cardId);
    return { success: true };
  }

  @Patch('cards/:cardId/default')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async setDefaultCard(@Param('cardId') cardId: string, @Request() req: any) {
    await this.paymentsService.setDefaultCard(req.user.sub, cardId);
    return { success: true };
  }

  // ==================== STRIPE ENDPOINTS ====================

  @Get('stripe/publishable-key')
  async getStripePublishableKey() {
    return { publishableKey: this.paymentsService.getStripePublishableKey() };
  }

  @Post('stripe/setup-intent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createStripeSetupIntent(@Request() req: any) {
    return this.paymentsService.createStripeSetupIntent(req.user.sub);
  }

  @Post('stripe/confirm-card')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async confirmStripeCard(
    @Body() dto: { paymentMethodId: string },
    @Request() req: any,
  ) {
    return this.paymentsService.confirmStripeCardSaved(req.user.sub, dto.paymentMethodId);
  }
}
