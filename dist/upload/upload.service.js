"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var UploadService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadService = void 0;
const common_1 = require("@nestjs/common");
const client_s3_1 = require("@aws-sdk/client-s3");
const uuid_1 = require("uuid");
const sharp = require("sharp");
let UploadService = UploadService_1 = class UploadService {
    constructor() {
        this.logger = new common_1.Logger(UploadService_1.name);
        const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
        const accessKey = process.env.S3_ACCESS_KEY || 'minioadmin';
        const secretKey = process.env.S3_SECRET_KEY || 'minioadmin123';
        this.bucket = process.env.S3_BUCKET || 'foodapp';
        this.publicUrl = process.env.S3_PUBLIC_URL || 'http://localhost:9000/foodapp';
        this.s3Client = new client_s3_1.S3Client({
            endpoint,
            region: 'us-east-1',
            credentials: {
                accessKeyId: accessKey,
                secretAccessKey: secretKey,
            },
            forcePathStyle: true,
        });
        this.logger.log(`S3 configured with endpoint: ${endpoint}, bucket: ${this.bucket}`);
    }
    async uploadImage(file, folder, options) {
        const { maxWidth = 1200, maxHeight = 1200, quality = 80 } = options || {};
        const ext = 'webp';
        const filename = `${(0, uuid_1.v4)()}.${ext}`;
        const key = `${folder}/${filename}`;
        let processedBuffer;
        try {
            processedBuffer = await sharp(file.buffer)
                .resize(maxWidth, maxHeight, {
                fit: 'inside',
                withoutEnlargement: true,
            })
                .webp({ quality })
                .toBuffer();
        }
        catch (error) {
            this.logger.error('Error processing image with sharp:', error);
            processedBuffer = file.buffer;
        }
        const command = new client_s3_1.PutObjectCommand({
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
    async uploadRestaurantLogo(file) {
        return this.uploadImage(file, 'restaurants/logos', {
            maxWidth: 400,
            maxHeight: 400,
            quality: 85,
        });
    }
    async uploadRestaurantCover(file) {
        return this.uploadImage(file, 'restaurants/covers', {
            maxWidth: 1920,
            maxHeight: 600,
            quality: 80,
        });
    }
    async uploadMenuItemImage(file) {
        return this.uploadImage(file, 'menu-items', {
            maxWidth: 800,
            maxHeight: 800,
            quality: 80,
        });
    }
    async deleteImage(key) {
        try {
            const command = new client_s3_1.DeleteObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });
            await this.s3Client.send(command);
            this.logger.log(`Image deleted: ${key}`);
        }
        catch (error) {
            this.logger.error(`Error deleting image ${key}:`, error);
        }
    }
    extractKeyFromUrl(url) {
        if (!url)
            return null;
        const baseUrl = `${this.publicUrl}/`;
        if (url.startsWith(baseUrl)) {
            return url.replace(baseUrl, '');
        }
        return null;
    }
};
exports.UploadService = UploadService;
exports.UploadService = UploadService = UploadService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], UploadService);
//# sourceMappingURL=upload.service.js.map