import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RedisIoAdapter } from './websocket/redis-io.adapter';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Configure Socket.IO adapter with Redis for multi-replica support
  const redisIoAdapter = new RedisIoAdapter(app);
  try {
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
    logger.log('Using Redis adapter for Socket.IO');
  } catch (error) {
    logger.warn(`Failed to connect to Redis: ${error.message}. Using default adapter.`);
    // Fallback to default adapter if Redis is not available
    const { IoAdapter } = await import('@nestjs/platform-socket.io');
    app.useWebSocketAdapter(new IoAdapter(app));
  }

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:8081',
      'https://zefood.app',
      'https://www.zefood.app',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('ZeFood API')
    .setDescription('API para o sistema de delivery ZeFood')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Autenticação e registro')
    .addTag('users', 'Gerenciamento de usuários')
    .addTag('restaurants', 'Gerenciamento de restaurantes')
    .addTag('orders', 'Gerenciamento de pedidos')
    .addTag('drivers', 'Gerenciamento de entregadores')
    .addTag('payments', 'Processamento de pagamentos')
    .addTag('upload', 'Upload de arquivos')
    .addTag('admin', 'Painel administrativo')
    .addTag('tracking', 'Rastreamento de entregas')
    .addTag('settings', 'Configurações do sistema')
    .addTag('health', 'Health check')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/docs`);
}

bootstrap();
