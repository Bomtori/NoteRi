import React, { useState, useRef, useEffect } from "react";
import apiClient from "../../api/apiClient";

/**
 * 오디오 재생 컴포넌트 (Detail 페이지용)
 * @param {number} boardId - 보드 ID
 */
export default function AudioPlayer({ boardId }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);

  // 오디오 파일 로드
  useEffect(() => {
    if (!boardId) return;

    const loadAudio = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 오디오 다운로드 URL 가져오기
        const response = await apiClient.get(`/audio/board/${boardId}/download`, {
          responseType: "blob",
        });

        // Blob URL 생성
        const blob = new Blob([response.data], { type: "audio/*" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        setIsLoading(false);
      } catch (err) {
        console.error("오디오 로드 실패:", err);
        setError("오디오를 불러올 수 없습니다.");
        setIsLoading(false);
      }
    };

    loadAudio();

    // Cleanup
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [boardId]);

  // 오디오 메타데이터 로드
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  // 시간 업데이트
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // 재생/일시정지
  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // 시간 이동
  const handleSeek = (e) => {
    if (!audioRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // 시간 포맷팅 (MM:SS)
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // 로딩 중
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-sm text-gray-500">
        오디오 로딩 중...
      </div>
    );
  }

  // 에러
  if (error) {
    return (
      <div className="flex items-center justify-center py-4 text-sm text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {/* 숨겨진 오디오 엘리먼트 */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />

      {/* 재생/일시정지 버튼 */}
      <button
        onClick={togglePlayPause}
        className="flex-shrink-0 w-10 h-10 rounded-full bg-[#7E37F9] hover:bg-[#6c2de2] text-white flex items-center justify-center transition-colors"
      >
        {isPlaying ? (
          // 일시정지 아이콘
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 4a1 1 0 011 1v10a1 1 0 11-2 0V5a1 1 0 011-1zm10 0a1 1 0 011 1v10a1 1 0 11-2 0V5a1 1 0 011-1z" />
          </svg>
        ) : (
          // 재생 아이콘
          <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 4.1c-.4-.3-1 0-1 .5v10.8c0 .5.6.8 1 .5l8.6-5.4c.4-.2.4-.8 0-1L6.3 4.1z" />
          </svg>
        )}
      </button>

      {/* 시간 표시 (현재) */}
      <span className="text-sm text-gray-600 font-mono">
        {formatTime(currentTime)}
      </span>

      {/* 프로그레스 바 */}
      <div
        className="flex-1 h-2 bg-gray-200 rounded-full cursor-pointer relative overflow-hidden"
        onClick={handleSeek}
      >
        <div
          className="absolute top-0 left-0 h-full bg-[#7E37F9] rounded-full transition-all"
          style={{ width: `${(currentTime / duration) * 100}%` }}
        />
      </div>

      {/* 시간 표시 (전체) */}
      <span className="text-sm text-gray-600 font-mono">
        {formatTime(duration)}
      </span>
    </div>
  );
}