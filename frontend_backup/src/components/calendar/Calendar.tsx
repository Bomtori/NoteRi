import React, { useCallback, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { Label } from "../../../../frontend/src/components/ui/label";
import { Textarea } from "../../../../frontend/src/components/ui/textarea";
import { Switch } from "../../../../frontend/src/components/ui/switch";

/**
 * Mini month calendar widget (compact corner widget)
 * - Uses FullCalendar (dayGrid + interaction)
 * - Fetches events from FastAPI endpoints you attached (/calendar)
 * - Inline lightweight editor using shadcn Label/Textarea/Switch
 * - Draggable + resizable events -> PATCH
 * - Click to edit/delete
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

// Always return a concrete HeadersInit (avoid unions that break TS)
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem("access_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

// Helper: serialize date to ISO8601 string
const toISO = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString() : undefined;

// API -> FullCalendar mapper
const mapApiEventToFC = (ev: any): EventInput => ({
  id: String(ev.id),
  title: ev.title,
  start: ev.start,
  end: ev.end ?? undefined,
  allDay: !!ev.allDay,
  backgroundColor: ev.backgroundColor ?? undefined,
  textColor: ev.textColor ?? undefined,
  borderColor: ev.borderColor ?? undefined,
  url: ev.url ?? undefined,
  extendedProps: ev.extendedProps ?? {},
});

// Lightweight form model for create/update
type FormState = {
  id?: string; // present -> update mode
  title: string;
  description?: string;
  allDay: boolean;
  start: string; // ISO
  end?: string; // ISO
};

export default function Calendar() {
  const calRef = useRef<FullCalendar | null>(null);
  const [events, setEvents] = useState<EventInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewRange, setViewRange] = useState<{ start: Date; end: Date } | null>(
    null
  );

  // editor
  const [showEditor, setShowEditor] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchEvents = useCallback(async (start: Date, end: Date) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ start: toISO(start)!, end: toISO(end)! });
      const resp = await fetch(`${API_BASE}/calendar?${q.toString()}`, {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!resp.ok) throw new Error(`GET /calendar failed: ${resp.status}`);
      const data = await resp.json();
      setEvents(data.map(mapApiEventToFC));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    if (!viewRange) return;
    fetchEvents(viewRange.start, viewRange.end);
  }, [viewRange, fetchEvents]);

  // When calendar's visible range changes (month nav)
  const onDatesSet = useCallback((arg: any) => {
    const start = arg.start as Date;
    const end = arg.end as Date;
    setViewRange({ start, end });
    fetchEvents(start, end);
  }, [fetchEvents]);

  // Select to create (use any to avoid version/type mismatch across @fullcalendar/*)
  const onSelect = useCallback((sel: any) => {
    const allDay = sel.allDay ?? true;
    setForm({
      id: undefined,
      title: "",
      description: "",
      allDay,
      start: toISO(sel.start)!,
      end: sel.end ? toISO(sel.end)! : undefined,
    });
    setShowEditor(true);
  }, []);

  // Click -> open update editor
  const onEventClick = useCallback((arg: EventClickArg) => {
     arg.jsEvent.preventDefault();
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
  }, []);

  // Drag/Drop -> PATCH
  const onEventDrop = useCallback(async (arg: any) => {
    try {
      const id = String(arg.event.id);
      await fetch(`${API_BASE}/calendar/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({
          start_time: toISO(arg.event.start)!,
          end_time: arg.event.end ? toISO(arg.event.end) : null,
          all_day: arg.event.allDay,
        }),
      });
    } catch (e) {
      console.error(e);
      arg.revert();
    } finally {
      refresh();
    }
  }, [refresh]);

  // Resize -> PATCH
  const onEventResize = useCallback(async (arg: any) => {
    try {
      const id = String(arg.event.id);
      await fetch(`${API_BASE}/calendar/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({
          start_time: toISO(arg.event.start)!,
          end_time: arg.event.end ? toISO(arg.event.end) : null,
          all_day: arg.event.allDay,
        }),
      });
    } catch (e) {
      console.error(e);
      arg.revert();
    } finally {
      refresh();
    }
  }, [refresh]);

  const closeEditor = () => {
    setShowEditor(false);
    setForm(null);
  };

  const save = useCallback(async () => {
    if (!form) return;
    setIsSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        start_time: form.start,
        end_time: form.end || null,
        all_day: form.allDay,
      } as any;

      if (form.id) {
        const resp = await fetch(`${API_BASE}/calendar/${form.id}`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
          credentials: "include",
        });
        if (!resp.ok) throw new Error(`PATCH /calendar/${form.id} failed`);
      } else {
        const resp = await fetch(`${API_BASE}/calendar`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
          credentials: "include",
        });
        if (!resp.ok) throw new Error("POST /calendar failed");
      }
      closeEditor();
      refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  }, [form, refresh]);

  const onDelete = useCallback(async () => {
    if (!form?.id) return;
    try {
      const ok = confirm("이 일정을 삭제할까요?");
      if (!ok) return;
      const resp = await fetch(`${API_BASE}/calendar/${form.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!resp.ok) throw new Error("DELETE failed");
      closeEditor();
      refresh();
    } catch (e) {
      console.error(e);
    }
  }, [form, refresh]);

  const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

  return (
    <div className="w-[400px] rounded-2xl border shadow-sm p-2 bg-background text-foreground"
     style={
        {
          // shadcn 색 변수
          ["--primary" as any]: LILAC[600],
          ["--primary-foreground" as any]: "white",
          ["--muted" as any]: LILAC[50],
          ["--muted-foreground" as any]: "#4b5563",
          // FullCalendar 커스텀 변수(임의)
          ["--fc-lilac" as any]: LILAC[600],
          ["--fc-lilac-soft" as any]: LILAC[100],
          ["--fc-lilac-ink" as any]: LILAC[900],
        } as React.CSSProperties
      }
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">My Calendar</h3>
        <div className="text-[11px] opacity-70">mini</div>
      </div>

           <FullCalendar
        ref={calRef as any}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={false}
        height="auto"
        contentHeight={"auto"}
        aspectRatio={1.05}
        selectable
        selectMirror
        editable
        eventResizableFromStart
        dayMaxEventRows={2}
        events={events}
        datesSet={onDatesSet}
        select={onSelect}
        eventClick={onEventClick}
        eventDrop={onEventDrop}
        eventResize={onEventResize}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", meridiem: false }}
        dayHeaderFormat={{ weekday: "short" }}
        buttonText={{ today: "오늘" }}
        dayCellClassNames={(arg) => {
          const classes: string[] = [];
          const dow = arg.date.getDay(); // 0: Sun, 6: Sat
          const dateStr = ymd(arg.date);
          if (dow === 0) classes.push("is-sun");
          if (dow === 6) classes.push("is-sat");

          return classes;
        }}
      />

      {showEditor && form && (
        <div className="mt-3 rounded-xl border p-3 space-y-3 bg-muted/40">
          <div className="grid gap-2">
            <Label htmlFor="title">제목</Label>
            <input
              id="title"
              className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              placeholder="일정 제목"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="desc">일정</Label>
            <Textarea
              id="desc"
              placeholder="..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/*<div className="flex items-center justify-between">*/}
          {/*  <div className="flex items-center gap-2">*/}
          {/*    <Switch*/}
          {/*      id="allday"*/}
          {/*      checked={form.allDay}*/}
          {/*      onCheckedChange={(v) => setForm({ ...form, allDay: !!v })}*/}
          {/*    />*/}
          {/*    <Label htmlFor="allday">하루 종일</Label>*/}
          {/*  </div>*/}
          {/*  <div className="text-xs opacity-70">*/}
          {/*    {new Date(form.start).toLocaleString()} {form.end ? "– " + new Date(form.end).toLocaleString() : ""}*/}
          {/*  </div>*/}
          {/*</div>*/}

          <div className="flex items-center gap-2 justify-end">
            {form.id && (
              <button
                type="button"
                onClick={onDelete}
                className="text-xs px-3 py-2 rounded-md border hover:bg-destructive/10 hover:text-destructive"
              >
                삭제
              </button>
            )}
            <button
              type="button"
              onClick={closeEditor}
              className="text-xs px-3 py-2 rounded-md border hover:bg-muted"
            >
              취소
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isSaving || !form.title.trim()}
              className="text-xs px-3 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
            >
              {form.id ? (isSaving ? "저장중…" : "수정") : (isSaving ? "추가중…" : "추가")}
            </button>
          </div>
        </div>
      )}

      {/*<p className="mt-2 text-[11px] text-muted-foreground">*/}
      {/*  날짜를 드래그해 일정 추가 · 이벤트 드래그/리사이즈로 시간 변경*/}
      {/*</p>*/}

      <style>{`
        .fc { font-size: 11px; }
        .fc .fc-daygrid-day-top { flex-direction: row; padding: 2px 4px; }
        .fc .fc-daygrid-day-number { font-size: 11px; }
        .fc .fc-daygrid-dot-event .fc-event-title { white-space: nowrap; }
        .fc .fc-event { border-radius: 6px; }
        .fc .is-sun .fc-daygrid-day-number { color: #e11d48; } /* 일요일: 붉은색(rose-600) */
        .fc .is-sat .fc-daygrid-day-number { color: #2563eb; } /* 토요일: 파란색(blue-600) */
        .fc .is-holiday .fc-daygrid-day-number { color: #e11d48; } /* 공휴일: 붉은색 */
      `}</style>
    </div>
  );
}
