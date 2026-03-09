"use client";

import { useState, useEffect } from "react";
import ChatPage from "./components/ChatPage";
import Sidebar from "./components/SideBar";
import AuthScreen from "./components/AuthScreen";
import SettingsModal from "./components/SettingsModal";
import { getUserId, setUserId, logout } from "./utils/auth";
import { useUserInfo } from "./lib/useUserInfo";
import { useNotifications } from "./hooks/useNotifications";
import NotificationToast from "./components/NotificationToast";

/**
 * Page: Landing / Home
 *
 * Logic:
 * 1. Checks authentication state via `getUserId`.
 * 2. If not logged in -> Renders `AuthScreen` (Login/Register).
 * 3. If logged in -> Renders `ChatPage` with `Sidebar` and `SettingsModal`.
 * 4. Manages global state: `userId`, `sidebarOpen`, `showSettings`.
 * 5. Handles global Notifications via `NotificationToast`.
 */
export default function Home() {
  const [userId, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { userInfo, refetch: refetchUser } = useUserInfo(userId);
  const { notifications, dismissNotification, markRead } = useNotifications(userId);

  useEffect(() => {
    setUid(getUserId());
    setReady(true);
  }, []);

  if (!ready) return null;

  // Not logged in
  if (!userId) {
    return (
      <div className="flex h-screen">
        <main className="flex-1 flex items-center justify-center px-4">
          <AuthScreen
            onAuth={(id) => {
              setUserId(id);
              setUid(id);
            }}
          />
        </main>
      </div>
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
