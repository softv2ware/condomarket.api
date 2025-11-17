import { PrismaClient, UserRole, UserStatus, BuildingType, BuildingStatus, SubscriptionTier, CategoryType } from '../src/prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create Platform Admin
  const platformAdminPassword = await bcrypt.hash('admin123', 10);
  const platformAdmin = await prisma.user.upsert({
    where: { email: 'admin@condomarket.com' },
    update: {},
    create: {
      email: 'admin@condomarket.com',
      password: platformAdminPassword,
      role: UserRole.PLATFORM_ADMIN,
      status: UserStatus.VERIFIED,
      profile: {
        create: {
          firstName: 'Platform',
          lastName: 'Admin',
          bio: 'Platform administrator with full system access',
        },
      },
    },
  });
  console.log('✅ Platform Admin created:', platformAdmin.email);

  // Create Subscription Plans
  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { tier: SubscriptionTier.FREE },
    update: {},
    create: {
      name: 'Free Plan',
      tier: SubscriptionTier.FREE,
      description: 'Perfect for trying out the marketplace with basic features',
      monthlyPrice: 0,
      currency: 'USD',
      maxActiveListings: 1,
      sortPriority: 0,
      isHighlightEnabled: false,
      isDefaultFree: true,
      isActive: true,
    },
  });
  console.log('✅ Subscription Plan created:', freePlan.name);

  const standardPlan = await prisma.subscriptionPlan.upsert({
    where: { tier: SubscriptionTier.STANDARD },
    update: {},
    create: {
      name: 'Standard Plan',
      tier: SubscriptionTier.STANDARD,
      description: 'Great for active sellers with multiple listings',
      monthlyPrice: 9.99,
      currency: 'USD',
      maxActiveListings: 10,
      sortPriority: 5,
      isHighlightEnabled: false,
      isDefaultFree: false,
      isActive: true,
    },
  });
  console.log('✅ Subscription Plan created:', standardPlan.name);

  const premiumPlan = await prisma.subscriptionPlan.upsert({
    where: { tier: SubscriptionTier.PREMIUM },
    update: {},
    create: {
      name: 'Premium Plan',
      tier: SubscriptionTier.PREMIUM,
      description: 'Best for power sellers - unlimited listings with premium features',
      monthlyPrice: 29.99,
      currency: 'USD',
      maxActiveListings: 999999, // Unlimited
      sortPriority: 10,
      isHighlightEnabled: true,
      isDefaultFree: false,
      isActive: true,
    },
  });
  console.log('✅ Subscription Plan created:', premiumPlan.name);

  // Create Categories (Platform-wide)
  console.log('🏷️  Creating categories...');
  
  // Check if categories already exist
  const existingCategories = await prisma.category.findMany();
  
  if (existingCategories.length === 0) {
    // Create all categories at once
    await prisma.category.createMany({
      data: [
        // Product Categories
        {
          name: 'Electronics',
          slug: 'electronics',
          type: CategoryType.PRODUCT,
          description: 'Electronic devices, gadgets, and accessories',
          icon: '📱',
        },
        {
          name: 'Furniture',
          slug: 'furniture',
          type: CategoryType.PRODUCT,
          description: 'Home and office furniture',
          icon: '🛋️',
        },
        {
          name: 'Appliances',
          slug: 'appliances',
          type: CategoryType.PRODUCT,
          description: 'Kitchen and home appliances',
          icon: '🔌',
        },
        {
          name: 'Clothing & Accessories',
          slug: 'clothing',
          type: CategoryType.PRODUCT,
          description: 'Clothing, shoes, and fashion accessories',
          icon: '👔',
        },
        {
          name: 'Books & Media',
          slug: 'books-media',
          type: CategoryType.PRODUCT,
          description: 'Books, magazines, CDs, DVDs, and games',
          icon: '📚',
        },
        {
          name: 'Sports & Outdoors',
          slug: 'sports-outdoors',
          type: CategoryType.PRODUCT,
          description: 'Sports equipment, fitness gear, and outdoor items',
          icon: '⚽',
        },
        {
          name: 'Kitchen & Dining',
          slug: 'kitchen-dining',
          type: CategoryType.PRODUCT,
          description: 'Cookware, dishware, and kitchen accessories',
          icon: '🍳',
        },
        {
          name: 'Home Decor',
          slug: 'home-decor',
          type: CategoryType.PRODUCT,
          description: 'Decorative items, art, and home accessories',
          icon: '🖼️',
        },
        {
          name: 'Baby & Kids',
          slug: 'baby-kids',
          type: CategoryType.PRODUCT,
          description: 'Baby gear, toys, and children\'s items',
          icon: '👶',
        },
        {
          name: 'Pet Supplies',
          slug: 'pet-supplies',
          type: CategoryType.PRODUCT,
          description: 'Pet food, toys, and accessories',
          icon: '🐾',
        },
        // Service Categories
        {
          name: 'Cleaning Services',
          slug: 'cleaning',
          type: CategoryType.SERVICE,
          description: 'House cleaning and maintenance services',
          icon: '🧹',
        },
        {
          name: 'Handyman Services',
          slug: 'handyman',
          type: CategoryType.SERVICE,
          description: 'Home repairs and maintenance',
          icon: '🔧',
        },
        {
          name: 'Pet Care',
          slug: 'pet-care',
          type: CategoryType.SERVICE,
          description: 'Pet sitting, walking, and grooming services',
          icon: '🐕',
        },
        {
          name: 'Tutoring & Education',
          slug: 'tutoring',
          type: CategoryType.SERVICE,
          description: 'Educational tutoring and lessons',
          icon: '📖',
        },
        {
          name: 'Moving & Delivery',
          slug: 'moving-delivery',
          type: CategoryType.SERVICE,
          description: 'Moving help and delivery services',
          icon: '📦',
        },
        {
          name: 'Babysitting & Childcare',
          slug: 'babysitting',
          type: CategoryType.SERVICE,
          description: 'Childcare and babysitting services',
          icon: '👨‍👩‍👧',
        },
        {
          name: 'Personal Training',
          slug: 'personal-training',
          type: CategoryType.SERVICE,
          description: 'Fitness training and coaching',
          icon: '💪',
        },
        {
          name: 'Beauty & Wellness',
          slug: 'beauty-wellness',
          type: CategoryType.SERVICE,
          description: 'Hair, makeup, massage, and wellness services',
          icon: '💅',
        },
        {
          name: 'Tech Support',
          slug: 'tech-support',
          type: CategoryType.SERVICE,
          description: 'Computer and tech troubleshooting',
          icon: '💻',
        },
        {
          name: 'Event Planning',
          slug: 'event-planning',
          type: CategoryType.SERVICE,
          description: 'Event planning and coordination services',
          icon: '🎉',
        },
      ],
      skipDuplicates: true,
    });
    
    console.log('✅ Created 20 categories (10 products + 10 services)');
  } else {
    console.log('✅ Categories already exist, skipping creation');
  }

  // Create Building 1: Sunset Towers
  const buildingAdmin1Password = await bcrypt.hash('admin123', 10);
  const buildingAdmin1 = await prisma.user.upsert({
    where: { email: 'admin@sunsettowers.com' },
    update: {},
    create: {
      email: 'admin@sunsettowers.com',
      password: buildingAdmin1Password,
      role: UserRole.BUILDING_ADMIN,
      status: UserStatus.VERIFIED,
      profile: {
        create: {
          firstName: 'Sarah',
          lastName: 'Johnson',
          bio: 'Building manager at Sunset Towers',
        },
      },
    },
  });

  const building1 = await prisma.building.upsert({
    where: { id: 'building-1' },
    update: {},
    create: {
      id: 'building-1',
      name: 'Sunset Towers',
      address: '123 Main Street',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
      country: 'USA',
      type: BuildingType.APARTMENT_COMPLEX,
      status: BuildingStatus.ACTIVE,
      description: 'Luxury apartment complex in the heart of San Francisco',
      adminId: buildingAdmin1.id,
    },
  });
  console.log('✅ Building created:', building1.name);

  // Create units for Building 1
  const units1 = await Promise.all([
    prisma.unit.upsert({
      where: { id: 'unit-1-101' },
      update: {},
      create: {
        id: 'unit-1-101',
        buildingId: building1.id,
        unitNumber: '101',
        floor: 1,
        type: '2BR/1BA',
      },
    }),
    prisma.unit.upsert({
      where: { id: 'unit-1-102' },
      update: {},
      create: {
        id: 'unit-1-102',
        buildingId: building1.id,
        unitNumber: '102',
        floor: 1,
        type: '1BR/1BA',
      },
    }),
    prisma.unit.upsert({
      where: { id: 'unit-1-201' },
      update: {},
      create: {
        id: 'unit-1-201',
        buildingId: building1.id,
        unitNumber: '201',
        floor: 2,
        type: '3BR/2BA',
      },
    }),
  ]);
  console.log('✅ Created', units1.length, 'units for Sunset Towers');

  // Create residents for Building 1
  const resident1Password = await bcrypt.hash('resident123', 10);
  const resident1 = await prisma.user.upsert({
    where: { email: 'john.doe@example.com' },
    update: {},
    create: {
      email: 'john.doe@example.com',
      password: resident1Password,
      role: UserRole.RESIDENT,
      status: UserStatus.VERIFIED,
      profile: {
        create: {
          firstName: 'John',
          lastName: 'Doe',
          bio: 'Software engineer and tech enthusiast',
          acceptedPaymentMethods: ['Venmo', 'PayPal', 'Cash'],
          privacySettings: {
            showEmail: false,
            showPhone: true,
          },
        },
      },
    },
  });

  await prisma.residentBuilding.upsert({
    where: {
      userId_buildingId: {
        userId: resident1.id,
        buildingId: building1.id,
      },
    },
    update: {},
    create: {
      userId: resident1.id,
      buildingId: building1.id,
      unitId: units1[0].id,
      verificationMethod: 'INVITATION_CODE',
      verificationStatus: 'APPROVED',
      verifiedAt: new Date(),
      verifiedBy: buildingAdmin1.id,
    },
  });
  console.log('✅ Resident created:', resident1.email);

  const resident2Password = await bcrypt.hash('resident123', 10);
  const resident2 = await prisma.user.upsert({
    where: { email: 'jane.smith@example.com' },
    update: {},
    create: {
      email: 'jane.smith@example.com',
      password: resident2Password,
      role: UserRole.RESIDENT,
      status: UserStatus.VERIFIED,
      profile: {
        create: {
          firstName: 'Jane',
          lastName: 'Smith',
          bio: 'Graphic designer and plant lover',
          acceptedPaymentMethods: ['Zelle', 'Cash'],
          privacySettings: {
            showEmail: true,
            showPhone: false,
          },
        },
      },
    },
  });

  await prisma.residentBuilding.upsert({
    where: {
      userId_buildingId: {
        userId: resident2.id,
        buildingId: building1.id,
      },
    },
    update: {},
    create: {
      userId: resident2.id,
      buildingId: building1.id,
      unitId: units1[2].id,
      verificationMethod: 'UNIT_CODE_LASTNAME',
      verificationStatus: 'APPROVED',
      verifiedAt: new Date(),
      verifiedBy: buildingAdmin1.id,
    },
  });
  console.log('✅ Resident created:', resident2.email);

  // Create Building 2: Harbor View Condos
  const buildingAdmin2Password = await bcrypt.hash('admin123', 10);
  const buildingAdmin2 = await prisma.user.upsert({
    where: { email: 'admin@harborview.com' },
    update: {},
    create: {
      email: 'admin@harborview.com',
      password: buildingAdmin2Password,
      role: UserRole.BUILDING_ADMIN,
      status: UserStatus.VERIFIED,
      profile: {
        create: {
          firstName: 'Michael',
          lastName: 'Chen',
          bio: 'Building manager at Harbor View Condos',
        },
      },
    },
  });

  const building2 = await prisma.building.upsert({
    where: { id: 'building-2' },
    update: {},
    create: {
      id: 'building-2',
      name: 'Harbor View Condos',
      address: '456 Ocean Boulevard',
      city: 'Miami',
      state: 'FL',
      zipCode: '33139',
      country: 'USA',
      type: BuildingType.CONDOMINIUM,
      status: BuildingStatus.ACTIVE,
      description: 'Waterfront condominiums with stunning ocean views',
      adminId: buildingAdmin2.id,
    },
  });
  console.log('✅ Building created:', building2.name);

  // Create units for Building 2
  const units2 = await Promise.all([
    prisma.unit.upsert({
      where: { id: 'unit-2-301' },
      update: {},
      create: {
        id: 'unit-2-301',
        buildingId: building2.id,
        unitNumber: '301',
        floor: 3,
        type: '2BR/2BA',
      },
    }),
    prisma.unit.upsert({
      where: { id: 'unit-2-302' },
      update: {},
      create: {
        id: 'unit-2-302',
        buildingId: building2.id,
        unitNumber: '302',
        floor: 3,
        type: '3BR/2BA',
      },
    }),
  ]);
  console.log('✅ Created', units2.length, 'units for Harbor View Condos');

  // Create invitation codes for Building 1
  const invitationCode1 = await prisma.invitationCode.upsert({
    where: { code: 'SUNSET2024ABC' },
    update: {},
    create: {
      code: 'SUNSET2024ABC',
      buildingId: building1.id,
      createdBy: buildingAdmin1.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      isActive: true,
    },
  });
  console.log('✅ Invitation code created:', invitationCode1.code, 'for Building 1');

  const invitationCode2 = await prisma.invitationCode.upsert({
    where: { code: 'HARBOR2024XYZ' },
    update: {},
    create: {
      code: 'HARBOR2024XYZ',
      buildingId: building2.id,
      createdBy: buildingAdmin2.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      isActive: true,
    },
  });
  console.log('✅ Invitation code created:', invitationCode2.code, 'for Building 2');

  console.log('\n🎉 Seeding completed successfully!\n');
  console.log('📝 Test Credentials:');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ Platform Admin:                                             │');
  console.log('│   Email: admin@condomarket.com                              │');
  console.log('│   Password: admin123                                        │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ Building Admin 1 (Sunset Towers):                           │');
  console.log('│   Email: admin@sunsettowers.com                             │');
  console.log('│   Password: admin123                                        │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ Building Admin 2 (Harbor View):                             │');
  console.log('│   Email: admin@harborview.com                               │');
  console.log('│   Password: admin123                                        │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ Resident 1 (Sunset Towers, Unit 101):                       │');
  console.log('│   Email: john.doe@example.com                               │');
  console.log('│   Password: resident123                                     │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ Resident 2 (Sunset Towers, Unit 201):                       │');
  console.log('│   Email: jane.smith@example.com                             │');
  console.log('│   Password: resident123                                     │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('\n� Subscription Plans:');
  console.log('  - FREE: $0/month, 1 active listing (default)');
  console.log('  - STANDARD: $9.99/month, 10 active listings');
  console.log('  - PREMIUM: $29.99/month, unlimited listings + highlights');
  console.log('\n�📌 Invitation Codes:');
  console.log('  - SUNSET2024ABC (Sunset Towers, Unit 102)');
  console.log('  - HARBOR2024XYZ (Harbor View, Unit 301)');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
