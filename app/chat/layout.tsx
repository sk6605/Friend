'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/SideBar';
import SettingsModal from '@/app/components/SettingsModal';
import { getUserId, logout } from '@/app/utils/auth';
import { useUserInfo } from '@/app/lib/useUserInfo';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { userInfo, refetch: refetchUser } = useUserInfo(userId);

  useEffect(() => {
    const uid = getUserId();
    if (!uid) {
      router.replace('/');
      return;
    }
    setUserId(uid);
    setReady(true);
  }, [router]);

  if (!ready || !userId) return null;

  return (
    <div className="flex h-screen">
      <Sidebar
        userId={userId}
        aiName={userInfo?.aiName}
        profilePicture={userInfo?.profilePicture}
        nickname={userInfo?.nickname}
        onLogout={() => {
          logout();
          window.location.href = '/';
        }}
        onOpenSettings={() => setShowSettings(true)}
      />
      <main className="flex-1 flex items-center justify-center px-4">
        {children}
      </main>

      {showSettings && (
        <SettingsModal
          userId={userId}
          profilePicture={userInfo?.profilePicture ?? null}
          onClose={() => setShowSettings(false)}
          onProfileUpdate={refetchUser}
        />
      )}
    </div>
  );
}
