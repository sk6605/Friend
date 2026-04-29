'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * 类型声明：新手引导流程的各个原子步骤
 * welcome: 欢迎屏
 * ask_name: 询问姓名
 * ask_age: 询问年龄（用于内容安全过滤）
 * ask_email: 询问邮箱（主账号标识，需查重）
 * ask_interests: 兴趣采集（用于人设个性化初调）
 * ask_ai_name: 确认是否自定义 AI 尊称
 * get_ai_name: 输入自定义 AI 名字
 * creating: 后端账户创建中
 * done: 完成引导
 */
type Step =
  | 'welcome'
  | 'ask_name'
  | 'ask_age'
  | 'ask_email'
  | 'ask_interests'
  | 'ask_ai_name'
  | 'get_ai_name'
  | 'creating'
  | 'done';

const STEPS: Step[] = [
  'welcome',
  'ask_name',
  'ask_age',
  'ask_email',
  'ask_interests',
  'ask_ai_name',
];

/**
 * 界面元数据：每个步骤对应的图标、主标题与副标题翻译
 */
const STEP_META: Record<string, { icon: string; title: string; subtitle: string }> = {
  welcome: { icon: '👋', title: 'Welcome!', subtitle: "Let's get you started" },
  ask_name: { icon: '✨', title: "What's your name?", subtitle: "We'd love to know what to call you" },
  ask_age: { icon: '🎂', title: 'How old are you?', subtitle: 'This helps personalise the experience' },
  ask_email: { icon: '📧', title: "What's your email?", subtitle: "You'll use this to sign in" },
  ask_interests: { icon: '🎯', title: 'Your interests', subtitle: 'What are you passionate about?' },
  ask_ai_name: { icon: '🤖', title: 'Name your AI', subtitle: 'Would you like to give me a custom name?' },
  get_ai_name: { icon: '💜', title: 'Choose a name', subtitle: "What would you like to call me?" },
};

/**
 * 组件：OnboardingChat (新手引导对话流)
 * 作用：这是一个沉浸式的分步骤表单，引导新用户完成信息注册及 AI 人设的初步定制。
 * 特色：
 * 1. 采用类似聊天交互的单步推进模式。
 * 2. 包含邮箱查重、年龄分层等逻辑预处理。
 * 3. 最终通过 `createUser` 接口落地到数据库，并标记新手引导结束。
 */
export default function OnboardingChat({
  onFinish,
  onBack,
}: {
  onFinish: (userId?: string) => void;
  onBack?: () => void;
}) {
  const [step, setStep] = useState<Step>('welcome');
  const [data, setData] = useState<Record<string, unknown>>({ language: 'en' });
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false); // 用户必须手动勾选同意条款才能完成注册

  // 计算顶部进度条的百分比
  const progress = (() => {
    const idx = STEPS.indexOf(step as Step);
    if (step === 'get_ai_name') return 100;
    if (step === 'creating' || step === 'done') return 100;
    if (idx < 0) return 100;
    return Math.round(((idx) / STEPS.length) * 100);
  })();

  const meta = STEP_META[step] || STEP_META.welcome;

  // 基础校验：邮箱格式
  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  // 基础校验：后端内容安全分层标签
  const ageGroup = (age: number) => {
    if (age < 13) return 'child';
    if (age < 18) return 'teen';
    return 'adult';
  };

  /**
   * 核心行为：落库
   * 调用 /api/onboarding/create 接口将收集到的所有 JSON 数据发送至后端。
   */
  const createUser = async (d: Record<string, unknown>): Promise<string> => {
    const res = await fetch('/api/onboarding/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create account');
    }
    const responseData = await res.json();
    return responseData.id;
  };

  /**
   * 引导结束处理
   * 负责展示“创建中”及“完成”动画，并跳转至登录或主界面。
   */
  const finishAccount = async (d: Record<string, unknown>) => {
    setStep('creating');
    try {
      const userId = await createUser(d);
      setStep('done');
      // 延迟延迟一会儿，让用户看完“Done”动画后再执行外部跳转
      setTimeout(() => onFinish(userId), 1800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      // 容错：如果用户已经由于某种原因注册过了，直接通过
      if (msg.includes('already registered')) {
        setStep('done');
        setTimeout(() => onFinish(), 1500);
      } else {
        setError(msg);
        setStep('ask_interests');
      }
    }
  };

  /**
   * 表单提交分发中心 (handleSubmit)
   * 这是一个典型的前端状态机逻辑：
   * - validate: 检查当前输入是否合规。
   * - update-state: 将合规数据存入 data 对象缓存。
   * - transition: 切换到下一个 step。
   */
  const handleSubmit = async () => {
    const val = inputValue.trim();
    setError('');
    const d = { ...data };

    switch (step) {
      case 'ask_name':
        if (!val) { setError('Please enter your name'); return; }
        d.username = val;
        d.nickname = val; // 默认昵称设为一致
        setData(d);
        setInputValue('');
        setStep('ask_age');
        break;

      case 'ask_age': {
        const age = Number(val);
        if (isNaN(age) || age < 1 || age > 150) {
          setError('Please enter a valid age');
          return;
        }
        d.age = age;
        d.ageGroup = ageGroup(age);
        setData(d);
        setInputValue('');
        setStep('ask_email');
        break;
      }

      case 'ask_email':
        if (!isEmail(val)) { setError('Please enter a valid email'); return; }
        setLoading(true);
        try {
          // 预检：异步查重
          const checkRes = await fetch('/api/onboarding/check-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: val }),
          });
          const checkResult = await checkRes.json();
          if (checkResult.exists) {
            setError('This email is already registered. Please use a different email.');
            setLoading(false);
            return;
          }
          d.email = val;
          setData(d);
          setInputValue('');
          setStep('ask_interests');
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Could not verify email';
          setError(msg);
        } finally {
          setLoading(false);
        }
        break;

      case 'ask_interests':
        if (!val) { setError('Tell us something you enjoy!'); return; }
        d.interests = val;
        setData(d);
        setInputValue('');
        setStep('ask_ai_name');
        break;

      case 'get_ai_name':
        if (!val) { setError('Please enter a name'); return; }
        d.aiName = val;
        setData(d);
        setInputValue('');
        finishAccount(d);
        break;
    }
  };

  /**
   * 跳过逻辑 (针对年龄)
   */
  const handleSkipAge = () => {
    const d = { ...data, age: null, ageGroup: 'adult' };
    setData(d);
    setError('');
    setInputValue('');
    setStep('ask_email');
  };

  const handleAiNameYes = () => {
    setError('');
    setInputValue('');
    setStep('get_ai_name');
  };

  const handleAiNameNo = () => {
    const d = { ...data, aiName: 'Lumi' };
    setData(d);
    finishAccount(d);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  // 渲染分流：正在创建的状态
  if (step === 'creating') {
    return (
      <div className="w-full max-w-md flex flex-col items-center justify-center gap-6 py-20">
        <div className="relative">
          {/* 旋转的渐变 Loading 环 */}
          <div className="w-16 h-16 rounded-full border-[3px] border-purple-200 dark:border-purple-800 border-t-purple-600 dark:border-t-purple-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl">✨</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">Creating your account...</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Setting everything up for you</p>
        </div>
      </div>
    );
  }

  // 渲染分流：引导完成的状态
  if (step === 'done') {
    return (
      <div className="w-full max-w-md flex flex-col items-center justify-center gap-6 py-20">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">You&apos;re all set!</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Redirecting you to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="
      w-full max-w-md
      bg-white/70 dark:bg-[#1a1726]/80 backdrop-blur-xl
      rounded-3xl
      border border-purple-100/50 dark:border-purple-800/30
      shadow-[0_8px_40px_rgba(124,58,237,0.1)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)]
      overflow-hidden
    ">
      {/* 顶部渐变进度条 */}
      <div className="h-1 bg-purple-100/60 dark:bg-purple-900/30">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-violet-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="px-8 pt-8 pb-6">
        {/* 返回登录按钮 (仅在欢迎页展示) */}
        {onBack && step === 'welcome' && (
          <button
            onClick={onBack}
            className="mb-4 text-sm text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to login
          </button>
        )}

        {/* 步骤核心图标 */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900/40 dark:to-violet-900/40 flex items-center justify-center shadow-sm">
            <span className="text-3xl">{meta.icon}</span>
          </div>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100">{meta.title}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{meta.subtitle}</p>
        </div>

        {/* 分步骤渲染：欢迎屏 */}
        {step === 'welcome' && (
          <div className="space-y-3">
            <p className="text-center text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
              I&apos;m your personal AI companion. Let&apos;s set up your account in just a few quick steps.
            </p>
            <button
              onClick={() => setStep('ask_name')}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold text-sm shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              Get Started
            </button>
          </div>
        )}

        {/* 分步骤渲染：通用的文本输入框流程 */}
        {['ask_name', 'ask_age', 'ask_email', 'ask_interests', 'get_ai_name'].includes(step) && (
          <div className="space-y-3">
            <div>
              <input
                type={step === 'ask_email' ? 'email' : 'text'}
                value={inputValue}
                onChange={e => { setInputValue(e.target.value); setError(''); }}
                onKeyDown={handleKeyDown}
                placeholder={
                  step === 'ask_name' ? 'Enter your name...' :
                    step === 'ask_age' ? 'e.g. 25' :
                      step === 'ask_email' ? 'you@example.com' :
                        step === 'ask_interests' ? 'e.g. music, tech, cooking...' :
                          step === 'get_ai_name' ? 'e.g. Luna, Buddy, Nova...' : ''
                }
                autoFocus
                className="w-full px-4 py-3.5 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200/80 dark:border-purple-800/30 text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400 transition-all"
              />
              {error && (
                <p className="mt-2 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </p>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold text-sm shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? 'Checking...' : 'Continue'}
            </button>

            {step === 'ask_age' && (
              <button
                onClick={handleSkipAge}
                className="w-full py-2 text-sm text-neutral-400 dark:text-neutral-500 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
                title="Skip this step"
              >
                Skip this step
              </button>
            )}

            {step === 'get_ai_name' && (
              <button
                onClick={() => { setStep('ask_ai_name'); setInputValue(''); setError(''); }}
                className="w-full py-2 text-sm text-neutral-400 dark:text-neutral-500 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
                title="Go back"
              >
                Go back
              </button>
            )}
          </div>
        )}

        {/* 分步骤渲染：AI 改名决策 + 合约勾选 */}
        {step === 'ask_ai_name' && (
          <div className="space-y-3">
            {/* 隐私政策及服务条款入口 (强制勾选：不勾选无法完成注册) */}
            <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all duration-200 ${agreedToTerms
                ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-600/40'
                : 'bg-neutral-50 dark:bg-white/5 border-neutral-200/60 dark:border-purple-800/20'
              }`}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-neutral-300 dark:border-purple-700 text-purple-600 focus:ring-purple-500 accent-purple-600"
              />
              <span className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                I agree to the{' '}
                <Link href="/privacy" target="_blank" className="text-purple-500 hover:text-purple-600 underline underline-offset-2">Privacy Policy</Link>
                {' '}and{' '}
                <Link href="/terms" target="_blank" className="text-purple-500 hover:text-purple-600 underline underline-offset-2">Terms of Service</Link>
                , including potential administrator intervention during crisis events.
              </span>
            </label>

            <button
              onClick={handleAiNameYes}
              disabled={!agreedToTerms}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${agreedToTerms
                  ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Yes, let me name you!
            </button>
            <button
              onClick={handleAiNameNo}
              disabled={!agreedToTerms}
              className={`w-full py-3.5 rounded-xl font-medium text-sm transition-all duration-200 ${agreedToTerms
                  ? 'bg-neutral-100 dark:bg-white/5 border border-neutral-200/80 dark:border-purple-800/30 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-150 dark:hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200/40 dark:border-neutral-700/30 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
                }`}
            >
              No, keep &quot;Lumi&quot;
            </button>
          </div>
        )}
      </div>

      {/* 底部装饰：步进圆点标识器 */}
      <div className="flex items-center justify-center gap-1.5 pb-6">
        {STEPS.map((s, i) => {
          const currentIdx = step === 'get_ai_name' ? STEPS.length : STEPS.indexOf(step as Step);
          return (
            <div
              key={s}
              className={`rounded-full transition-all duration-300 ${i === currentIdx
                ? 'w-6 h-2 bg-purple-500' // 当前步为长条状高亮
                : i < currentIdx
                  ? 'w-2 h-2 bg-purple-300 dark:bg-purple-600' // 已走过的步
                  : 'w-2 h-2 bg-neutral-200 dark:bg-neutral-700' // 未走到的步
                }`}
            />
          );
        })}
      </div>
    </div>
  );
}
