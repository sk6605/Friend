'use client';

import Script from 'next/script';

const ONESIGNAL_APP_ID = 'f86513d7-fd4c-4309-a6e2-62735f7a8f78';

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
