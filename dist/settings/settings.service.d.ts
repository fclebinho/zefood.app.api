import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
export declare class SettingsService implements OnModuleInit {
    private readonly prisma;
    private cache;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    private seedDefaultSettings;
    private loadCache;
    private parseValue;
    private stringifyValue;
    get<T = any>(key: string): Promise<T | null>;
    getByCategory(category: string): Promise<any>;
    getAll(): Promise<any>;
    getPublicSettings(): Promise<Record<string, any>>;
    update(key: string, value: any): Promise<any>;
    updateMany(settings: Record<string, any>): Promise<any[]>;
    calculateDeliveryFee(distanceKm: number, orderTotal: number): Promise<number>;
    getCategories(): Promise<any>;
}
