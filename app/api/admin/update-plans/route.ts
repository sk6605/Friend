import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';

export async function GET(req: NextRequest) {
  // Simple check for safety
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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

    for (const update of updates) {
      await prisma.plan.update({
        where: { name: update.name },
        data: update.data,
      });
    }

    return NextResponse.json({ success: true, message: 'Plans updated successfully' });
  } catch (error) {
    console.error('Update plans error:', error);
    return NextResponse.json({ error: 'Failed to update plans' }, { status: 500 });
  }
}
