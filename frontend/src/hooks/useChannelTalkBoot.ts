// src/hooks/useChannelTalkBoot.ts
import { useEffect, useRef } from 'react';
import { bootAnonymous, bootMember, track, updateUser } from '../lib/channelTalk';
import apiClient from '../api/apiClient';

export type CurrentUser = {
  id: number | string;
  email?: string | null;
  name?: string | null;
  nickname?: string | null;
  picture?: string | null;
  oauth_provider?: string | null;
  is_active?: boolean;
  role?: string | null;
  created_at?: string;
  updated_at?: string;
  plan_name?: string; // "free" | "pro" | ...
};

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const { data } = await apiClient.get('/users/me'); // ← 네 라우트
    return {
      id: data.id,
      email: data.email ?? null,
      name: data.name ?? null,
      nickname: data.nickname ?? null,
      picture: data.picture ?? null,
      oauth_provider: data.oauth_provider ?? null,
      is_active: data.is_active ?? true,
      role: data.role ?? null,
      created_at: data.created_at,
      updated_at: data.updated_at,
      plan_name: data.plan_name ?? 'free',
    };
  } catch (e) {
    console.warn('fetchCurrentUser failed:', e);
    return null;
  }
}

export function useChannelTalkBoot() {
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;

    (async () => {
      const user = await fetchCurrentUser();

      if (user && user.id != null) {
        await bootMember({
          memberId: String(user.id),
          // memberHash: '서버에서 서명한 값', // 추후 보안강화 시 추가
          language: 'ko', // 다국어면 user.language 사용
          profile: {
            name: user.name ?? user.nickname ?? null,
            email: user.email ?? null,
            // mobileNumber: null, // 전화번호 있으면 매핑
          },
        });

        // (선택) 속성/플랜 태깅
        updateUser({
          profile: {
            name: user.name ?? user.nickname ?? null,
            email: user.email ?? null,
          },
        });
        track('user_session_started', { plan_name: user.plan_name ?? 'free' });
      } else {
        await bootAnonymous({ language: 'ko' });
      }
    })();
  }, []);
}
