'use client';

import { use } from 'react';
import ChatPage from '@/app/components/ChatPage';
import { getUserId } from '@/app/utils/auth';
import { useUserInfo } from '@/app/lib/useUserInfo';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

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

  const highlightMessageId = searchParams.get('highlight') || undefined;
  const searchQuery = searchParams.get('q') || undefined;

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

  return <ChatPage conversationId={conversationId} userId={userId} aiName={userInfo?.aiName} language={userInfo?.language} profilePicture={userInfo?.profilePicture} nickname={userInfo?.nickname} highlightMessageId={highlightMessageId} searchQuery={searchQuery} />;
}
