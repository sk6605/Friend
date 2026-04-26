import Stripe from 'stripe';

// 全局静态变量，用于在程序生命周期内持有一个独一无二的 Stripe 类实例对象
let _stripe: Stripe | undefined;

/**
 * 封装工具函数：获取安全配置并重用的 Stripe (支付网关) 实例对象
 * 
 * 作用：避免每次涉及到验单、扣费、创建结账通道时重复去实例化庞大的 Stripe 对象。
 * 使用单例模式：如果有就直接拿内存的，如果没有才做严防跌毁保障的首次实例化构造。
 */
export function getStripe(): Stripe {
  // 如果静态句柄不在或者还没生成
  if (!_stripe) {
    // 强制查验系统库里是否提供 Stripe 的系统级机密证书，杜绝无码上线的灾难报错
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set'); // 如果没部署这个环境变量则系统会在用到这里的时候停机报错
    }
    // New 出这个支付引擎挂载进内存长期服役
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}
