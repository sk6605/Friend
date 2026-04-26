import nodemailer from 'nodemailer';

/**
 * 助手函数：在控制台降级打印验证码 (OTP)
 * 作用：方便本地开发且没配置远端邮件服务密码时的调试。直接在服务器 Terminal 显示一次性验证码，供站长手动输入登录。
 */
function logOtpToConsole(email: string, code: string) {
  console.log('');
  console.log('========================================');
  console.log(`  OTP for ${email}: ${code}`);
  console.log('========================================');
  console.log('');
}

/**
 * 助手函数：构造 Nodemailer SMTP 发信机对象
 * 作用：从项目的生产运行环境变量里读取邮箱服务供应商密码用于投递系统登录信。
 */
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587); // 若无则使用安全邮常用端口 587
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // 如果根本没在环境变量配账密或者没有去改模版里携带的 your-email 等占位符文本则返回空取消发件操作
  if (!host || !user || !pass) return null;
  if (user.includes('your-email') || pass.includes('your-app-password')) return null;

  // 使用第三方 Nodemailer 库初始化标准发信实例
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 标准约定：465端口对应强制 SSL 安全包裹，反之为 false
    auth: { user, pass },
  });
}

/**
 * 辅助公开函数：检查发信通道是否畅通配置就位
 * 作用：让外部知道能不能发真邮件，若不能则可能需要前端提示或者转用控制台模拟打印
 */
export function isSmtpConfigured() {
  return getTransporter() !== null;
}

/**
 * 核心对外工具：发送带有 OTP 通行密钥的验证通知邮件
 * 作用：提供给无密码一键登录 (Magic Link / OTP Auth) 的 Auth Route 使用。
 * 
 * @param {string} email 收信人的邮箱地址
 * @param {string} code 随机出的一组通常为 6 位的临时认证串码
 */
export async function sendOtpEmail(email: string, code: string) {
  const transporter = getTransporter();

  // 保底：万一服务器发信模块损坏或是忘配了密码，转为执行本地打印避免阻塞使用流程
  if (!transporter) {
    logOtpToConsole(email, code);
    return;
  }

  try {
    // 异步排队发出信件，附带渲染好的 HTML 排版容器
    await transporter.sendMail({
      // 如果配了 SMTP_FROM 则用代发件名呈现给客户（更友好规整），否则直接暴露注册商发件口名称
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email, // 目测要投递给的具体客户
      subject: 'Lumi - Your Login Code', // 信件主抬头标题
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 32px; text-align: center;">
          <h2 style="color: #2F3441;">Lumi</h2>
          <p style="color: #666; font-size: 14px;">Your verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #7C3AED; margin: 24px 0;">${code}</div>
          <p style="color: #999; font-size: 12px;">This code expires in 5 minutes.</p>
        </div>
      `, // HTML 富文本，包含了紫色大号字体的紫标设计以呼应该应有的 UI
    });
  } catch (err) {
    // 捕获不可控的远端 SMTP 报错（比如：密码被人改了，或者端口被防火墙挡住）并依然执行保底打印
    console.error('SMTP send failed, falling back to console:', err);
    logOtpToConsole(email, code);
  }
}
