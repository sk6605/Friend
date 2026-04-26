import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getStripe } from '@/app/lib/stripe';
import Stripe from 'stripe';

export const runtime = 'nodejs';

/**
 * 助手函数：解析订阅周期时间戳
 */
function getSubscriptionPeriod(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  return {
    start: new Date(item.current_period_start * 1000),
    end: new Date(item.current_period_end * 1000),
  };
}

/**
 * 接口：POST /api/subscription/webhook
 * 作用：接收来自 Stripe 的异步事件推送。
 * 
 * 核心流程：
 * 1. 签名校验 (constructEvent)：确保请求确实来自 Stripe 而非恶意伪造。
 * 2. 事件分发：
 *    - checkout.session.completed: 用户首次支付成功，初始化订阅记录。
 *    - invoice.paid: 续费成功，更新订阅有效期。
 *    - invoice.payment_failed: 扣费失败，标记为逾期。
 *    - customer.subscription.updated: 订阅变更（如升降级或取消）。
 *    - customer.subscription.deleted: 订阅彻底终止。
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // 核心安全屏障：校验 Webhook 签名
    event = getStripe().webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      // 事件：支付结账成功
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, planId, interval } = session.metadata || {};
        if (!userId || !planId) break;

        const stripeSubscriptionId = session.subscription as string;

        // 获取详细订阅信息以同步有效期
        const stripeSub = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
        const period = getSubscriptionPeriod(stripeSub);

        await prisma.subscription.upsert({
          where: { userId },
          update: {
            planId,
            interval: interval || 'monthly',
            status: 'active',
            paymentProvider: 'stripe',
            externalId: stripeSubscriptionId,
            currentPeriodStart: period.start,
            currentPeriodEnd: period.end,
            cancelledAt: null,
          },
          create: {
            userId,
            planId,
            interval: interval || 'monthly',
            status: 'active',
            paymentProvider: 'stripe',
            externalId: stripeSubscriptionId,
            currentPeriodStart: period.start,
            currentPeriodEnd: period.end,
          },
        });
        break;
      }

      // 事件：账单支付成功 (通常用于月度重置/续费)
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription;
        const subscriptionId = typeof subRef === 'string' ? subRef : subRef?.id;
        if (!subscriptionId) break;

        const stripeSub = await getStripe().subscriptions.retrieve(subscriptionId);
        const invoicePeriod = getSubscriptionPeriod(stripeSub);

        await prisma.subscription.updateMany({
          where: { externalId: subscriptionId },
          data: {
            status: 'active',
            currentPeriodStart: invoicePeriod.start,
            currentPeriodEnd: invoicePeriod.end,
          },
        });
        break;
      }

      // 事件：支付失败
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const failedSubRef = invoice.parent?.subscription_details?.subscription;
        const failedSubscriptionId = typeof failedSubRef === 'string' ? failedSubRef : failedSubRef?.id;
        if (!failedSubscriptionId) break;

        await prisma.subscription.updateMany({
          where: { externalId: failedSubscriptionId },
          data: { status: 'past_due' },
        });
        break;
      }

      // 事件：订阅详情更新 (如改为年度会员)
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const newPriceId = subscription.items.data[0]?.price?.id;
        if (!newPriceId) break;

        // 反向查询：根据 Stripe 价格 ID 确定对应的本地 Plan ID
        const plan = await prisma.plan.findFirst({
          where: {
            OR: [
              { stripePriceMonthly: newPriceId },
              { stripePriceYearly: newPriceId },
            ],
          },
        });

        const statusMap: Record<string, string> = {
          active: 'active',
          past_due: 'past_due',
          canceled: 'cancelled',
          unpaid: 'past_due',
        };
        const subPeriod = getSubscriptionPeriod(subscription);
        const updateData: Record<string, unknown> = {
          status: statusMap[subscription.status] || 'active',
          currentPeriodStart: subPeriod.start,
          currentPeriodEnd: subPeriod.end,
        };

        if (plan) {
          updateData.planId = plan.id;
          updateData.interval = plan.stripePriceYearly === newPriceId ? 'yearly' : 'monthly';
        }

        await prisma.subscription.updateMany({
          where: { externalId: subscription.id },
          data: updateData,
        });
        break;
      }

      // 事件：订阅被删除
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        await prisma.subscription.updateMany({
          where: { externalId: subscription.id },
          data: {
            status: 'cancelled',
            cancelledAt: new Date(),
          },
        });
        break;
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return Response.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
