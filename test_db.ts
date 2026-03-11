import { prisma } from './app/lib/db';

async function main() {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            nickname: true,
            city: true,
            pushSubscription: true
        }
    });
    console.log("Users:", JSON.stringify(users, null, 2));
}

main().catch(console.error);
