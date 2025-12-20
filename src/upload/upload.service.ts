import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as sharp from 'sharp';

export interface UploadResult {
  url: string;
  key: string;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
    const accessKey = process.env.S3_ACCESS_KEY || 'minioadmin';
    const secretKey = process.env.S3_SECRET_KEY || 'minioadmin123';
    this.bucket = process.env.S3_BUCKET || 'zefood';
    this.publicUrl = process.env.S3_PUBLIC_URL || 'http://localhost:9000/zefood';

    this.s3Client = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true, // Required for MinIO
    });

    this.logger.log(`S3 configured with endpoint: ${endpoint}, bucket: ${this.bucket}`);
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: string,
    options?: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
    },
  ): Promise<UploadResult> {
    const { maxWidth = 1200, maxHeight = 1200, quality = 80 } = options || {};

    // Generate unique filename
    const ext = 'webp'; // Always convert to webp for better compression
    const filename = `${uuidv4()}.${ext}`;
    const key = `${folder}/${filename}`;

    // Process image with sharp
    let processedBuffer: Buffer;
    try {
      processedBuffer = await sharp(file.buffer)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toBuffer();
    } catch (error) {
      this.logger.error('Error processing image with sharp:', error);
      // Fallback to original buffer if sharp fails
      processedBuffer = file.buffer;
    }

    // Upload to S3/MinIO
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: processedBuffer,
      ContentType: 'image/webp',
      ACL: 'public-read',
    });

    await this.s3Client.send(command);

    const url = `${this.publicUrl}/${key}`;
    this.logger.log(`Image uploaded: ${url}`);

    return { url, key };
  }

  async uploadRestaurantLogo(file: Express.Multer.File): Promise<UploadResult> {
    return this.uploadImage(file, 'restaurants/logos', {
      maxWidth: 400,
      maxHeight: 400,
      quality: 85,
    });
  }

  async uploadRestaurantCover(file: Express.Multer.File): Promise<UploadResult> {
    return this.uploadImage(file, 'restaurants/covers', {
      maxWidth: 1920,
      maxHeight: 600,
      quality: 80,
    });
  }

  async uploadMenuItemImage(file: Express.Multer.File): Promise<UploadResult> {
    return this.uploadImage(file, 'menu-items', {
      maxWidth: 800,
      maxHeight: 800,
      quality: 80,
    });
  }

  async deleteImage(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client.send(command);
      this.logger.log(`Image deleted: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting image ${key}:`, error);
    }
  }

  extractKeyFromUrl(url: string): string | null {
    if (!url) return null;
    const baseUrl = `${this.publicUrl}/`;
    if (url.startsWith(baseUrl)) {
      return url.replace(baseUrl, '');
    }
    return null;
  }
}
