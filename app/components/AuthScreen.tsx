'use client';

import { useState } from 'react';
import OnboardingChat from './Onboardingchat';
import LoginForm from './LoginForm';
import OtpVerify from './OtpVerify';
import DemoChat from './DemoChat';
import { hasRegistered, markRegistered } from '@/app/utils/auth';

type AuthView = 'register' | 'login' | 'otp';

interface AuthScreenProps {
  onAuth: (userId: string) => void;
  initialView?: 'login' | 'register';
  onBack?: () => void;
}

/**
 * 组件：全屏登录认证壳 (AuthScreen)
 * 作用：这是一个作为“门卫”的包裹型组件，管理用户的登录状态与页面轮转（注册、登录、动态口令OTP、体验漫游版）。
 * 架构：通过 React 本地状态 (`view`) 结合外部注入的回调 (`onAuth`) 控制单页应用(SPA)体验，无需路由跳转即可完成复杂的鉴权流程编排。
 */
export default function AuthScreen({ onAuth, initialView = 'login', onBack }: AuthScreenProps) {
  // 控制当前展示的是登录、注册还是 OTP 验证面板
  const [view, setView] = useState<AuthView>(initialView);
  // OTP 传递层：保存刚刚登录步骤中填写的邮箱和后端返回的临时口令(用于开发测试)
  const [otpEmail, setOtpEmail] = useState('');
  const [devOtp, setDevOtp] = useState<string | undefined>();
  // 试用版大门开关（免登录体验 Chat 组件）
  const [showDemo, setShowDemo] = useState(false);

  // ─── 视图分支 1：向新用户展示包含拟态聊天的注册流 (Onboarding) ───
  if (view === 'register') {
    return (
      <>
        <OnboardingChat
          onFinish={() => {
            markRegistered(); // 调用 Utils 在 LocalStorage 刻下印记，防重复注册
            setView('login'); // 注册完毕自动跳入登录
          }}
          onBack={hasRegistered() ? () => setView('login') : onBack}
        />
        {/* 如果在注册界面的某个角落被诱导点击试用体验代码，弹出漂浮聊天框 */}
        {showDemo && (
          <DemoChat
            onClose={() => setShowDemo(false)}
            onSignUp={() => {
              setShowDemo(false);
              setView('register');
            }}
          />
        )}
      </>
    );
  }

  // ─── 视图分支 2：向老用户展示标准登录器 (Login) ───
  if (view === 'login') {
    return (
      <>
        <LoginForm
          onOtpSent={(email, otp) => {
            // 接管 LoginForm 丢出来的 OTP 发送成功事件，保存现场并转入最后一步
            setOtpEmail(email);
            setDevOtp(otp);
            setView('otp');
          }}
          onRegister={() => setView('register')}
          onTry={() => setShowDemo(true)}
          onBack={onBack}
        />
        {showDemo && (
          <DemoChat
            onClose={() => setShowDemo(false)}
            onSignUp={() => {
              setShowDemo(false);
              setView('register');
            }}
          />
        )}
      </>
    );
  }

  // ─── 视图分支 3：验证码输入框 (OTP code verification) ───
  if (view === 'otp') {
    return (
      <OtpVerify
        email={otpEmail}
        devOtp={devOtp}
        onVerified={onAuth} // 如果验证成功，直接拉起应用最顶级的登入回调，打开系统大门
        onBack={() => setView('login')}
      />
    );
  }

  // 防御性渲染（其实永远不会走到这）
  return null;
}
