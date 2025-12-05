export interface UploadResult {
    url: string;
    key: string;
}
export declare class UploadService {
    private readonly logger;
    private readonly s3Client;
    private readonly bucket;
    private readonly publicUrl;
    constructor();
    uploadImage(file: Express.Multer.File, folder: string, options?: {
        maxWidth?: number;
        maxHeight?: number;
        quality?: number;
    }): Promise<UploadResult>;
    uploadRestaurantLogo(file: Express.Multer.File): Promise<UploadResult>;
    uploadRestaurantCover(file: Express.Multer.File): Promise<UploadResult>;
    uploadMenuItemImage(file: Express.Multer.File): Promise<UploadResult>;
    deleteImage(key: string): Promise<void>;
    extractKeyFromUrl(url: string): string | null;
}
