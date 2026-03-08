const ONESIGNAL_APP_ID = '81fa54b9-f9ca-4c1c-a0a1-28fe793571c5';

/**
 * Send a push notification via OneSignal REST API.
 * Targets users by their external_id (which is set to userId on subscribe).
 */
export async function sendPushNotification(
  userIds: string[],
  title: string,
  body: string,
  url = '/chat'
): Promise<void> {
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!restApiKey) {
    console.warn('ONESIGNAL_REST_API_KEY not set, skipping push');
    return;
  }
  if (userIds.length === 0) return;

  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${restApiKey}`,
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      target_channel: 'push',
      include_aliases: { external_id: userIds },
      headings: { en: title },
      contents: { en: body },
      url,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('OneSignal push failed:', res.status, err);
  }
}
