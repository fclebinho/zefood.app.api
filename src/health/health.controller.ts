import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import * as packageJson from '../../package.json';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Verificar saúde da aplicação' })
  @ApiResponse({ status: 200, description: 'Aplicação saudável' })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        version: packageJson.version,
      };
    } catch {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        version: packageJson.version,
      };
    }
  }

  @Get('version')
  @ApiOperation({ summary: 'Retorna a versão da API' })
  @ApiResponse({ status: 200, description: 'Versão da API' })
  getVersion() {
    return {
      name: packageJson.name,
      version: packageJson.version,
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
