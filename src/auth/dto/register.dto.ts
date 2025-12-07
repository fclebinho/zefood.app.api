import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

class AddressDto {
  @ApiProperty({ example: 'Rua das Flores', description: 'Nome da rua' })
  @IsString()
  street: string;

  @ApiProperty({ example: '123', description: 'Número do endereço' })
  @IsString()
  number: string;

  @ApiPropertyOptional({ example: 'Apto 101', description: 'Complemento' })
  @IsString()
  @IsOptional()
  complement?: string;

  @ApiProperty({ example: 'Centro', description: 'Bairro' })
  @IsString()
  neighborhood: string;

  @ApiProperty({ example: 'São Paulo', description: 'Cidade' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'SP', description: 'Estado' })
  @IsString()
  state: string;

  @ApiProperty({ example: '01234-567', description: 'CEP' })
  @IsString()
  zipCode: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email do usuário' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senha123', description: 'Senha do usuário', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'João Silva', description: 'Nome completo' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '11999999999', description: 'Telefone' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ enum: UserRole, description: 'Papel do usuário' })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({ type: AddressDto, description: 'Endereço do usuário' })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}
