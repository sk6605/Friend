import nodemailer from 'nodemailer';

function logOtpToConsole(email: string, code: string) {
  console.log('');
  console.log('========================================');
  console.log(`  OTP for ${email}: ${code}`);
  console.log('========================================');
  console.log('');
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Not configured or still using placeholder values
  if (!host || !user || !pass) return null;
  if (user.includes('your-email') || pass.includes('your-app-password')) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function isSmtpConfigured() {
  return getTransporter() !== null;
}

export async function sendOtpEmail(email: string, code: string) {
  const transporter = getTransporter();

  if (!transporter) {
    logOtpToConsole(email, code);
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Friend AI - Your Login Code',
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 32px; text-align: center;">
          <h2 style="color: #2F3441;">Friend AI</h2>
          <p style="color: #666; font-size: 14px;">Your verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #7C3AED; margin: 24px 0;">${code}</div>
          <p style="color: #999; font-size: 12px;">This code expires in 5 minutes.</p>
        </div>
      `,
    });
  } catch (err) {
    // SMTP failed — fall back to console so login still works
    console.error('SMTP send failed, falling back to console:', err);
    logOtpToConsole(email, code);
  }
}
