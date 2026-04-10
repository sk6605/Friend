"use client";

import { useState, useEffect } from "react";
import ChatPage from "./components/ChatPage";
import Sidebar from "./components/SideBar";
import AuthScreen from "./components/AuthScreen";
import SettingsModal from "./components/SettingsModal";
import LandingPage from "./components/LandingPage";
import { getUserId, setUserId, logout } from "./utils/auth";
import { useUserInfo } from "./lib/useUserInfo";
import { useNotifications } from "./hooks/useNotifications";
import { usePushNotifications } from "./hooks/usePushNotifications";
import NotificationToast from "./components/NotificationToast";

/**
 * Page: Landing / Home
 *
 * Logic:
 * 1. Checks authentication state via `getUserId`.
 * 2. If not logged in -> Shows LandingPage. User can click "Get Started" to register or "Login".
 * 3. If logged in -> Renders `ChatPage` with `Sidebar` and `SettingsModal`.
 * 4. Manages global state: `userId`, `sidebarOpen`, `showSettings`.
 * 5. Handles global Notifications via `NotificationToast`.
 */
export default function Home() {
  const [userId, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const { userInfo, refetch: refetchUser } = useUserInfo(userId);
  const { notifications, dismissNotification, markRead } = useNotifications(userId);
  usePushNotifications(userId || '');

  useEffect(() => {
    setUid(getUserId());
    setReady(true);
  }, []);

  if (!ready) return null;

  // Not logged in — show landing or auth
  if (!userId) {
    // User clicked Get Started or Login → show auth screen
    if (showAuth) {
      return (
        <div className="flex h-screen">
          <main className="flex-1 flex items-center justify-center px-4">
            <AuthScreen
              onAuth={(id) => {
                setUserId(id);
                setUid(id);
                setShowAuth(false);
              }}
              initialView={authMode}
              onBack={() => setShowAuth(false)}
            />
          </main>
        </div>
      );
    }

    // Default: show landing page
    return (
      <LandingPage
        onGetStarted={() => {
          setAuthMode('register');
          setShowAuth(true);
        }}
        onLogin={() => {
          setAuthMode('login');
          setShowAuth(true);
        }}
      />
    );
  }

  // Logged in
  return (
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
        <ChatPage
          userId={userId}
          aiName={userInfo?.aiName}
          language={userInfo?.language}
          profilePicture={userInfo?.profilePicture}
          nickname={userInfo?.nickname}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
      </main>

      {showSettings && (
        <SettingsModal
          userId={userId}
          profilePicture={userInfo?.profilePicture ?? null}
          onClose={() => setShowSettings(false)}
          onProfileUpdate={refetchUser}
        />
      )}

      <NotificationToast
        notifications={notifications}
        onDismiss={dismissNotification}
        onRead={markRead}
      />
    </div>
  );
}
