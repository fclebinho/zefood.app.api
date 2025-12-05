import { SettingsService } from './settings.service';
declare class UpdateSettingDto {
    value: any;
}
declare class UpdateManySettingsDto {
    settings: Record<string, any>;
}
export declare class SettingsController {
    private readonly settingsService;
    constructor(settingsService: SettingsService);
    getPublicSettings(): Promise<Record<string, any>>;
    getAllSettings(): Promise<any>;
    getByCategory(category: string): Promise<any>;
    getCategories(): Promise<any>;
    updateSetting(key: string, dto: UpdateSettingDto): Promise<any>;
    updateManySettings(dto: UpdateManySettingsDto): Promise<any[]>;
    calculateDeliveryFee(distance: string, total: string): Promise<{
        fee: number;
    }>;
}
export {};
