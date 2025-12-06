import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { INestApplication, Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly logger = new Logger(RedisIoAdapter.name);

  constructor(app: INestApplication) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    // Support both REDIS_URL and REDIS_HOST/REDIS_PORT
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST || 'redis';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

    let pubClient: Redis;

    if (redisUrl) {
      this.logger.log(`Connecting to Redis at ${redisUrl}`);
      pubClient = new Redis(redisUrl);
    } else {
      this.logger.log(`Connecting to Redis at ${redisHost}:${redisPort}`);
      pubClient = new Redis({ host: redisHost, port: redisPort });
    }

    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => {
      this.logger.error(`Redis pubClient error: ${err.message}`);
    });

    subClient.on('error', (err) => {
      this.logger.error(`Redis subClient error: ${err.message}`);
    });

    this.adapterConstructor = createAdapter(pubClient, subClient);

    this.logger.log('Redis adapter connected successfully');
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
      this.logger.log('Socket.IO server using Redis adapter');
    }

    return server;
  }
}
