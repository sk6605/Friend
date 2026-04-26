'use client';

// 引入 Next.js 提供的 Link 组件，用于客户端侧进行路由跳转而不需要全页刷新
import Link from 'next/link';

/**
 * 组件：PrivacyPolicyPage (隐私条款落地页)
 * 作用：展示应用的隐私政策文档。包括数据收集方式、保存期限、以及向第三方数据披露（如向 OpenAI 或 Vercel 传输数据）等法定声明。
 * 引用层级：可以通过页脚链接 (Footer) 或直接访问路由 /privacy 来渲染此页面。
 * 
 * 备注：这是一个主要为静态文本的展示页面，结构上分为：顶栏返回按钮、大标题、若干带编号的说明段落（<section>）及底栏协议跳转。
 * @returns {JSX.Element} 返回一段全屏高度的文档布局页面结构。
 */
export default function PrivacyPolicyPage() {
  return (
    // 最外层容器：设置界面的最小全高度 (min-h-screen)，以及明暗主题下的渐变背景色体系
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-purple-50/30 dark:from-[#0f0b18] dark:to-[#1a1130] text-neutral-800 dark:text-neutral-200">
      
      {/* 居中固定宽度内容区最大宽度为 3xl (48rem)，并附带四周边距 */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        
        {/* Header 区域：包含返回上一步的链接以及主标题 */}
        <div className="mb-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors mb-6"
          >
            {/* 左箭头 SVG 图标 */}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to App
          </Link>
          {/* 主大字标题：使用紫红色文字渐变 (bg-clip-text) 和透明字体来实现发光渐变字效 */}
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
            Privacy Policy
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">Last updated: April 1, 2026</p>
        </div>

        {/* Content 栏目：承载主业务逻辑和政策描述的长文本容器 */}
        <div className="space-y-8 text-sm leading-relaxed">
          
          {/* 第一节：法律与平台基本概述 */}
          <section>
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-3">1. Overview</h2>
            <p>
              Friend AI (&quot;the Platform&quot;, &quot;we&quot;, &quot;us&quot;) is an AI-powered companion chat application. 
              We are committed to protecting your privacy and personal data. This Privacy Policy explains how we 
              collect, use, store, and protect your personal information when you use our services.
            </p>
          </section>

          {/* 第二节：收集哪些具体的个人数据 */}
          <section>
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-3">2. Information We Collect</h2>
            
            <h3 className="font-medium text-neutral-700 dark:text-neutral-300 mt-4 mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Email address</strong> — for account registration and OTP login verification</li>
              <li><strong>Username / Nickname</strong> — for personalized interactions</li>
              <li><strong>Age</strong> (optional) — for age-appropriate content and safety threshold adjustment</li>
              <li><strong>City</strong> (optional) — for weather notifications and localized services</li>
              <li><strong>Language preference</strong> — for multilingual conversation support</li>
              <li><strong>AI personality preference</strong> — for customized AI conversation style</li>
            </ul>

            <h3 className="font-medium text-neutral-700 dark:text-neutral-300 mt-4 mb-2">2.2 Automatically Collected Information</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Conversation content</strong> — messages exchanged with the AI for continuity and analysis</li>
              <li><strong>IP address</strong> — for rate limiting (15 requests/minute) to prevent abuse</li>
              <li><strong>Emotion analysis data</strong> — AI-extracted mood labels and scores from conversations</li>
              <li><strong>Login timestamps</strong> — for service optimization</li>
            </ul>

            <h3 className="font-medium text-neutral-700 dark:text-neutral-300 mt-4 mb-2">2.3 AI-Generated Information</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>User profile</strong> — AI-inferred interests and preferences from conversations</li>
              <li><strong>Long-term memory</strong> — cross-conversation context for consistent companionship</li>
              <li><strong>Daily insights</strong> — mood tracking, trigger events, cognitive patterns</li>
              <li><strong>Growth reports</strong> — weekly/monthly emotional trend analysis</li>
            </ul>
          </section>

          {/* 第三节：我们如何使用您的数据 (内部流转) */}
          <section>
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Providing the core AI companion chat service</li>
              <li>Personalizing conversations based on your preferences and history</li>
              <li>Detecting and responding to crisis situations (self-harm, extreme speech)</li>
              <li>Sending weather reminders, lunch/evening care notifications</li>
              <li>Managing subscriptions and feature access</li>
              <li>Complying with applicable legal requirements</li>
            </ul>
          </section>

          {/* 第四节：危机检测干预覆盖机制声明（重点安全相关） */}
          <section>
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-3">4. Crisis Detection & Data Override</h2>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4">
              <p className="font-medium text-amber-800 dark:text-amber-300 mb-2">⚠️ Important Safety Disclosure</p>
              <p className="text-amber-700 dark:text-amber-400">
                Our system includes automated crisis detection. When high-risk content is detected (risk level ≥ 2),
                the system will <strong>automatically override your data control settings</strong> and retain relevant 
                conversation data for safety review. This is necessary to protect user safety and complies with:
              </p>
              <ul className="list-disc pl-5 mt-2 text-amber-700 dark:text-amber-400 space-y-1">
                <li>Malaysia PDPA Section 40 — vital interests exemption</li>
                <li>EU GDPR Article 6(1)(d) — legitimate processing for vital interests</li>
              </ul>
            </div>
          </section>

          {/* 第五节：被调用的第三方服务合作表格列表展示 */}
          <section>
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-3">5. Third-Party Services</h2>
            <p className="mb-2">We use the following third-party services to process your data:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left py-2 pr-4 font-medium">Service</th>
                    <th className="text-left py-2 pr-4 font-medium">Purpose</th>
                    <th className="text-left py-2 font-medium">Data Processed</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-600 dark:text-neutral-400">
                  <tr className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-2 pr-4">OpenAI</td>
                    <td className="py-2 pr-4">AI conversation generation</td>
                    <td className="py-2">Conversation content (real-time, not stored)</td>
                  </tr>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-2 pr-4">Stripe</td>
                    <td className="py-2 pr-4">Payment processing</td>
                    <td className="py-2">Payment info, email</td>
                  </tr>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-2 pr-4">Vercel</td>
                    <td className="py-2 pr-4">Application hosting</td>
                    <td className="py-2">Logs, IP addresses</td>
                  </tr>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-2 pr-4">Upstash Redis</td>
                    <td className="py-2 pr-4">Rate limiting</td>
                    <td className="py-2">IP addresses (temporary)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">OpenWeatherMap</td>
                    <td className="py-2 pr-4">Weather data</td>
                    <td className="py-2">City name only</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 第六节：用户数据保留销毁政策说明 */}
          <section>
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-3">6. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account info</strong> — retained until account deletion</li>
              <li><strong>Conversations</strong> — retained until user deletes them</li>
              <li><strong>Daily insights</strong> — retained for the account&apos;s lifetime</li>
              <li><strong>Crisis event records</strong> — permanently retained (regulatory requirement)</li>
              <li><strong>Rate limit data</strong> — auto-expires within 1 minute</li>
            </ul>
          </section>

          {/* 第七节：用户的数字合规权力 */}
          <section>
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-3">7. Your Rights</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access</strong> — view personal data we hold about you</li>
              <li><strong>Correction</strong> — update inaccurate personal information</li>
              <li><strong>Deletion</strong> — request account and data deletion (except crisis records)</li>
              <li><strong>Data portability</strong> — request export of your personal data</li>
              <li><strong>Restrict processing</strong> — disable AI learning via the Data Control setting</li>
              <li><strong>Withdraw consent</strong> — withdraw consent for data processing at any time</li>
            </ul>
          </section>

          {/* 第八节：未成年人特保条例 */}
          <section>
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-3">8. Children&apos;s Privacy</h2>
            <p>
              Users under 13 require parental/guardian consent. The system automatically applies stricter 
              content filtering and lower crisis detection thresholds for minor users based on declared age.
            </p>
          </section>

          {/* 第九节：硬件与架构上的安全机制 */}
          <section>
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-3">9. Security</h2>
            <p>
              We implement HTTPS/TLS encryption for all data in transit, SSL-encrypted database connections, 
              bcrypt password hashing, environment-variable key storage, and rate limiting to prevent abuse.
            </p>
          </section>

          {/* 第十节：条款更新政策 */}
          <section>
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy at any time. Material changes will be communicated via 
              in-app notification and email. Continued use of the Platform constitutes acceptance of 
              the updated policy.
            </p>
          </section>

          {/* 第十一节：业务联络窗口 */}
          <section>
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-3">11. Contact Us</h2>
            <p>
              For privacy-related inquiries, contact our Data Protection Officer at: <strong>liangszekai@gmail.com</strong>
            </p>
          </section>
        </div>

        {/* Footer */}
        {/* 底部保留区：含版权标与跳转去服务协议 Terms 的快捷路由 */}
        <div className="mt-12 pt-6 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center text-xs text-neutral-400">
          <span>© 2026 Friend AI. All rights reserved.</span>
          <Link href="/terms" className="text-purple-500 hover:text-purple-600 transition-colors">
            Terms of Service →
          </Link>
        </div>
      </div>
    </div>
  );
}
