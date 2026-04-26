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
 * 页面：根入口 / 首页 (Home)
 * 作用：作为应用的顶层控制器，负责全站的状态分流（未登录/已登录）及全局组件的挂载。
 * 
 * 核心逻辑：
 * 1. 鉴权检查：通过本地 utils/auth 检查是否存在已存储的 userId。
 * 2. 未登录流：默认展示 LandingPage (落地页)。用户点击开始或登录时，展示 AuthScreen。
 * 3. 已登录流：渲染主应用架构，包含 Sidebar (侧边栏) 和 ChatPage (聊天主视窗)。
 * 4. 全局服务挂载：在此处初始化通知钩子 (useNotifications) 和推送服务 (usePushNotifications)。
 */
export default function Home() {
  const [userId, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // 核心数据模型：拉取用户信息、通知列表
  const { userInfo, refetch: refetchUser } = useUserInfo(userId);
  const { notifications, dismissNotification, markRead } = useNotifications(userId);
  
  // 自动初始化浏览器推送通知
  usePushNotifications(userId || '');

  // 挂载后初始化：从 localStorage 同步用户状态
  useEffect(() => {
    setUid(getUserId());
    setReady(true);
  }, []);

  // 防闪烁：在 ready 之前不渲染任何内容
  if (!ready) return null;

  // 情形 A：用户尚未登录 — 展示落地页或鉴权界面
  if (!userId) {
    // 渲染：鉴权屏幕 (登录/注册)
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

    // 渲染：默认落地页
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

  // 情形 B：用户已登录 — 展示主应用布局
  return (
    <div className="flex h-screen overflow-hidden">
      {/* 移动端侧边栏蒙层 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边导航栏 (Sidebar)：响应式控制（桌面端常驻，移动端由抽屉触发） */}
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
            window.location.href = '/'; // 彻底登出并回退
          }}
          onOpenSettings={() => setShowSettings(true)}
          onNavigate={() => setSidebarOpen(false)}
        />
      </div>

      {/* 聊天主页面容器 */}
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

      {/* 全局设置模态框 */}
      {showSettings && (
        <SettingsModal
          userId={userId}
          profilePicture={userInfo?.profilePicture ?? null}
          onClose={() => setShowSettings(false)}
          onProfileUpdate={refetchUser}
        />
      )}

      {/* 全局通知悬浮窗：处理雨具提醒、心情统计等系统消息 */}
      <NotificationToast
        notifications={notifications}
        onDismiss={dismissNotification}
        onRead={markRead}
      />
    </div>
  );
}

