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

export default function AuthScreen({ onAuth, initialView = 'login', onBack }: AuthScreenProps) {
  // Use initialView prop to set starting view
  const [view, setView] = useState<AuthView>(initialView);
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
          onBack={hasRegistered() ? () => setView('login') : onBack}
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
