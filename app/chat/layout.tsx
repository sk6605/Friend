'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/SideBar';
import SettingsModal from '@/app/components/SettingsModal';
import { getUserId, logout } from '@/app/utils/auth';
import { useUserInfo } from '@/app/lib/useUserInfo';
import { SidebarContext } from './SidebarContext';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { userInfo, refetch: refetchUser } = useUserInfo(userId);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);

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
    <SidebarContext.Provider value={{ openSidebar }}>
      <div className="flex h-screen overflow-hidden">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — always visible on md+, slide-in overlay on mobile */}
        <div className={`
          fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <Sidebar
            userId={userId}
            aiName={userInfo?.aiName}
            profilePicture={userInfo?.profilePicture}
            nickname={userInfo?.nickname}
            persona={userInfo?.persona}
            onLogout={() => {
              logout();
              window.location.href = '/';
            }}
            onOpenSettings={() => setShowSettings(true)}
            onNavigate={() => setSidebarOpen(false)}
          />
        </div>

        <main className="flex-1 flex flex-col min-w-0 bg-transparent">
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
    </SidebarContext.Provider>
  );
}
