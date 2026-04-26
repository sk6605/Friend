'use client';

import { useState, useRef, useEffect } from 'react';
import { setUserId } from '@/app/utils/auth';

/**
 * 组件参数定义 (OtpVerifyProps)
 * email: 已申请发送 OTP 的目标邮箱
 * devOtp: 开发环境下的回显验证码（绕过 SMTP 限制）
 * onVerified: 验证成功后的跳转回调
 * onBack: 返回上级登录界面的回调
 */
interface OtpVerifyProps {
  email: string;
  devOtp?: string;
  onVerified: (userId: string) => void;
  onBack: () => void;
}

/**
 * 组件：OtpVerify (OTP 验证录入界面)
 * 作用：接收并校验用户输入的 6 位动态验证码。
 * 设计特色：
 * 1. 自动聚焦 (Auto-focus) 及 连续输入 (Auto-advance)。
 * 2. 支持全量粘贴 6 位代码并自动提交。
 * 3. 包含验证码重发冷却计时器 (Resend Cooldown)。
 */
export default function OtpVerify({ email, devOtp, onVerified, onBack }: OtpVerifyProps) {
  // 6 位数字分别对应 6 个独立的输入框
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [resendSuccess, setResendSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // 冷却时间状态（单位：秒）
  const [resendCooldown, setResendCooldown] = useState(0);

  // 用于手动操作输入框焦点的引用数组
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // UX：组件加载后立刻聚焦第一个框
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // 逻辑：冷却计时器自减
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  /**
   * 输入变化监听
   * 负责：过滤非数字、填充状态、自动跳转至下一个框、满格后自动提交。
   */
  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');

    // 跳转逻辑
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // 触发自动提交
    if (digit && index === 5 && next.every((d) => d)) {
      verifyCode(next.join(''));
    }
  };

  /**
   * 键盘按键监听
   * 处理退格键 (Backspace) 逻辑：若当前框为空，则回退到上一个输入框。
   */
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  /**
   * 粘贴板处理
   * 允许用户直接在任一框粘贴 6 位数字，系统自动拆分填充并提交。
   */
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const next = pasted.split('');
      setDigits(next);
      inputRefs.current[5]?.focus();
      verifyCode(pasted);
    }
  };

  /**
   * 核心业务逻辑：接口校验
   */
  const verifyCode = async (code: string) => {
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        // 校验失败重置 UI
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      // 验证通过：写入 Client Side Cookie 并执行完成回调
      setUserId(data.userId);
      onVerified(data.userId);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 重发逻辑
   */
  const handleResend = async () => {
    if (resendCooldown > 0) return;

    try {
      await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setResendCooldown(60); // 设置 60s 冷却
      setError('');
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 3000);
    } catch {
      setError('Failed to resend code');
    }
  };

  // 隐私处理：对邮箱进行打码（只显示首两个字母）
  const maskedEmail = email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3');

  return (
    <div className="w-full max-w-md">
      <div
        className="
          bg-white/80 dark:bg-[#1e1b2e]/90 backdrop-blur-xl
          rounded-3xl
          border border-neutral-200 dark:border-purple-800/30
          shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)]
          p-10
          text-center
        "
      >
        <button
          onClick={onBack}
          className="text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors mb-6 flex items-center gap-1"
        >
          &larr; Back
        </button>

        <div className="text-3xl mb-4">
          <svg className="w-12 h-12 mx-auto text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">Check your email</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          We sent a 6-digit code to <span className="font-medium text-neutral-700 dark:text-neutral-200">{maskedEmail}</span>
        </p>

        {/* 开发者提示：若处于本地调试且 SMTP 没配置，直接显示验证码供测试 */}
        {devOtp && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">Dev Mode — SMTP not configured</p>
            <p className="text-2xl font-bold tracking-[6px] text-amber-700 dark:text-amber-300">{devOtp}</p>
          </div>
        )}

        {/* 6 个独立的数字输入窗组合 */}
        <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              placeholder="*"
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, i === 0 ? undefined : (e as any))} // 修正原有拼写及逻辑提示
              disabled={loading}
              className="
                w-12 h-14 text-center text-xl font-bold
                rounded-xl
                bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-neutral-600
                text-neutral-800 dark:text-neutral-100
                outline-none
                focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/30
                transition-all
                disabled:opacity-50
              "
            />
          ))}
        </div>

        {error && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl mb-4">
            {error}
          </div>
        )}

        {resendSuccess && !error && (
          <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-xl mb-4">
            Code resent! Check your inbox.
          </div>
        )}

        {loading && (
          <div className="text-sm text-neutral-400 mb-4 animate-pulse">Verifying...</div>
        )}

        <button
          onClick={handleResend}
          disabled={resendCooldown > 0}
          className="text-sm text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors disabled:text-neutral-400"
        >
          {resendCooldown > 0
            ? `Resend code in ${resendCooldown}s`
            : "Didn't receive a code? Resend"}
        </button>
      </div>
    </div>
  );
}
