import { UploadService } from './upload.service';
export declare class UploadController {
    private readonly uploadService;
    constructor(uploadService: UploadService);
    uploadRestaurantLogo(file: Express.Multer.File): Promise<import("./upload.service").UploadResult>;
    uploadRestaurantCover(file: Express.Multer.File): Promise<import("./upload.service").UploadResult>;
    uploadMenuItemImage(file: Express.Multer.File): Promise<import("./upload.service").UploadResult>;
}
