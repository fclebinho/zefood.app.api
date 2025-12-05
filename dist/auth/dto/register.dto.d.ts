import { UserRole } from '@prisma/client';
declare class AddressDto {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    latitude?: number;
    longitude?: number;
}
export declare class RegisterDto {
    email: string;
    password: string;
    name: string;
    phone?: string;
    role?: UserRole;
    address?: AddressDto;
}
export {};
