'use client';

import { useState } from 'react';

interface ForgotPasswordFormProps {
  /** 返回上一级登录界面 */
  onBack: () => void;
  /** 密码重置完成后回调，回传已重置的邮箱以便登录页预填 */
  onDone: (email: string) => void;
  /** 可选：从登录页带过来的邮箱，作为默认值 */
  initialEmail?: string;
}

// 忘记密码流程的三个阶段
type Step = 'email' | 'otp' | 'password';

/**
 * 组件：忘记密码表单 (ForgotPasswordForm)
 * 作用：自包含地编排「输入 Gmail 取 OTP → 校验 OTP → 设置新密码」三步流程。
 * 复用后端 /api/auth/send-otp 发码、/api/auth/reset-password 校验并改密。
 * 成功后通过 onDone 回到登录页，要求用户以 Gmail + 新密码重新登入。
 */
export default function ForgotPasswordForm({ onBack, onDone, initialEmail = '' }: ForgotPasswordFormProps) {
  const [step, setStep] = useState<Step>('email');

  // 全流程共享的邮箱（统一规范化为小写，保证与后端 OTP 记录匹配）
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 复用的输入框样式类（与 LoginForm 一致，带焦点发光效果）
  const inputClass = `
    w-full px-4 py-3 rounded-xl text-sm
    bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-neutral-600
    text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500
    outline-none
    focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/30
    transition-all
  `;

  const primaryBtnClass = `
    w-full py-4 rounded-2xl text-sm font-semibold text-white
    transition-all duration-200
    hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
  `;

  // 隐私处理：对邮箱进行打码（只显示首两个字母）
  const maskedEmail = email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3');

  /** 第 1 步：请求发送 OTP 到用户邮箱 */
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const normalized = email.trim().toLowerCase();
    setEmail(normalized);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send code');
        return;
      }

      setStep('otp');
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 第 2 步：进入设置新密码。
   * 刻意不做后端预检——「只校验不消费」的接口本身就是暴力猜码的预言机。
   * 验证码只暂存在本地，真正的校验发生在第 3 步的单次提交里；若码错，
   * 提交会失败并把用户退回本步重输。
   */
  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setStep('password');
  };

  /** 重新发送验证码 */
  const handleResend = async () => {
    setError('');
    try {
      await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      setError('Failed to resend code');
    }
  };

  /** 第 3 步：单次提交 —— 后端在此校验 OTP、消费验证码并改密 */
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 与后端一致：按 trim 后长度校验（存储的是 trim 后的密码）
    if (newPassword.trim().length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: code.trim(), newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        // 验证码错误/过期/被限流 → 退回验证码步重输（密码保留在 state）
        if (res.status === 401 || res.status === 429) {
          setStep('otp');
        } else if (res.status === 404) {
          // 该邮箱无账号 → 退回邮箱步
          setStep('email');
        }
        setError(data.error || 'Failed to reset password');
        return;
      }

      // 成功：回到登录页，要求用 Gmail + 新密码重新登入
      onDone(email);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div
        className="
          bg-white/80 dark:bg-[#1e1b2e]/90 backdrop-blur-xl
          rounded-3xl
          border border-neutral-200 dark:border-purple-800/30
          shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)]
          p-10
        "
      >
        {/* 返回按钮：OTP/密码步返回上一步，邮箱步返回登录 */}
        <button
          onClick={() => {
            setError('');
            if (step === 'otp') setStep('email');
            else if (step === 'password') setStep('otp');
            else onBack();
          }}
          title="Go back"
          className="mb-4 w-8 h-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* ─── 第 1 步：输入 Gmail ─── */}
        {step === 'email' && (
          <>
            <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">Forgot password</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8">
              Enter your Gmail and we&apos;ll send you a verification code.
            </p>

            <form onSubmit={handleSendCode} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                  Gmail / Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={inputClass}
                />
              </div>

              {error && (
                <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className={primaryBtnClass} style={{ backgroundColor: '#7C3AED' }}>
                {loading ? 'Sending...' : 'Send code'}
              </button>
            </form>
          </>
        )}

        {/* ─── 第 2 步：输入 OTP ─── */}
        {step === 'otp' && (
          <>
            <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">Check your email</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8">
              We sent a 6-digit code to{' '}
              <span className="font-medium text-neutral-700 dark:text-neutral-200">{maskedEmail}</span>
            </p>

            <form onSubmit={handleContinue} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                  Verification code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                  placeholder="123456"
                  maxLength={6}
                  required
                  className={`${inputClass} text-center text-lg tracking-[8px] font-semibold`}
                />
              </div>

              {error && (
                <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl">
                  {error}
                </div>
              )}

              <button type="submit" disabled={code.length !== 6} className={primaryBtnClass} style={{ backgroundColor: '#7C3AED' }}>
                Continue
              </button>
            </form>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={handleResend}
                className="text-sm text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
              >
                Didn&apos;t receive a code? Resend
              </button>
            </div>
          </>
        )}

        {/* ─── 第 3 步：设置新密码 ─── */}
        {step === 'password' && (
          <>
            <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">Set a new password</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8">
              Choose a new password for your account.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                  New password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  minLength={8}
                  required
                  className={inputClass}
                />
              </div>

              {error && (
                <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className={primaryBtnClass} style={{ backgroundColor: '#7C3AED' }}>
                {loading ? 'Saving...' : 'Reset password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
