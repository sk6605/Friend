/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts. Registers all self-hosted cron jobs
 * so the app doesn't depend on Vercel's cron feature.
 *
 * Schedule (server local time):
 *   daily-summary      → every day at 12:00 PM
 *   growth-check       → every Sunday at 00:00
 *   proactive-care     → every 6 hours
 *   rain-alert         → every day at 08:00 AM
 */
export async function register() {
  // Only run in Node.js runtime (not Edge), and not during Next.js build
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const cron = await import('node-cron');
  const { runDailySummary } = await import('@/app/lib/cron/runDailySummary');
  const { runGrowthCheck } = await import('@/app/lib/cron/runGrowthCheck');
  const { runProactiveCare } = await import('@/app/lib/cron/runProactiveCare');
  const { runRainAlert } = await import('@/app/lib/cron/runRainAlert');


  // Daily insights — every day at 12:00 PM
  cron.schedule('0 12 * * *', async () => {
    console.log('[Cron] Running daily-summary...');
    try {
      const r = await runDailySummary();
      console.log(`[Cron] daily-summary done — ${r.processedUsers}/${r.totalUsers} users`);
    } catch (err) {
      console.error('[Cron] daily-summary failed:', err);
    }
  });

  // Weekly growth check — every Sunday at midnight
  cron.schedule('0 0 * * 0', async () => {
    console.log('[Cron] Running growth-check...');
    try {
      const r = await runGrowthCheck();
      console.log(`[Cron] growth-check done — ${r.processedUsers}/${r.totalUsers} users`);
    } catch (err) {
      console.error('[Cron] growth-check failed:', err);
    }
  });

  // Proactive care — every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('[Cron] Running proactive-care...');
    try {
      const r = await runProactiveCare();
      console.log(`[Cron] proactive-care done — sent ${r.sentCount}/${r.totalChecked} users`);
    } catch (err) {
      console.error('[Cron] proactive-care failed:', err);
    }
  });

  // Rain alert — every 15 minutes (per-user timing: 30 min before departure, default 07:30)
  cron.schedule('*/15 * * * *', async () => {
    try {
      const r = await runRainAlert();
      if (r.alertsSent > 0) {
        console.log(`[Cron] rain-alert — ${r.alertsSent} alerts / ${r.usersChecked} users`);
      }
    } catch (err) {
      console.error('[Cron] rain-alert failed:', err);
    }
  });

  console.log('[Cron] All jobs registered: daily-summary(12:00), growth-check(Sun 00:00), proactive-care(*/6h), rain-alert(08:00)');
}
