'use client';

import { useState } from 'react';
import OnboardingChat from './Onboardingchat';
import LoginForm from './LoginForm';
import OtpVerify from './OtpVerify';
import { hasRegistered, markRegistered } from '@/app/utils/auth';

type AuthView = 'register' | 'login' | 'otp';

interface AuthScreenProps {
  onAuth: (userId: string) => void;
}

export default function AuthScreen({ onAuth }: AuthScreenProps) {
  // First-time user → register, returning user → login
  const [view, setView] = useState<AuthView>(hasRegistered() ? 'login' : 'register');
  const [otpEmail, setOtpEmail] = useState('');
  const [devOtp, setDevOtp] = useState<string | undefined>();

  if (view === 'register') {
    return (
      <OnboardingChat
        onFinish={() => {
          markRegistered();
          setView('login');
        }}
        onBack={hasRegistered() ? () => setView('login') : undefined}
      />
    );
  }

  if (view === 'login') {
    return (
      <LoginForm
        onOtpSent={(email, otp) => {
          setOtpEmail(email);
          setDevOtp(otp);
          setView('otp');
        }}
        onRegister={() => setView('register')}
      />
    );
  }

  if (view === 'otp') {
    return (
      <OtpVerify
        email={otpEmail}
        devOtp={devOtp}
        onVerified={onAuth}
        onBack={() => setView('login')}
      />
    );
  }

  return null;
}
