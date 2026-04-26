'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import InsightsPage from '@/app/components/InsightsPage';

/**
 * 页面：洞察摘要 (Insights Route)
 * 作用：作为 /insights 的路由入口，负责鉴权并渲染 InsightsPage 组件。
 */
export default function Insights() {
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const id = localStorage.getItem('userId');
    if (!id) {
      router.push('/');
      return;
    }
    setUserId(id);
  }, [router]);

  if (!userId) return null;

  return <InsightsPage userId={userId} />;
}

