declare class OrderItemDto {
    menuItemId: string;
    quantity: number;
    notes?: string;
}
declare class DeliveryAddressDto {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
}
export declare class CreateOrderDto {
    restaurantId: string;
    addressId?: string;
    deliveryAddress?: DeliveryAddressDto;
    items: OrderItemDto[];
    paymentMethod: string;
    notes?: string;
    couponCode?: string;
}
export {};
