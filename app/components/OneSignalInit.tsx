'use client';

import Script from 'next/script';

/**
 * OneSignal 应用 ID (ONESIGNAL_APP_ID)
 * 对应 OneSignal 后台的项目唯一标识符，用于启用 Web 推送服务。
 */
const ONESIGNAL_APP_ID = '81fa54b9-f9ca-4c1c-a0a1-28fe793571c5';

/**
 * 组件：OneSignalInit (推送初始化器)
 * 作用：非阻塞地加载 OneSignal SDK 脚本，并执行跨域 Service Worker 注册冲突的清理和 SDK 实例化。
 * 位置：该组件应置于全局 Layout 中，仅在浏览器端执行。
 */
export default function OneSignalInit() {
  return (
    <>
      {/* 核心初始化脚本 */}
      <Script id="onesignal-deferred-setup" strategy="afterInteractive">{`
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
          
          // 逻辑处理：清理由于版本迭代可能残留的旧版 VAPID Service Worker
          // 目的是防止旧版 sw.js 抢占作用域导致新的推送消息无法收到
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) {
              if (reg.active && reg.active.scriptURL.includes('/sw.js')) {
                await reg.unregister();
              }
            }
          }

          // 执行 SDK 联通
          await OneSignal.init({
            appId: "${ONESIGNAL_APP_ID}",
            notifyButton: { enable: false }, // 禁用自带的侧边铃铛图标，改用 UI 中的自定义开关
            allowLocalhostAsSecureOrigin: true, // 开发模式支持
          });

          // 标记就绪状态，通知其他组件（如 NotificationSettings）可以开始调用 SDK 接口了
          window._oneSignalReady = true;
          window.dispatchEvent(new Event('onesignal-ready'));
        });
      `}</Script>

      {/* 外部 SDK 引入 */}
      <Script
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        strategy="afterInteractive"
        async
      />
    </>
  );
}
