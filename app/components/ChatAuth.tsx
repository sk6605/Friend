'use client';

import { useState, useEffect } from 'react';
import ChatPage from '@/app/components/ChatPage';
import OnboardingChat from '@/app/components/Onboardingchat';
import { getUserId, setUserId } from '@/app/utils/auth';

export default function ChatEntry() {

  const [userId, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUid(getUserId());
    setReady(true);
  }, []);

  if (!ready) return null;

  // ⭐ 重点：还没注册 → 走 AI 注册
  if (!userId) {
    return (
      <OnboardingChat
        onFinish={(id?: string) => {
          if (id) {
            setUserId(id);
            setUid(id);
          }
        }}
      />
    );
  }

  // ⭐ 已注册 → 进入你原本 Chat
  return <ChatPage userId={userId} />;
}
