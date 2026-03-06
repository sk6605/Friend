'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import InsightsPage from '@/app/components/InsightsPage';

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
