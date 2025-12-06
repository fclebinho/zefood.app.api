import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterRestaurantDto {
  @ApiProperty({ example: 'restaurante@example.com', description: 'Email do proprietário' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senha123', description: 'Senha', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'João Silva', description: 'Nome do proprietário' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '11999999999', description: 'Telefone' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'Pizzaria do João', description: 'Nome do restaurante' })
  @IsString()
  restaurantName: string;

  @ApiPropertyOptional({ example: 'A melhor pizza da cidade', description: 'Descrição' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'Pizzaria', description: 'Categoria do restaurante' })
  @IsString()
  @IsOptional()
  category?: string;
}
