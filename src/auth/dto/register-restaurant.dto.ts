import { IsEmail, IsString, MinLength, IsOptional, Matches } from 'class-validator';
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

  // Address fields (required)
  @ApiProperty({ example: '01310-100', description: 'CEP do restaurante' })
  @IsString()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido' })
  zipCode: string;

  @ApiProperty({ example: 'Avenida Paulista', description: 'Rua/Avenida' })
  @IsString()
  street: string;

  @ApiProperty({ example: '1000', description: 'Número' })
  @IsString()
  number: string;

  @ApiPropertyOptional({ example: 'Sala 101', description: 'Complemento' })
  @IsString()
  @IsOptional()
  complement?: string;

  @ApiProperty({ example: 'Bela Vista', description: 'Bairro' })
  @IsString()
  neighborhood: string;

  @ApiProperty({ example: 'São Paulo', description: 'Cidade' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'SP', description: 'Estado (sigla)' })
  @IsString()
  @MinLength(2)
  state: string;
}
