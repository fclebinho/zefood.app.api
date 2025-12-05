declare class OpeningHourDto {
    dayOfWeek: number;
    openTime?: string;
    closeTime?: string;
    isClosed?: boolean;
}
export declare class UpdateRestaurantSettingsDto {
    name?: string;
    description?: string;
    phone?: string;
    email?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    deliveryFee?: number;
    minOrderValue?: number;
    avgPrepTime?: number;
    deliveryRadius?: number;
    isOpen?: boolean;
    openingHours?: OpeningHourDto[];
}
export {};
