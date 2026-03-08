'use client';

import Script from 'next/script';

const ONESIGNAL_APP_ID = '81fa54b9-f9ca-4c1c-a0a1-28fe793571c5';

/**
 * Loads and initializes the OneSignal Web SDK.
 * Must be rendered in a client component (added to layout).
 */
export default function OneSignalInit() {
  return (
    <>
      <Script id="onesignal-deferred-setup" strategy="afterInteractive">{`
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
          // Unregister old VAPID service worker (sw.js) to prevent scope conflict
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) {
              if (reg.active && reg.active.scriptURL.includes('/sw.js')) {
                await reg.unregister();
              }
            }
          }
          await OneSignal.init({
            appId: "${ONESIGNAL_APP_ID}",
            notifyButton: { enable: false },
            allowLocalhostAsSecureOrigin: true,
          });
          window._oneSignalReady = true;
          window.dispatchEvent(new Event('onesignal-ready'));
        });
      `}</Script>
      <Script
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        strategy="afterInteractive"
        async
      />
    </>
  );
}
