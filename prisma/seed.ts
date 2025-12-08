import { PrismaClient, UserRole, UserStatus, RestaurantStatus, DriverStatus, VehicleType, RestaurantRole, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Realistic coordinates for São Paulo
const COORDINATES = {
  // Restaurants
  burgerKing: { lat: -23.5617, lng: -46.6563 }, // Av. Paulista, 1000
  pizzaHut: { lat: -23.5537, lng: -46.6597 },   // Rua Augusta, 500
  sushiMaster: { lat: -23.5578, lng: -46.6295 }, // Rua Liberdade, 200
  // Customers
  customerCasa: { lat: -23.5505, lng: -46.6333 },      // Centro
  customerTrabalho: { lat: -23.5629, lng: -46.6544 },  // Near Paulista
  // Drivers
  driver1: { lat: -23.5550, lng: -46.6400 },   // Between locations
  driver2: { lat: -23.5600, lng: -46.6500 },   // Near Paulista
};

async function main() {
  console.log('Seeding database...');

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'lanches' },
      update: {},
      create: {
        name: 'Lanches',
        slug: 'lanches',
        icon: '🍔',
        sortOrder: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'pizza' },
      update: {},
      create: {
        name: 'Pizza',
        slug: 'pizza',
        icon: '🍕',
        sortOrder: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'japonesa' },
      update: {},
      create: {
        name: 'Japonesa',
        slug: 'japonesa',
        icon: '🍣',
        sortOrder: 3,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'brasileira' },
      update: {},
      create: {
        name: 'Brasileira',
        slug: 'brasileira',
        icon: '🍛',
        sortOrder: 4,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'sobremesas' },
      update: {},
      create: {
        name: 'Sobremesas',
        slug: 'sobremesas',
        icon: '🍰',
        sortOrder: 5,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'bebidas' },
      update: {},
      create: {
        name: 'Bebidas',
        slug: 'bebidas',
        icon: '🥤',
        sortOrder: 6,
      },
    }),
  ]);

  console.log(`Created ${categories.length} categories`);

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@zefood.com' },
    update: {},
    create: {
      email: 'admin@zefood.com',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`Created admin user: ${adminUser.email}`);

  // Create customer user
  const customerPasswordHash = await bcrypt.hash('customer123', 12);
  const customerUser = await prisma.user.upsert({
    where: { email: 'cliente@teste.com' },
    update: {
      customer: {
        upsert: {
          create: {
            fullName: 'João Silva',
            cpf: '52998224725', // CPF válido para testes
          },
          update: {
            cpf: '52998224725', // Ensure CPF is set on existing customers
          },
        },
      },
    },
    create: {
      email: 'cliente@teste.com',
      passwordHash: customerPasswordHash,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      customer: {
        create: {
          fullName: 'João Silva',
          cpf: '52998224725', // CPF válido para testes
        },
      },
      addresses: {
        create: [
          {
            label: 'Casa',
            street: 'Rua das Flores',
            number: '123',
            neighborhood: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01310-100',
            latitude: COORDINATES.customerCasa.lat,
            longitude: COORDINATES.customerCasa.lng,
            isDefault: true,
          },
          {
            label: 'Trabalho',
            street: 'Av. Paulista',
            number: '1500',
            complement: 'Sala 1001',
            neighborhood: 'Bela Vista',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01310-200',
            latitude: COORDINATES.customerTrabalho.lat,
            longitude: COORDINATES.customerTrabalho.lng,
            isDefault: false,
          },
        ],
      },
    },
  });

  console.log(`Created customer user: ${customerUser.email}`);

  // Create restaurant user
  const restaurantPasswordHash = await bcrypt.hash('restaurant123', 12);
  const restaurantUser = await prisma.user.upsert({
    where: { email: 'restaurante@teste.com' },
    update: {},
    create: {
      email: 'restaurante@teste.com',
      passwordHash: restaurantPasswordHash,
      role: UserRole.RESTAURANT,
      status: UserStatus.ACTIVE,
    },
  });

  // Create restaurant
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'burger-king-centro' },
    update: {},
    create: {
      name: 'Burger King Centro',
      slug: 'burger-king-centro',
      description: 'Os melhores hambúrgueres da região!',
      phone: '1133334444',
      email: 'contato@burgerking.com',
      street: 'Av. Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310-100',
      latitude: COORDINATES.burgerKing.lat,
      longitude: COORDINATES.burgerKing.lng,
      logoUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200',
      coverUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800',
      deliveryFee: 5.99,
      minOrderValue: 20.00,
      avgPrepTime: 30,
      rating: 4.5,
      ratingCount: 1250,
      status: RestaurantStatus.ACTIVE,
      isOpen: true,
      categories: {
        create: {
          categoryId: categories[0].id,
        },
      },
      users: {
        create: {
          userId: restaurantUser.id,
          role: RestaurantRole.OWNER,
        },
      },
      hours: {
        create: [
          { dayOfWeek: 0, openTime: new Date('1970-01-01T11:00:00'), closeTime: new Date('1970-01-01T23:00:00') },
          { dayOfWeek: 1, openTime: new Date('1970-01-01T11:00:00'), closeTime: new Date('1970-01-01T23:00:00') },
          { dayOfWeek: 2, openTime: new Date('1970-01-01T11:00:00'), closeTime: new Date('1970-01-01T23:00:00') },
          { dayOfWeek: 3, openTime: new Date('1970-01-01T11:00:00'), closeTime: new Date('1970-01-01T23:00:00') },
          { dayOfWeek: 4, openTime: new Date('1970-01-01T11:00:00'), closeTime: new Date('1970-01-01T23:00:00') },
          { dayOfWeek: 5, openTime: new Date('1970-01-01T11:00:00'), closeTime: new Date('1970-01-02T00:00:00') },
          { dayOfWeek: 6, openTime: new Date('1970-01-01T11:00:00'), closeTime: new Date('1970-01-02T00:00:00') },
        ],
      },
    },
  });

  // Create menu category and items for burger restaurant
  const burgerMenuCategory = await prisma.menuCategory.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Hambúrgueres',
      sortOrder: 1,
    },
  });

  const sidesMenuCategory = await prisma.menuCategory.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Acompanhamentos',
      sortOrder: 2,
    },
  });

  const drinksMenuCategory = await prisma.menuCategory.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Bebidas',
      sortOrder: 3,
    },
  });

  const dessertsMenuCategory = await prisma.menuCategory.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Sobremesas',
      sortOrder: 4,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        categoryId: burgerMenuCategory.id,
        name: 'Whopper',
        description: 'Hambúrguer grelhado com queijo, alface, tomate, cebola, picles e maionese',
        price: 29.90,
        imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
        prepTime: 15,
      },
      {
        categoryId: burgerMenuCategory.id,
        name: 'Whopper Duplo',
        description: 'Whopper com duas carnes grelhadas',
        price: 39.90,
        imageUrl: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400',
        prepTime: 18,
      },
      {
        categoryId: burgerMenuCategory.id,
        name: 'Chicken Crispy',
        description: 'Frango empanado crocante com alface e maionese',
        price: 24.90,
        imageUrl: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400',
        prepTime: 12,
      },
      {
        categoryId: sidesMenuCategory.id,
        name: 'Batata Frita M',
        description: 'Porção média de batatas fritas crocantes',
        price: 9.90,
        imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400',
        prepTime: 5,
      },
      {
        categoryId: sidesMenuCategory.id,
        name: 'Batata Frita G',
        description: 'Porção grande de batatas fritas crocantes',
        price: 14.90,
        imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400',
        prepTime: 5,
      },
      {
        categoryId: sidesMenuCategory.id,
        name: 'Onion Rings',
        description: 'Anéis de cebola empanados e fritos',
        price: 12.90,
        imageUrl: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=400',
        prepTime: 8,
      },
      {
        categoryId: drinksMenuCategory.id,
        name: 'Coca-Cola 350ml',
        description: 'Refrigerante Coca-Cola lata',
        price: 6.90,
        imageUrl: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400',
        prepTime: 1,
      },
      {
        categoryId: drinksMenuCategory.id,
        name: 'Suco de Laranja 300ml',
        description: 'Suco natural de laranja',
        price: 8.90,
        prepTime: 3,
      },
      {
        categoryId: dessertsMenuCategory.id,
        name: 'Milk Shake Chocolate',
        description: 'Milk shake cremoso sabor chocolate',
        price: 15.90,
        imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400',
        prepTime: 5,
      },
      {
        categoryId: dessertsMenuCategory.id,
        name: 'Sundae Caramelo',
        description: 'Sorvete de baunilha com calda de caramelo',
        price: 9.90,
        prepTime: 3,
      },
    ],
  });

  console.log(`Created restaurant: ${restaurant.name}`);

  // Create driver user
  const driverPasswordHash = await bcrypt.hash('driver123', 12);
  const driverUser = await prisma.user.upsert({
    where: { email: 'entregador@teste.com' },
    update: {},
    create: {
      email: 'entregador@teste.com',
      passwordHash: driverPasswordHash,
      role: UserRole.DRIVER,
      status: UserStatus.ACTIVE,
      phone: '11988888888',
      driver: {
        create: {
          fullName: 'Carlos Motorista',
          cpf: '71428793860', // CPF válido para testes
          birthDate: new Date('1990-01-15'),
          vehicleType: VehicleType.MOTORCYCLE,
          vehiclePlate: 'ABC1D23',
          status: DriverStatus.APPROVED,
          isOnline: true,
          currentLat: COORDINATES.driver1.lat,
          currentLng: COORDINATES.driver1.lng,
          lastLocationAt: new Date(),
        },
      },
    },
  });

  console.log(`Created driver user: ${driverUser.email}`);

  // Create second driver user
  const driver2PasswordHash = await bcrypt.hash('driver456', 12);
  const driver2User = await prisma.user.upsert({
    where: { email: 'entregador2@teste.com' },
    update: {},
    create: {
      email: 'entregador2@teste.com',
      passwordHash: driver2PasswordHash,
      role: UserRole.DRIVER,
      status: UserStatus.ACTIVE,
      phone: '11977777777',
      driver: {
        create: {
          fullName: 'Maria Entregadora',
          cpf: '87748248800', // CPF válido para testes
          birthDate: new Date('1995-06-20'),
          vehicleType: VehicleType.BICYCLE,
          vehiclePlate: null,
          status: DriverStatus.APPROVED,
          isOnline: true,
          currentLat: COORDINATES.driver2.lat,
          currentLng: COORDINATES.driver2.lng,
          lastLocationAt: new Date(),
        },
      },
    },
  });

  console.log(`Created driver user: ${driver2User.email}`);

  // Create another restaurant (Pizza)
  const pizzaRestaurant = await prisma.restaurant.upsert({
    where: { slug: 'pizza-hut-centro' },
    update: {},
    create: {
      name: 'Pizza Hut Centro',
      slug: 'pizza-hut-centro',
      description: 'As melhores pizzas da cidade!',
      phone: '1144445555',
      email: 'contato@pizzahut.com',
      street: 'Rua Augusta',
      number: '500',
      neighborhood: 'Consolação',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01304-000',
      latitude: COORDINATES.pizzaHut.lat,
      longitude: COORDINATES.pizzaHut.lng,
      logoUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200',
      coverUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800',
      deliveryFee: 7.99,
      minOrderValue: 35.00,
      avgPrepTime: 40,
      rating: 4.3,
      ratingCount: 890,
      status: RestaurantStatus.ACTIVE,
      isOpen: true,
      categories: {
        create: {
          categoryId: categories[1].id,
        },
      },
    },
  });

  // Create menu category and items for pizza restaurant
  const pizzaMenuCategory = await prisma.menuCategory.create({
    data: {
      restaurantId: pizzaRestaurant.id,
      name: 'Pizzas Tradicionais',
      sortOrder: 1,
    },
  });

  const pizzaEspeciaisCategory = await prisma.menuCategory.create({
    data: {
      restaurantId: pizzaRestaurant.id,
      name: 'Pizzas Especiais',
      sortOrder: 2,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        categoryId: pizzaMenuCategory.id,
        name: 'Pizza Margherita',
        description: 'Molho de tomate, mussarela e manjericão fresco',
        price: 49.90,
        imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400',
        prepTime: 25,
      },
      {
        categoryId: pizzaMenuCategory.id,
        name: 'Pizza Calabresa',
        description: 'Molho de tomate, mussarela e calabresa fatiada',
        price: 54.90,
        imageUrl: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400',
        prepTime: 25,
      },
      {
        categoryId: pizzaEspeciaisCategory.id,
        name: 'Pizza Quatro Queijos',
        description: 'Mussarela, parmesão, gorgonzola e catupiry',
        price: 59.90,
        imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400',
        prepTime: 25,
      },
      {
        categoryId: pizzaMenuCategory.id,
        name: 'Pizza Portuguesa',
        description: 'Mussarela, presunto, ovo, cebola e azeitona',
        price: 56.90,
        prepTime: 28,
      },
    ],
  });

  console.log(`Created restaurant: ${pizzaRestaurant.name}`);

  // Create sushi restaurant
  const sushiRestaurant = await prisma.restaurant.upsert({
    where: { slug: 'sushi-master' },
    update: {},
    create: {
      name: 'Sushi Master',
      slug: 'sushi-master',
      description: 'Culinária japonesa autêntica',
      phone: '1155556666',
      email: 'contato@sushimaster.com',
      street: 'Rua Liberdade',
      number: '200',
      neighborhood: 'Liberdade',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01503-000',
      latitude: COORDINATES.sushiMaster.lat,
      longitude: COORDINATES.sushiMaster.lng,
      logoUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200',
      coverUrl: 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=800',
      deliveryFee: 8.99,
      minOrderValue: 50.00,
      avgPrepTime: 45,
      rating: 4.8,
      ratingCount: 650,
      status: RestaurantStatus.ACTIVE,
      isOpen: true,
      categories: {
        create: {
          categoryId: categories[2].id,
        },
      },
    },
  });

  // Create menu category and items for sushi restaurant
  const sushiCombosCategory = await prisma.menuCategory.create({
    data: {
      restaurantId: sushiRestaurant.id,
      name: 'Combos',
      sortOrder: 1,
    },
  });

  const sushiTemakisCategory = await prisma.menuCategory.create({
    data: {
      restaurantId: sushiRestaurant.id,
      name: 'Temakis',
      sortOrder: 2,
    },
  });

  const sushiEspeciaisCategory = await prisma.menuCategory.create({
    data: {
      restaurantId: sushiRestaurant.id,
      name: 'Especiais',
      sortOrder: 3,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        categoryId: sushiCombosCategory.id,
        name: 'Combo Salmão (10 peças)',
        description: '10 peças variadas de salmão',
        price: 69.90,
        imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400',
        prepTime: 20,
      },
      {
        categoryId: sushiTemakisCategory.id,
        name: 'Temaki Salmão',
        description: 'Temaki de salmão com cream cheese',
        price: 29.90,
        imageUrl: 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=400',
        prepTime: 10,
      },
      {
        categoryId: sushiEspeciaisCategory.id,
        name: 'Hot Roll (8 peças)',
        description: 'Hot roll empanado de salmão',
        price: 34.90,
        prepTime: 15,
      },
    ],
  });

  console.log(`Created restaurant: ${sushiRestaurant.name}`);

  // Get customer and driver data for orders
  const customer = await prisma.customer.findFirst({
    where: { user: { email: 'cliente@teste.com' } },
  });

  const driver = await prisma.driver.findFirst({
    where: { user: { email: 'entregador@teste.com' } },
  });

  const customerAddress = await prisma.address.findFirst({
    where: { userId: customerUser.id, isDefault: true },
  });

  // Get menu items for orders
  const whopper = await prisma.menuItem.findFirst({
    where: { name: 'Whopper' },
  });

  const batataFrita = await prisma.menuItem.findFirst({
    where: { name: 'Batata Frita M' },
  });

  const cocaCola = await prisma.menuItem.findFirst({
    where: { name: 'Coca-Cola 350ml' },
  });

  if (customer && driver && customerAddress && whopper && batataFrita && cocaCola) {
    // Create sample order - READY (waiting for driver)
    const orderReady = await prisma.order.upsert({
      where: { id: 'seed-order-ready-001' },
      update: {},
      create: {
        id: 'seed-order-ready-001',
        restaurantId: restaurant.id,
        customerId: customer.id,
        status: OrderStatus.READY,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        paymentStatus: PaymentStatus.PAID,
        subtotal: 46.70,
        deliveryFee: 5.99,
        total: 52.69,
        deliveryAddress: {
          street: customerAddress.street,
          number: customerAddress.number,
          neighborhood: customerAddress.neighborhood,
          city: customerAddress.city,
          state: customerAddress.state,
          zipCode: customerAddress.zipCode,
          latitude: customerAddress.latitude,
          longitude: customerAddress.longitude,
        },
        notes: 'Sem cebola no hambúrguer, por favor',
        estimatedDeliveryAt: new Date(Date.now() + 45 * 60 * 1000),
        items: {
          create: [
            {
              menuItemId: whopper.id,
              name: whopper.name,
              quantity: 1,
              unitPrice: 29.90,
              totalPrice: 29.90,
            },
            {
              menuItemId: batataFrita.id,
              name: batataFrita.name,
              quantity: 1,
              unitPrice: 9.90,
              totalPrice: 9.90,
            },
            {
              menuItemId: cocaCola.id,
              name: cocaCola.name,
              quantity: 1,
              unitPrice: 6.90,
              totalPrice: 6.90,
            },
          ],
        },
        statusHistory: {
          create: [
            { status: OrderStatus.PENDING, createdAt: new Date(Date.now() - 30 * 60 * 1000) },
            { status: OrderStatus.CONFIRMED, createdAt: new Date(Date.now() - 25 * 60 * 1000) },
            { status: OrderStatus.PREPARING, createdAt: new Date(Date.now() - 20 * 60 * 1000) },
            { status: OrderStatus.READY, createdAt: new Date(Date.now() - 5 * 60 * 1000) },
          ],
        },
      },
    });

    console.log(`Created order READY: ${orderReady.id}`);

    // Create sample order - IN_TRANSIT (driver delivering)
    const orderInTransit = await prisma.order.upsert({
      where: { id: 'seed-order-transit-001' },
      update: {},
      create: {
        id: 'seed-order-transit-001',
        restaurantId: restaurant.id,
        customerId: customer.id,
        driverId: driver.id,
        status: OrderStatus.IN_TRANSIT,
        paymentMethod: PaymentMethod.PIX,
        paymentStatus: PaymentStatus.PAID,
        subtotal: 39.80,
        deliveryFee: 5.99,
        total: 45.79,
        deliveryAddress: {
          street: 'Av. Paulista',
          number: '1500',
          complement: 'Sala 1001',
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '01310-200',
          latitude: COORDINATES.customerTrabalho.lat,
          longitude: COORDINATES.customerTrabalho.lng,
        },
        notes: null,
        pickedUpAt: new Date(Date.now() - 10 * 60 * 1000),
        estimatedDeliveryAt: new Date(Date.now() + 15 * 60 * 1000),
        items: {
          create: [
            {
              menuItemId: whopper.id,
              name: whopper.name,
              quantity: 1,
              unitPrice: 29.90,
              totalPrice: 29.90,
            },
            {
              menuItemId: batataFrita.id,
              name: batataFrita.name,
              quantity: 1,
              unitPrice: 9.90,
              totalPrice: 9.90,
            },
          ],
        },
        statusHistory: {
          create: [
            { status: OrderStatus.PENDING, createdAt: new Date(Date.now() - 60 * 60 * 1000) },
            { status: OrderStatus.CONFIRMED, createdAt: new Date(Date.now() - 55 * 60 * 1000) },
            { status: OrderStatus.PREPARING, createdAt: new Date(Date.now() - 50 * 60 * 1000) },
            { status: OrderStatus.READY, createdAt: new Date(Date.now() - 20 * 60 * 1000) },
            { status: OrderStatus.PICKED_UP, createdAt: new Date(Date.now() - 10 * 60 * 1000) },
            { status: OrderStatus.IN_TRANSIT, createdAt: new Date(Date.now() - 5 * 60 * 1000) },
          ],
        },
      },
    });

    console.log(`Created order IN_TRANSIT: ${orderInTransit.id}`);
  }

  console.log('Seed completed successfully!');
  console.log('\n--- Test Accounts ---');
  console.log('Admin: admin@zefood.com / admin123');
  console.log('Customer: cliente@teste.com / customer123');
  console.log('Restaurant: restaurante@teste.com / restaurant123');
  console.log('Driver 1: entregador@teste.com / driver123');
  console.log('Driver 2: entregador2@teste.com / driver456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
