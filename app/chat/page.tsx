'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 页面：Chat 重定向
 * 作用：处理访问 /chat 路径的兼容性。
 * 逻辑：目前将所有访问直接重定向回首页 (/)，由首页决定展示落地页还是聊天主页。
 */
export default function ChatRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return null;
}

