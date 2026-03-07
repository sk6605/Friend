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
}

export default function AuthScreen({ onAuth }: AuthScreenProps) {
  // Always show login first; new users click "Sign up" to register
  const [view, setView] = useState<AuthView>('login');
  const [otpEmail, setOtpEmail] = useState('');
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const [showDemo, setShowDemo] = useState(false);

  if (view === 'register') {
    return (
      <>
        <OnboardingChat
          onFinish={() => {
            markRegistered();
            setView('login');
          }}
          onBack={hasRegistered() ? () => setView('login') : undefined}
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

  if (view === 'login') {
    return (
      <>
        <LoginForm
          onOtpSent={(email, otp) => {
            setOtpEmail(email);
            setDevOtp(otp);
            setView('otp');
          }}
          onRegister={() => setView('register')}
          onTry={() => setShowDemo(true)}
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
