import {
  IsString,
  IsArray,
  IsNumber,
  IsOptional,
  ValidateNested,
  Min,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class OrderItemDto {
  @ApiProperty({ description: 'ID do item do menu' })
  @IsString()
  menuItemId: string;

  @ApiProperty({ example: 2, description: 'Quantidade', minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 'Sem cebola', description: 'Observações do item' })
  @IsString()
  @IsOptional()
  notes?: string;
}

class DeliveryAddressDto {
  @ApiProperty({ example: 'Rua das Flores' })
  @IsString()
  street: string;

  @ApiProperty({ example: '123' })
  @IsString()
  number: string;

  @ApiPropertyOptional({ example: 'Apto 101' })
  @IsString()
  @IsOptional()
  complement?: string;

  @ApiProperty({ example: 'Centro' })
  @IsString()
  neighborhood: string;

  @ApiProperty({ example: 'São Paulo' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'SP' })
  @IsString()
  state: string;

  @ApiProperty({ example: '01234-567' })
  @IsString()
  zipCode: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'ID do restaurante' })
  @IsString()
  restaurantId: string;

  @ApiPropertyOptional({ description: 'ID do endereço salvo' })
  @IsString()
  @IsOptional()
  addressId?: string;

  @ApiPropertyOptional({ type: DeliveryAddressDto, description: 'Endereço de entrega' })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress?: DeliveryAddressDto;

  @ApiProperty({ type: [OrderItemDto], description: 'Itens do pedido' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ example: 'PIX', description: 'Método de pagamento' })
  @IsString()
  paymentMethod: string;

  @ApiPropertyOptional({ example: 'Entregar na portaria', description: 'Observações' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: 'DESCONTO10', description: 'Código do cupom' })
  @IsString()
  @IsOptional()
  couponCode?: string;
}
