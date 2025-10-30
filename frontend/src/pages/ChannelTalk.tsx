// src/pages/ChannelTalk.tsx
import { useEffect, useRef } from 'react';
import { bootAnonymous, bootMember, installSpaNavigationListener, openChat, showMessenger, track } from '../lib/channelTalk';
import apiClient from '../api/apiClient';

type CurrentUser = {
  id: number | string;
  email?: string | null;
  name?: string | null;
  nickname?: string | null;
  plan_name?: string | null;
};

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const { data } = await apiClient.get('/users/me');
    return {
      id: data.id,
      email: data.email ?? null,
      name: data.name ?? null,
      nickname: data.nickname ?? null,
      plan_name: data.plan_name ?? 'free',
    };
  } catch {
    return null;
  }
}

export default function ChannelTalk() {
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;

    (async () => {
      // 1) 부트
      const user = await fetchCurrentUser();
      if (user && user.id != null) {
        await bootMember({
          memberId: String(user.id),
          language: 'ko',
          profile: {
            name: user.name ?? user.nickname ?? null,
            email: user.email ?? null,
          },
        });
        track('user_session_started', { plan_name: user.plan_name ?? 'free' });
      } else {
        await bootAnonymous({ language: 'ko' });
      }

      // 2) SPA 네비게이션 리스너 설치 (부트 이후)
      installSpaNavigationListener();
    })();
  }, []);

  const handleOpen = () => {
    track('support_entry', { from: 'channelTalk_page' });
    openChat(`안녕하세요! 문의드립니다`);
    showMessenger();
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">채널톡 문의</h1>
      <p className="text-sm text-gray-600">아래 버튼을 눌러 바로 문의를 시작하세요.</p>
      <button
        onClick={handleOpen}
        className="px-4 py-2 rounded-lg shadow border hover:opacity-90"
      >
        채팅 열기
      </button>
    </div>
  );
}