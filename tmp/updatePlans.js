const { PrismaClient } = require('c:/Users/szek6/Documents/Project/friend-ai/app/generated/prisma');
const prisma = new PrismaClient();

async function updatePlans() {
  const updates = [
    {
      name: 'pro',
      data: {
        price: 29,
        yearlyPrice: 304.24,
        stripePriceMonthly: 'price_1THHyKA7TElDOFCIqWQ6BiNp',
        stripePriceYearly: 'price_1THI1vA7TElDOFCIdYLboDHz',
      }
    },
    {
      name: 'premium',
      data: {
        price: 89,
        yearlyPrice: 939.84,
        stripePriceMonthly: 'price_1THHyrA7TElDOFCI0MhihrAH',
        stripePriceYearly: 'price_1THI3PA7TElDOFCIFfYlGPqT',
      }
    }
  ];

  try {
    for (const update of updates) {
      const result = await prisma.plan.updateMany({
        where: { name: update.name },
        data: update.data,
      });
      console.log(`Updated plan ${update.name}: ${result.count} records`);
    }
  } catch (error) {
    console.error('Update failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePlans();
