import { PrismaClient } from '../generated/prisma';

/**
 * Prisma Client 单例封装 (Singleton Database Connection)
 * 
 * 作用：核心的数据库实例导出文件。在 Next.js 的开发环境下，为了防止代码热重载 (Hot Reloading) 
 * 触发 PrismaClient 被多次实例化而刷爆数据库并发连接数，需将连接对象缓存在 NodeJS 的全局共享区。
 * 
 * 注意：如果您在 Vercel 等 Serverless 服务器上部署报 `Too many connections`，
 * 务必去数据库所在的 `.env` 设置里的 `DATABASE_URL` 尾部加上诸如 `&connection_limit=10`
 * 又或者套上一层传输池加速器协议如 Prisma Accelerate 或是 PgBouncer。
 */

// 隐式断言：强行动用 Node 的 global 根域挂载一个不被垃圾回收清理的 prisma 引用槽
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// 提供全局唯一暴露出去的 const：如果对象内已有现成实例就借用，如果没有(首次启动)则重新构造一个
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // 环境嗅探与日志区分：若是开发环境则打满 query 甚至警告给控制台调试，若是生产环境为了精简资源仅输出 Error
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// 安全拦截点：只要不是在线生产环境（通常指在本机 NPM RUN DEV），则在全局登记。以应对热重启。
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
