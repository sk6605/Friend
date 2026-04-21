'use client';

import { useState, useEffect } from 'react';

interface UserInfo {
  id: string;
  nickname: string;
  aiName: string;
  language: string;
  profilePicture: string | null;
  persona?: string;
  subscription?: {
    plan?: {
      name: string;
      displayName?: string;
    }
  } | null;
}

export function useUserInfo(userId: string | null) {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  const refetch = () => {
    if (!userId) return;
    fetch(`/api/users/${userId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setUserInfo(data);
      })
      .catch(() => { });
  };

  useEffect(() => {
    refetch();
  }, [userId]);

  return { userInfo, refetch };
}
