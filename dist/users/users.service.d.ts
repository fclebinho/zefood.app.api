import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateAddressDto } from './dto/create-address.dto';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findByEmail(email: string): Promise<({
        customer: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            fullName: string;
            cpf: string | null;
            birthDate: Date | null;
        } | null;
    } & {
        phone: string | null;
        id: string;
        email: string;
        passwordHash: string;
        role: import(".prisma/client").$Enums.UserRole;
        status: import(".prisma/client").$Enums.UserStatus;
        emailVerified: boolean;
        phoneVerified: boolean;
        avatarUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
    }) | null>;
    findById(id: string): Promise<{
        customer: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            fullName: string;
            cpf: string | null;
            birthDate: Date | null;
        } | null;
        addresses: {
            number: string;
            street: string;
            complement: string | null;
            neighborhood: string;
            city: string;
            state: string;
            zipCode: string;
            latitude: import("@prisma/client/runtime/library").Decimal | null;
            longitude: import("@prisma/client/runtime/library").Decimal | null;
            isDefault: boolean;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            label: string | null;
        }[];
    } & {
        phone: string | null;
        id: string;
        email: string;
        passwordHash: string;
        role: import(".prisma/client").$Enums.UserRole;
        status: import(".prisma/client").$Enums.UserStatus;
        emailVerified: boolean;
        phoneVerified: boolean;
        avatarUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: string, updateUserDto: UpdateUserDto): Promise<{
        customer: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            fullName: string;
            cpf: string | null;
            birthDate: Date | null;
        } | null;
    } & {
        phone: string | null;
        id: string;
        email: string;
        passwordHash: string;
        role: import(".prisma/client").$Enums.UserRole;
        status: import(".prisma/client").$Enums.UserStatus;
        emailVerified: boolean;
        phoneVerified: boolean;
        avatarUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getProfile(userId: string): Promise<{
        customer: {
            id: string;
            fullName: string;
            cpf: string | null;
        } | null;
        phone: string | null;
        id: string;
        email: string;
        role: import(".prisma/client").$Enums.UserRole;
        status: import(".prisma/client").$Enums.UserStatus;
        createdAt: Date;
        addresses: {
            number: string;
            street: string;
            complement: string | null;
            neighborhood: string;
            city: string;
            state: string;
            zipCode: string;
            latitude: import("@prisma/client/runtime/library").Decimal | null;
            longitude: import("@prisma/client/runtime/library").Decimal | null;
            isDefault: boolean;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            label: string | null;
        }[];
    }>;
    getAddresses(userId: string): Promise<{
        number: string;
        street: string;
        complement: string | null;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
        latitude: import("@prisma/client/runtime/library").Decimal | null;
        longitude: import("@prisma/client/runtime/library").Decimal | null;
        isDefault: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        label: string | null;
    }[]>;
    createAddress(userId: string, createAddressDto: CreateAddressDto): Promise<{
        number: string;
        street: string;
        complement: string | null;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
        latitude: import("@prisma/client/runtime/library").Decimal | null;
        longitude: import("@prisma/client/runtime/library").Decimal | null;
        isDefault: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        label: string | null;
    }>;
    updateAddress(userId: string, addressId: string, updateAddressDto: CreateAddressDto): Promise<{
        number: string;
        street: string;
        complement: string | null;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
        latitude: import("@prisma/client/runtime/library").Decimal | null;
        longitude: import("@prisma/client/runtime/library").Decimal | null;
        isDefault: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        label: string | null;
    }>;
    deleteAddress(userId: string, addressId: string): Promise<{
        message: string;
    }>;
    setDefaultAddress(userId: string, addressId: string): Promise<{
        number: string;
        street: string;
        complement: string | null;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
        latitude: import("@prisma/client/runtime/library").Decimal | null;
        longitude: import("@prisma/client/runtime/library").Decimal | null;
        isDefault: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        label: string | null;
    }>;
}
