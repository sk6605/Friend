'use client';

import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatPage from '@/app/components/ChatPage';
import { getUserId } from '@/app/utils/auth';
import { useUserInfo } from '@/app/lib/useUserInfo';
import { useSidebarContext } from '../SidebarContext';

/**
 * 页面：特定会话详情页 (Chat Conversation Route)
 * 作用：支持通过 URL ID 直接访问特定对话（如从搜索结果跳转）。
 * 
 * 逻辑：
 * 1. 参数解析：使用 Next.js `use(params)` 异步解构 conversationId。
 * 2. 鉴权：检查本地存储，若无 userId 则重定向至根落地页。
 * 3. 搜索增强：从 URL 查询参数中提取 `highlight` (高亮消息 ID) 和 `q` (搜索关键词)，并透传给 ChatPage。
 */
export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: conversationId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const { userInfo } = useUserInfo(userId);
  const { openSidebar } = useSidebarContext();

  // 获取 URL 中的搜索/高亮参数
  const highlightMessageId = searchParams.get('highlight') || undefined;
  const searchQuery = searchParams.get('q') || undefined;

  useEffect(() => {
    const uid = getUserId();
    if (!uid) {
      router.replace('/'); // 未登录则强制打回首页
      return;
    }
    setUserId(uid);
    setReady(true);
  }, [router]);

  // 加载中状态
  if (!ready || !userId) return null;

  return (
    <ChatPage
      conversationId={conversationId}
      userId={userId}
      aiName={userInfo?.aiName}
      language={userInfo?.language}
      profilePicture={userInfo?.profilePicture}
      nickname={userInfo?.nickname}
      onOpenSidebar={openSidebar}
      highlightMessageId={highlightMessageId}
      searchQuery={searchQuery}
    />
  );
}

