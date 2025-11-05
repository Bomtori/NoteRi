// src/lib/channelTalk.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as ChannelService from '@channel.io/channel-web-sdk-loader';

/** ---------- 내부 유틸 ---------- */
function hasWindow() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}
function getChannel(): any | null {
  if (!hasWindow()) return null;
  return (window as any).ChannelIO ?? null;
}
function hasChannel() {
  const ch = getChannel();
  return typeof ch === 'function';
}

/** ---------- 내부 상태 ---------- */
let scriptLoaded = false;
let booted = false;
let booting = false;
let lastPage: string | null = null;

/** ---------- 로더 ---------- */
export async function loadChannelTalk() {
  if (!hasWindow()) return;
  if (!scriptLoaded) {
    await ChannelService.loadScript();
    scriptLoaded = true;
  }
}

/** ---------- 공통 부트 ---------- */
async function _boot(payload: Record<string, any>) {
  await loadChannelTalk();
  const ch = getChannel();
  if (typeof ch !== 'function') {
    console.warn('[ChannelTalk] ChannelIO is not available after loadScript.');
    return;
  }
  return new Promise<void>((resolve) => {
    ch('boot', payload, (err: any) => {
      if (err) {
        console.error('[ChannelTalk] boot error:', err);
        booted = false;
        resolve();
        return;
      }
      booted = true;
      resolve();
    });
  });
}

/** ---------- 부트 API ---------- */
type BootCommon = {
  pluginKey?: string;
  hideChannelButtonOnBoot?: boolean;
  language?: 'ko' | 'ja' | 'en' | string;
};
type BootAnonymous = BootCommon & {};
type BootMember = BootCommon & {
  memberId: string;
  memberHash?: string;
  profile?: {
    name?: string | null;
    email?: string | null;
    mobileNumber?: string | null; // E.164 권장
  };
};

export async function bootAnonymous(opt: BootAnonymous = {}) {
    if (!hasWindow()) return;
    if (booted || booting) return;
    booting = true;

    const pluginKey =
        opt.pluginKey ?? (import.meta as any).env?.VITE_CHANNELIO_PLUGIN_KEY;

    // ✅ 기본 위젯 숨기기 옵션 추가
    await _boot({
        pluginKey,
        hideDefaultLauncher: true,  // ← 이 줄 추가
        ...opt,
    });

    booting = false;
}

export async function bootMember(opt: BootMember) {
    if (!hasWindow()) return;
    if (booted || booting) return;
    booting = true;

    const pluginKey =
        opt.pluginKey ?? (import.meta as any).env?.VITE_CHANNELIO_PLUGIN_KEY;

    // ✅ 동일하게 숨김 옵션 추가
    await _boot({
        pluginKey,
        hideDefaultLauncher: true,  // ← 이 줄 추가
        ...opt,
    });

    booting = false;
}

/** ---------- 세션/표시 제어 ---------- */
export function shutdown() {
  const ch = getChannel();
  if (!ch) return;
  ch('shutdown');
  booted = false;
  lastPage = null;
}
export function showMessenger() {
  const ch = getChannel();
  if (!ch) return;
  ch('showMessenger');
}
export function hideMessenger() {
  const ch = getChannel();
  if (!ch) return;
  ch('hideMessenger');
}
export function openChat(message?: string) {
  const ch = getChannel();
  if (!ch) return;
  ch('openChat', undefined, message);
}
export function track(eventName: string, props?: Record<string, any>) {
  const ch = getChannel();
  if (!ch || !booted) return;
  ch('track', eventName, props);
}

/** ---------- SPA 라우트 동기화 ---------- */
export function setPage(url?: string, title?: string) {
  const ch = getChannel();
  if (!ch || !booted) return;

  const page = (url ?? (hasWindow() ? window.location.href : '')).toString();
  if (!page) return;
  if (lastPage === page) return; // 중복 호출 방지
  lastPage = page;

  if (typeof title === 'string' && title.length > 0) {
    ch('setPage', { page, title }); // 객체형
  } else {
    ch('setPage', page); // 문자열형
  }
}

/** ---------- 사용자 정보 갱신 ---------- */
export function updateUser(user: {
  language?: string;
  profile?: { name?: string | null; email?: string | null; mobileNumber?: string | null };
}) {
  const ch = getChannel();
  if (!ch || !booted) return;
  ch('updateUser', user, (err: any) => {
    if (err) console.error('[ChannelTalk] updateUser error:', err);
  });
}

let navListenerInstalled = false;

export function installSpaNavigationListener() {
  if (navListenerInstalled) return;
  if (typeof window === 'undefined') return;

  const ch = (window as any).ChannelIO;
  // 굳이 ChannelIO 존재 체크는 필요 없지만, 부트 전이라도 리스너만 설치
  // setPage 내부에서 booted 체크하므로 안전

  const callSetPage = () => {
    try {
      // title은 문서 제목 사용
      setPage(window.location.href, document.title);
    } catch {}
  };

  // pushState/replaceState 패치
  const wrap = (type: 'pushState' | 'replaceState') => {
    const orig = history[type];
    return function (this: History, ...args: any[]) {
      const ret = orig.apply(this, args as any);
      // 마이크로태스크 뒤에 호출해 SPA 렌더 직후 상태로 반영
      queueMicrotask(callSetPage);
      return ret;
    };
  };

  history.pushState = wrap('pushState');
  history.replaceState = wrap('replaceState');

  // 뒤로가기/앞으로가기
  window.addEventListener('popstate', callSetPage);

  // 초기 1회
  queueMicrotask(callSetPage);

  navListenerInstalled = true;
}