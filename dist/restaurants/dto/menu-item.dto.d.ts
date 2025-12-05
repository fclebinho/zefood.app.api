export declare class CreateMenuItemDto {
    categoryId: string;
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    isAvailable?: boolean;
    sortOrder?: number;
    prepTime?: number;
}
export declare class UpdateMenuItemDto {
    categoryId?: string;
    name?: string;
    description?: string;
    price?: number;
    imageUrl?: string;
    isAvailable?: boolean;
    sortOrder?: number;
    prepTime?: number;
}
