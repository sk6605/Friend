import { prisma } from '@/app/lib/db';
import nodemailer from 'nodemailer';

// 定义危机事件抛出来的元数据对象格式
interface CrisisEventInfo {
  id: string; // 数据库中这条日志的主键
  riskLevel: number; // 危害等级 (2或3)
  triggerContent: string; // 用户说出来的作案原话
  category?: 'self_harm' | 'extreme_speech' | 'none'; // 具体是什么性质的危急
  classificationReason?: string; // 大模型在当时给出的判决定罪词
  matchedKeywords?: string[]; // 被触发的关键字集
}

/**
 * 获取邮箱 SMTP 发报机实例
 * 如果没有配置环境或者处于测试黑洞中，优雅地返回假数据
 */
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;
  if (user.includes('your-email') || pass.includes('your-app-password')) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // SSL 协议转换
    auth: { user, pass },
  });
}

/**
 * 危机广播员组件 (Notify relevant parties about a crisis event)
 * 作用：当风控中心捕捉到真正的高危用户发言，自动开启警报。
 * 1. 将在应用内部通过数据库发放强红灯消息 (Creates an in-app notification crisis_alert type)
 * 2. 发送告警邮件向值班管理员邮箱求援进行人工二次复盘 (Sends an emergency email)
 */
export async function notifyCrisisIntervention(
  userId: string,
  crisisEvent: CrisisEventInfo,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { nickname: true, email: true, ageGroup: true, violationCount: true, restricted: true },
  });

  const riskLabel = crisisEvent.riskLevel === 3 ? 'IMMINENT DANGER' : 'HIGH RISK';
  const nickname = user?.nickname || 'Unknown User';
  const ageGroup = user?.ageGroup || 'unknown';
  const category = crisisEvent.category || 'self_harm';
  const categoryLabel = category === 'extreme_speech' ? 'Extreme Speech' : 'Self-Harm / Crisis';

  // 1. In-app notification for admin
  // Use CRISIS_ADMIN_USER_ID if set, otherwise create a notification
  // that admin can see via the crisis dashboard
  const adminUserId = process.env.CRISIS_ADMIN_USER_ID;
  if (adminUserId) {
    await prisma.notification.create({
      data: {
        userId: adminUserId,
        type: 'crisis_alert',
        title: `${crisisEvent.riskLevel === 3 ? '🚨' : '⚠️'} ${categoryLabel} Alert: ${nickname}`,
        message: `${riskLabel} [${categoryLabel}] detected for user "${nickname}" (${ageGroup}). Risk level: ${crisisEvent.riskLevel}/3. Immediate review required.`,
        data: JSON.stringify({
          crisisEventId: crisisEvent.id,
          targetUserId: userId,
          riskLevel: crisisEvent.riskLevel,
        }),
      },
    });
  }

  // 2. Email notification to Admin
  const alertEmail = 'liangszekai@gmail.com';
  await sendCrisisEmail(alertEmail, {
    nickname,
    ageGroup,
    riskLevel: crisisEvent.riskLevel,
    riskLabel,
    categoryLabel,
    triggerContent: crisisEvent.triggerContent,
    classificationReason: crisisEvent.classificationReason || '',
    matchedKeywords: crisisEvent.matchedKeywords || [],
    violationCount: user?.violationCount || 0,
    isRestricted: user?.restricted || false,
    eventId: crisisEvent.id,
    userId,
  });

  console.log(
    `[CRISIS] ${riskLabel} — User: ${nickname} (${userId}), Risk: ${crisisEvent.riskLevel}/3, Event: ${crisisEvent.id}`,
  );
}

async function sendCrisisEmail(
  to: string,
  data: {
    nickname: string;
    ageGroup: string;
    riskLevel: number;
    riskLabel: string;
    categoryLabel: string;
    triggerContent: string;
    classificationReason: string;
    matchedKeywords: string[];
    violationCount: number;
    isRestricted: boolean;
    eventId: string;
    userId: string;
  },
): Promise<void> {
  const transporter = getTransporter();

  const subject =
    data.riskLevel === 3
      ? `[URGENT] ${data.categoryLabel} Alert — ${data.riskLabel}: ${data.nickname}`
      : `${data.categoryLabel} Alert — ${data.riskLabel}: ${data.nickname}`;

  const keywordsHtml = data.matchedKeywords.length > 0
    ? `<tr><td style="padding: 8px 0; color: #6B7280;">Matched Keywords</td><td style="padding: 8px 0;"><code>${escapeHtml(data.matchedKeywords.join(', '))}</code></td></tr>`
    : '';

  const restrictionHtml = data.violationCount > 0
    ? `<tr><td style="padding: 8px 0; color: #6B7280;">Violation Count</td><td style="padding: 8px 0; font-weight: bold; color: #DC2626;">${data.violationCount} ${data.isRestricted ? '(RESTRICTED)' : ''}</td></tr>`
    : '';

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: ${data.riskLevel === 3 ? '#DC2626' : '#F59E0B'}; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">${data.riskLevel === 3 ? '🚨' : '⚠️'} ${data.riskLabel} — ${data.categoryLabel}</h2>
      </div>
      <div style="border: 1px solid #E5E7EB; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6B7280;">User</td><td style="padding: 8px 0; font-weight: bold;">${escapeHtml(data.nickname)}</td></tr>
          <tr><td style="padding: 8px 0; color: #6B7280;">Age Group</td><td style="padding: 8px 0;">${data.ageGroup}</td></tr>
          <tr><td style="padding: 8px 0; color: #6B7280;">Category</td><td style="padding: 8px 0; font-weight: bold;">${data.categoryLabel}</td></tr>
          <tr><td style="padding: 8px 0; color: #6B7280;">Risk Level</td><td style="padding: 8px 0; font-weight: bold; color: ${data.riskLevel === 3 ? '#DC2626' : '#F59E0B'};">${data.riskLevel}/3</td></tr>
          ${keywordsHtml}
          ${restrictionHtml}
          <tr><td style="padding: 8px 0; color: #6B7280;">Event ID</td><td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${data.eventId}</td></tr>
          <tr><td style="padding: 8px 0; color: #6B7280;">User ID</td><td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${data.userId}</td></tr>
        </table>
        <div style="margin-top: 16px; padding: 12px; background: #FEF3C7; border-radius: 6px;">
          <p style="margin: 0 0 4px; font-size: 12px; color: #92400E; font-weight: bold;">User's Message:</p>
          <p style="margin: 0; color: #78350F; font-size: 14px;">${escapeHtml(data.triggerContent.substring(0, 500))}</p>
        </div>
        ${data.classificationReason ? `
        <div style="margin-top: 12px; padding: 12px; background: #F3F4F6; border-radius: 6px;">
          <p style="margin: 0 0 4px; font-size: 12px; color: #4B5563; font-weight: bold;">AI Assessment:</p>
          <p style="margin: 0; color: #374151; font-size: 13px;">${escapeHtml(data.classificationReason)}</p>
        </div>
        ` : ''}
        <p style="margin-top: 16px; color: #6B7280; font-size: 13px;">
          SAFE_MODE has been automatically activated for this user.
          Please review this event in the admin dashboard immediately.
        </p>
      </div>
    </div>
  `;

  if (!transporter) {
    console.log('');
    console.log('════════════════════════════════════════');
    console.log(`  CRISIS ALERT EMAIL (SMTP not configured)`);
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  User: ${data.nickname} (${data.userId})`);
    console.log(`  Risk: ${data.riskLevel}/3 — ${data.riskLabel}`);
    console.log('════════════════════════════════════════');
    console.log('');
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html: htmlBody,
    });
  } catch (err) {
    console.error('Failed to send crisis alert email:', err);
    // Log to console as fallback
    console.log(`[CRISIS EMAIL FAILED] Subject: ${subject}, To: ${to}`);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
