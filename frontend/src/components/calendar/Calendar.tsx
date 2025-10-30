import React, { useCallback, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { AnimatePresence, motion } from "framer-motion";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem("access_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
};

const toISO = (d: Date | string | null | undefined) =>
    d ? new Date(d).toISOString() : undefined;

type FormState = {
    id?: string;
    title: string;
    description?: string;
    allDay: boolean;
    start: string;
    end?: string;
    color?: string;
    location?: string;
    remind_morning?: boolean;
};

export default function Calendar() {
    const calRef = useRef<FullCalendar | null>(null);
    const [events, setEvents] = useState<EventInput[]>([]);
    const [viewRange, setViewRange] = useState<{ start: Date; end: Date } | null>(
        null
    );
    const [showEditor, setShowEditor] = useState(false);
    const [form, setForm] = useState<FormState | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    // const [editorPos, setEditorPos] = useState<{ x: number; y: number } | null>(null); // 폼위치계산 다틀려서 주석처리
    const COLORS = ["#7E37F9", "#FF7A00", "#2E90FA", "#14B8A6", "#EC4899"];
    // HEX → RGBA 변환
        const hexToRgba = (hex: string, opacity: number) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        };

    const mapApiEventToFC = (ev: any): EventInput => {
        const color = ev.extendedProps?.color ?? "#7E37F9";
        const bg = hexToRgba(color, 0.2);

        return {
            id: String(ev.id),
            title: ev.title,
            start: ev.start,
            end: ev.end,
            allDay: ev.allDay,
            backgroundColor: `${color}22`, // ✅ 약간 투명한 배경
            borderColor: color,             // ✅ 진한 테두리
            textColor: "#111111",           // ✅ 글자 잘 보이게
            classNames: ["custom-event"],   // ✅ 커스텀 CSS hook
            extendedProps: { ...ev.extendedProps, color },
        };
    };

    const fetchEvents = useCallback(async (start: Date, end: Date) => {
        try {
            const q = new URLSearchParams({ start: toISO(start)!, end: toISO(end)! });
            const resp = await fetch(`${API_BASE}/calendar?${q.toString()}`, {
                headers: getAuthHeaders(),
                credentials: "include",
            });
            const data = await resp.json();
            setEvents(data.map(mapApiEventToFC));
        } catch {}
    }, []);

    const refresh = () => viewRange && fetchEvents(viewRange.start, viewRange.end);

    const onDatesSet = (arg: any) => {
        setViewRange({ start: arg.start, end: arg.end });
        fetchEvents(arg.start, arg.end);
    };

    const onSelect = (sel: any) => {
        if (!sel.jsEvent) return;
        const rect = sel.jsEvent.target.getBoundingClientRect();

        // setEditorPos({
        //     x: rect.left + rect.width / 2,
        //     y: rect.bottom + window.scrollY + 8,
        // });

        setForm({
            title: "",
            description: "",
            allDay: sel.allDay ?? true,
            start: toISO(sel.start)!,
            end: sel.end ? toISO(sel.end)! : undefined,
        });
        setShowEditor(true);
    };
    const onDateClick = (info: any) => {
        // if (!info.jsEvent) return;
        const rect = info.jsEvent.target.getBoundingClientRect();

        // setEditorPos({
        //     x: rect.left + rect.width / 2,
        //     y: rect.bottom + window.scrollY + 6,
        // });

        setForm({
            title: "",
            description: "",
            allDay: true,
            start: toISO(info.date)!,
            end: undefined
        });

        setShowEditor(true);
    };


    const onEventClick = (arg: EventClickArg) => {
        const e = arg.event;
        setForm({
            id: String(e.id),
            title: e.title,
            description: (e.extendedProps as any)?.description ?? "",
            allDay: e.allDay,
            start: toISO(e.start)!,
            end: e.end ? toISO(e.end) : undefined,
        });
        setShowEditor(true);
    };

    const closeEditor = () => {
        setForm(null);
        setShowEditor(false);
    };

    const save = async () => {
        if (!form) return;
        setIsSaving(true);

        const payload = {
            title: form.title,
            description: form.description || undefined,
            start_time: form.start,
            end_time: form.end || null,
            all_day: form.allDay,
            extended_props: {
                color: form.color ?? "#7E37F9"
            }
        };

        const method = form.id ? "PATCH" : "POST";
        const url = form.id
            ? `${API_BASE}/calendar/${form.id}`
            : `${API_BASE}/calendar`;

        const resp = await fetch(url, {
            method,
            headers: getAuthHeaders(),
            credentials: "include",
            body: JSON.stringify(payload),
        });

        const saved = await resp.json(); // ✅ 여기서만!

        setIsSaving(false);

        // ✅ UI 바로 반영
        setEvents(prev => [...prev, mapApiEventToFC(saved)]);

        closeEditor();
        refresh();
    };

    const onDelete = async () => {
        if (!form?.id) return;
        await fetch(`${API_BASE}/calendar/${form.id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
            credentials: "include",
        });
        refresh();
        closeEditor();
    };
    const LILAC = {
        50:  "#f5f3ff",
        100: "#ede9fe",
        200: "#ddd6fe",
        300: "#c4b5fd",
        400: "#a78bfa",
        500: "#8b5cf6",
        600: "#7c3aed",
        700: "#6d28d9",
        800: "#5b21b6",
        900: "#4c1d95",
    };
    const onEventDrop = async (info: any) => {
        const e = info.event;
        try {
            const payload = {
                start_time: e.start?.toISOString(),
                end_time: e.end ? e.end.toISOString() : null,
                all_day: e.allDay,
            };

            await fetch(`${API_BASE}/calendar/${e.id}`, {
                method: "PATCH",
                headers: getAuthHeaders(),
                credentials: "include",
                body: JSON.stringify(payload),
            });
        } catch (err) {
            console.error("이벤트 이동 실패", err);
            info.revert(); // 실패 시 원위치
        }
    };
    const onEventResize = async (info: any) => {
        const e = info.event;
        try {
            const payload = {
                start_time: e.start?.toISOString(),
                end_time: e.end ? e.end.toISOString() : null,
                all_day: e.allDay,
            };

            await fetch(`${API_BASE}/calendar/${e.id}`, {
                method: "PATCH",
                headers: getAuthHeaders(),
                credentials: "include",
                body: JSON.stringify(payload),
            });
        } catch (err) {
            console.error("이벤트 기간 변경 실패", err);
            info.revert(); // 실패 시 원래 위치로 되돌리기
        }
    };




    const groupedEvents = React.useMemo(() => {
        const groups: Record<string, EventInput[]> = {};

        events.forEach(ev => {
            const d = new Date(ev.start as string);
            const key = d.getDate(); // ✅ 숫자 Day 기반
            if (!groups[key]) groups[key] = [];
            groups[key].push(ev);
        });

        return groups;
    }, [events]);


    return (
        <div className="w-full bg-white">
            <FullCalendar
                ref={calRef as any}
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                height="auto"
                editable={true} // 이벤트 직접 이동가능
                eventDrop={onEventDrop}   // 드래그 후 drop 처리
                eventResize={onEventResize} // 기간 조정 가능
                selectable={true}
                selectMirror={true}    // ✅ 선택 영역 셀 활성화
                unselectAuto={true}
                events={events}
                dateClick={onDateClick}
                select={onSelect}
                eventClick={onEventClick}
                themeSystem="standard"
                datesSet={onDatesSet}
            />
            {/* 📌 Editor */}
            {showEditor && form && (
                <div className="relative mt-4 w-full flex justify-center">
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25 }}
                        className="absolute top-full z-[200] bg-white shadow-xl rounded-xl
                 p-4 w-[280px] border border-gray-200 space-y-3"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 날짜 표시 */}
                        <p className="text-sm font-bold text-gray-700 text-center">
                            {new Date(form.start).getDate()}일
                        </p>

                        <div className="space-y-4 text-sm">
                            <input
                                placeholder="제목"
                                className="border rounded-md px-2 py-1 w-full"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                            />

                            <input
                                placeholder="위치 또는 화상 링크"
                                className="border rounded-md px-2 py-1 w-full"
                                value={form.location || ""}
                                onChange={(e) => setForm({ ...form, location: e.target.value })}
                            />

                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={form.allDay}
                                    onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
                                />
                                <span>하루종일</span>
                            </label>

                            <AnimatePresence>
                                {!form.allDay && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        transition={{ duration: 0.2 }}
                                        className="grid grid-cols-2 gap-2"
                                    >
                                        <div>
                                            <label>시작</label>
                                            <input
                                                type="datetime-local"
                                                className="border rounded-md px-2 py-1 w-full"
                                                value={form.start ? form.start.slice(0, 16) : ""}
                                                onChange={(e) => setForm({ ...form, start: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label>종료</label>
                                            <input
                                                type="datetime-local"
                                                className="border rounded-md px-2 py-1 w-full"
                                                value={form.end ? form.end.slice(0, 16) : ""}
                                                onChange={(e) => setForm({ ...form, end: e.target.value })}
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={form.remind_morning ?? false}
                                    onChange={(e) => setForm({ ...form, remind_morning: e.target.checked })}
                                />
                                <span>하루 전 아침에 알림</span>
                            </label>

                            <div className="flex gap-2 items-center justify-center">
                                {COLORS.map((c) => (
                                    <button
                                        key={c}
                                        className={`w-5 h-5 rounded-full border ${
                                            form.color === c ? "ring-2 ring-offset-1 ring-[#7E37F9]" : ""
                                        }`}
                                        style={{ backgroundColor: c }}
                                        onClick={() => setForm({ ...form, color: c })}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-between mt-3 text-sm">
                            {form.id ? (
                                <button className="text-red-500" onClick={onDelete}>
                                    삭제
                                </button>
                            ) : (
                                <button className="text-gray-500" onClick={closeEditor}>
                                    취소
                                </button>
                            )}
                            <button
                                className="text-[#7E37F9] font-semibold"
                                disabled={!form.title.trim()}
                                onClick={save}
                            >
                                {form.id ? "수정" : "추가"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* ✅ 일정 리스트 (날짜별 그룹) */}
            <div className="mt-6 space-y-4 px-2">
                <h3 className="text-sm font-semibold text-gray-800">📅 일정</h3>

                {events.length === 0 && (
                    <p className="text-xs text-gray-400">등록된 일정이 없습니다.</p>
                )}

                {Object.entries(groupedEvents)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([day, dayEvents]) => (
                        <div key={day}>
                            <p className="text-[13px] font-semibold text-gray-900">
                                {day}일
                            </p>
                            <div className="ml-3 space-y-1">
                                {dayEvents.map(ev => (
                                    <div key={ev.id} className="flex items-center gap-2 text-[13px]">
                                        <span
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: ev.extendedProps?.color }}
                                        />
                                        <span className="text-gray-700">{ev.title}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
            </div>





            {/* FullCalendar CSS override */}
            <style>{`
        .fc { font-size: 13px; }
        .fc-scrollgrid { border: none; }
        .fc .fc-daygrid-day-number { font-size: 12px; padding: 4px; }
        
        /* 🔹 이벤트 일정 pill style */
        .fc .fc-event {
          background-color: var(--event-color) !important;
          border: none !important;
          padding: 2px 4px !important;
          border-radius: 6px;
          font-size: 11px;
        }        
        /* 🔹 오늘 날짜 하이라이트 */
        .fc .fc-daygrid-day.fc-day-today {
          background: rgba(126, 55, 249, 0.12);
          border-radius: 12px;
          border: 1px solid #7E37F9;
        }
        
        /* 🔹 요일 텍스트 색상 */
        .fc .fc-daygrid-day.fc-day-sun .fc-daygrid-day-number {
          color: #ef4444; /* red-500 */
        }
        .fc .fc-daygrid-day.fc-day-sat .fc-daygrid-day-number {
          color: #3b82f6; /* blue-500 */
        }
       /* ✅ FullCalendar Header Buttons (Simple Style) */
/* 🔹 prev/next 화살표만 보이게 */
.fc .fc-button {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
}

/* 🔹 버튼 안쪽 아이콘 색상 */
.fc .fc-button .fc-icon {
  color: #7E37F9 !important;
  font-size: 18px;
  font-weight: bold;
}

/* 🔹 hover: 살짝 강조 */
.fc .fc-button:hover .fc-icon {
  color: #5d11e6 !important;
  transform: scale(1.1);
  transition: 0.15s ease;
}

/* 🔹 Today 버튼도 디자인 맞추기 */
.fc .fc-today-button {
  background: #E3D2FF !important;
  color: #7E37F9 !important;
  border-radius: 16px !important;
  padding: 4px 12px !important;
  border: none !important;
  box-shadow: none !important;
  font-size: 12px !important;
  font-weight: 600;
}
.fc .fc-today-button:hover {
  background: #d4bfff !important;
}
.fc-event.custom-event {
  border-left: 4px solid var(--fc-event-border-color, #7E37F9) !important;
  border-radius: 8px !important;
  padding: 2px 6px !important;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition: all 0.15s ease;
}
.fc-event.custom-event:hover {
  transform: scale(1.02);
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
}

        /* 🔹 월 이동 시 페이드 애니메이션 */
        .fc-view-harness-active {
          transition: opacity 0.35s ease-in-out;
        }
/* ✅ 뷰 전환 페이드 인 애니메이션 정상 작동 */
.fc-view-harness {
  position: relative;
}

.fc .fc-view-harness-active .fc-daygrid {
  animation: fadeIn 0.35s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
      `}</style>
        </div>
    );
}
