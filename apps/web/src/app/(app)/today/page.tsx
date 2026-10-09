'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { WEEKDAYS, addDays, dayOfMonth, daysBetween, longDate, startOfWeek, tint, toMinutes } from '@tc/core';
import { ActivityLine } from '@/components/activity';
import { PageHeader } from '@/components/shell';
import { Check, CompleteButton, Dot, Eyebrow, ProgressBar, SourceBadge, cx } from '@/components/ui';
import { useAthlete, useSessionsRange, useToggleExercise, useUpdateSession } from '@/lib/queries';
import { useSessionView, useToday, type SessionView } from '@/lib/sessions';
import { useStore } from '@/lib/store';

const greeting = (h: number) => (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');

export default function TodayPage() {
  const view = useStore((s) => s.views.today);
  const selSession = useStore((s) => s.selSession);
  const set = useStore((s) => s.set);
  const goToDate = useStore((s) => s.goToDate);
  const router = useRouter();
  const today = useToday();
  const wk0 = startOfWeek(today);
  const { data: all = [] } = useSessionsRange(wk0, addDays(wk0, 6));
  const { data: P } = useAthlete();
  const sv = useSessionView();
  if (!P) return null;

  const todays = all.filter((x) => x.date === today).map(sv);
  const focusId = (selSession && todays.some((t) => t.id === selSession) ? selSession : (todays.find((t) => t.exs.length) ?? todays[0])?.id) ?? null;
  const focus = todays.find((t) => t.id === focusId) ?? null;
  const others = todays.filter((t) => t.id !== focusId);
  const select = (id: string) => set({ selSession: id });

  let wkDone = 0, wkAll = 0;
  const week = WEEKDAYS.map((wd, i) => {
    const d = addDays(wk0, i);
    const ss = all.filter((x) => x.date === d).map(sv);
    wkAll += ss.length;
    wkDone += ss.filter((x) => x.complete).length;
    return { wd, d, day: dayOfMonth(d), isToday: d === today, sessions: ss };
  });
  const openDay = (d: string) => { goToDate(d); router.push('/calendar'); };

  return (
    <>
      <PageHeader screen="today" eyebrow={longDate(today)} title={`${greeting(new Date().getHours())}, ${P.firstName}`} />

      {view === 'Focus' && (
        <div className="flex flex-wrap items-start gap-5">
          {focus ? <FocusCard s={focus} note={P.coachNote} /> : <RestDay />}
          <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
            <section className="card flex flex-col gap-3 p-5">
              <Eyebrow>Also today</Eyebrow>
              {others.map((o) => (
                <button key={o.id} onClick={() => select(o.id)} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3 text-left hover:border-line-strong">
                  <Dot color={o.color} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] font-medium">{o.title}</span>
                    <span className="font-mono text-xs text-muted">{o.time} · {o.durationMin} min</span>
                  </span>
                  <span className="text-faint">→</span>
                </button>
              ))}
              {others.length === 0 && <div className="text-sm text-muted">Nothing else planned.</div>}
            </section>
            <section className="card flex flex-col gap-3.5 p-5">
              <div className="flex items-baseline justify-between"><Eyebrow>This week</Eyebrow><span className="font-mono text-xs text-muted">{wkDone} of {wkAll} done</span></div>
              <div className="grid grid-cols-7 gap-1">
                {week.map((d) => (
                  <button key={d.d} onClick={() => openDay(d.d)} className={cx('flex flex-col items-center gap-1.5 rounded-[10px] border pb-2.5 pt-2', d.isToday ? 'border-accent bg-accent-soft' : 'border-line bg-surface')}>
                    <span className="font-mono text-[10.5px] text-muted">{d.wd}</span>
                    <span className="text-base font-semibold">{d.day}</span>
                    <span className="flex h-1.5 gap-[3px]">{d.sessions.map((x) => <span key={x.id} className="h-1.5 w-1.5 rounded-full" style={{ background: x.color, opacity: d.d < today ? 0.55 : 1 }} />)}</span>
                  </button>
                ))}
              </div>
            </section>
            {P.goal && P.goalDate && <section className="flex flex-col gap-1 rounded-2xl bg-accent p-5 text-white">
              <span className="font-mono text-[11.5px] uppercase tracking-[.08em]">Goal</span>
              <div className="mt-1.5 flex items-baseline gap-2.5"><span className="text-[56px] font-bold leading-none tracking-[-0.04em]">{daysBetween(today, P.goalDate)}</span><span className="text-[15px] font-medium">days to go</span></div>
              <div className="mt-1.5 text-base font-semibold">{P.goal}</div>
              <div className="font-mono text-xs">{longDate(P.goalDate)}</div>
            </section>}
          </div>
        </div>
      )}

      {view === 'Timeline' && <Timeline todays={todays} focusId={focusId} onSelect={select} focus={focus} />}

      {view === 'Week' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-[repeat(7,minmax(118px,1fr))] gap-2 overflow-x-auto pb-1.5">
            {week.map((d) => (
              <div key={d.d} className={cx('flex min-h-[150px] min-w-0 flex-col gap-2 rounded-[14px] border px-2.5 py-3', d.isToday ? 'border-accent bg-accent-soft' : 'border-line bg-surface')}>
                <button onClick={() => openDay(d.d)} className="flex items-baseline justify-between px-0.5">
                  <span className="font-mono text-[11px] uppercase text-muted">{d.wd}</span><span className="text-xl font-semibold">{d.day}</span>
                </button>
                {d.sessions.map((x) => (
                  <div key={x.id} className="flex min-w-0 flex-col gap-[3px] rounded-[9px] p-2" style={{ background: tint(x.color), opacity: d.d < today ? 0.55 : 1 }}>
                    <span className="flex justify-between gap-1 font-mono text-[10.5px]"><span style={{ color: x.color }}>{x.time}</span><SourceBadge source={x.source} className="!bg-transparent !p-0" /></span>
                    <span className="text-[12.5px] font-medium leading-tight [overflow-wrap:anywhere]">{x.title}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {focus && <FocusTiles s={focus} />}
        </div>
      )}
    </>
  );
}

function useCompletion(s: SessionView) {
  const update = useUpdateSession();
  const toggle = useToggleExercise();
  const flash = useStore((st) => st.flash);
  const onError = (e: Error) => flash(`Couldn’t save: ${e.message}`);
  return {
    onComplete: () => update.mutate({ id: s.id, completed: !s.complete }, { onError }),
    onToggle: (i: number) => {
      const e = s.exs[i]!;
      toggle.mutate({ sessionId: s.id, rowId: e.rowId, done: !e.done }, { onError });
    },
  };
}

function RestDay() {
  return (
    <section className="card flex flex-[1.7_1_460px] flex-col gap-2 !rounded-[18px] px-7 py-10">
      <h2 className="text-[32px] font-semibold tracking-[-0.03em]">Rest day</h2>
      <p className="text-[15px] text-muted">Nothing planned. Recovery is part of the plan.</p>
    </section>
  );
}

function FocusCard({ s, note }: { s: SessionView; note: string | null }) {
  const { onComplete, onToggle } = useCompletion(s);
  return (
    <section className="card min-w-0 flex-[1.7_1_460px] overflow-hidden !rounded-[18px]">
      <div className="flex flex-col gap-[18px] px-5 pb-[22px] pt-[26px] md:px-7">
        <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs uppercase tracking-[.06em] text-muted">
          <Dot color={s.color} /><span style={{ color: s.color }}>{s.sportLabel}</span><span>·</span><span>{s.time}–{s.end}</span><span>·</span><span>{s.durationMin} min</span>
          <SourceBadge source={s.source} repeatedFrom={s.repeatedFrom} long className="ml-auto !text-[11px] normal-case tracking-[.03em]" />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <h2 className="text-[32px] font-semibold leading-[1.02] tracking-[-0.035em] [text-wrap:balance] md:text-[42px]">{s.title}</h2>
          <CompleteButton complete={s.complete} onClick={onComplete} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between font-mono text-xs text-muted"><span>{s.progress}</span><span>{s.exs.length} exercises</span></div>
          <ProgressBar pct={s.pct} />
        </div>
        {s.activity && <ActivityLine activity={s.activity} sport={s.sport} />}
        {note && <div className="flex items-start gap-3 rounded-xl bg-accent-tint px-4 py-3.5">
          <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-accent text-[13px] font-bold text-white">C</span>
          <div className="flex flex-col gap-[3px]">
            <span className="font-mono text-[11px] uppercase tracking-[.08em] text-accent-ink">Coach note</span>
            <p className="text-[14.5px] leading-[1.45] text-ink-2 [text-wrap:pretty]">{note}</p>
          </div>
        </div>}
      </div>
      {s.exs.map((e, i) => (
        <div key={i} onClick={() => onToggle(i)} className="grid cursor-pointer grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-line px-5 py-4 hover:bg-hover md:grid-cols-[32px_26px_minmax(0,1fr)_auto_84px] md:px-7">
          <span className="hidden font-mono text-xs text-faint md:block">{e.n}</span>
          <Check on={e.done} />
          <div className="min-w-0">
            <div className={cx('text-base font-medium', e.done && 'text-muted line-through')}>{e.name}</div>
            <div className="mt-0.5 text-[13px] text-muted">{e.muscles}</div>
          </div>
          <span className="font-mono text-[15px]">{e.rx}<span className="block text-right text-xs text-muted md:hidden">{e.load}</span></span>
          <span className="hidden text-right font-mono text-[13px] text-muted md:block">{e.load}</span>
        </div>
      ))}
      {s.exs.length === 0 && <div className="border-t border-line px-5 pb-[26px] pt-5 text-base leading-normal text-ink-3 md:px-7">{s.note}</div>}
    </section>
  );
}

function Timeline({ todays, focusId, onSelect, focus }: { todays: SessionView[]; focusId: string | null; onSelect: (id: string) => void; focus: SessionView | null }) {
  const H = 54, h0 = 6, h1 = 22;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hours = Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i);

  return (
    <div className="flex flex-wrap items-start gap-5">
      <section className="card min-w-0 flex-[1_1_280px] !rounded-[18px] py-5 pl-4 pr-5">
        <div className="relative" style={{ height: (h1 - h0) * H }}>
          {hours.map((h) => (
            <div key={h} className="absolute inset-x-0 flex items-start gap-2.5" style={{ top: (h - h0) * H }}>
              <span className="w-[46px] -translate-y-[7px] font-mono text-[11px] text-faint">{String(h).padStart(2, '0')}:00</span>
              <span className="h-px flex-1 bg-accent-soft" />
            </div>
          ))}
          {todays.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="absolute left-[58px] right-0 flex flex-col gap-0.5 overflow-hidden rounded-xl px-3 py-2.5 text-left"
              style={{ top: (toMinutes(t.time) / 60 - h0) * H, height: Math.max((t.durationMin / 60) * H - 4, 46), background: tint(t.color), border: `1.5px solid ${t.id === focusId ? t.color : 'transparent'}` }}
            >
              <span className="font-mono text-[11px] uppercase tracking-[.06em]" style={{ color: t.color }}>{t.sportLabel} · {t.time} · <SourceBadge source={t.source} className="!bg-transparent !p-0 !text-[11px]" /></span>
              <span className="text-[15px] font-semibold">{t.title}</span>
              <span className="text-[12.5px] text-muted">{t.durationMin} min</span>
            </button>
          ))}
          {nowMin >= h0 * 60 && nowMin <= h1 * 60 && (
            <div className="pointer-events-none absolute left-[50px] right-0 flex items-center" style={{ top: (nowMin / 60 - h0) * H - 4 }}>
              <span className="h-[9px] w-[9px] rounded-full bg-accent" /><span className="h-[1.5px] flex-1 bg-accent" />
            </div>
          )}
        </div>
      </section>
      {focus ? <TimelineDetail s={focus} /> : <section className="card flex-[1.4_1_400px] !rounded-[18px] px-6 py-8"><h2 className="text-[28px] font-semibold">Rest day</h2></section>}
    </div>
  );
}

function TimelineDetail({ s }: { s: SessionView }) {
  const { onComplete, onToggle } = useCompletion(s);
  return (
    <section className="flex min-w-0 flex-[1.4_1_400px] flex-col gap-3.5">
      <div className="card flex flex-col gap-4 !rounded-[18px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-xs uppercase tracking-[.06em]" style={{ color: s.color }}>{s.sportLabel} · {s.time}–{s.end}</span>
            <h2 className="text-[30px] font-semibold tracking-[-0.03em]">{s.title}</h2>
            <SourceBadge source={s.source} repeatedFrom={s.repeatedFrom} long className="self-start !text-[11px]" />
          </div>
          <CompleteButton complete={s.complete} onClick={onComplete} small />
        </div>
        <div className="flex items-center gap-3"><ProgressBar pct={s.pct} /><span className="font-mono text-xs text-muted">{s.progress}</span></div>
        {s.exs.length === 0 && <p className="text-[15px] leading-normal text-ink-3">{s.note}</p>}
        {s.activity && <ActivityLine activity={s.activity} sport={s.sport} />}
      </div>
      {s.exs.map((e, i) => (
        <div key={i} onClick={() => onToggle(i)} className="card grid cursor-pointer grid-cols-[26px_minmax(0,1fr)_auto] items-start gap-4 !rounded-[14px] px-5 py-[18px] hover:border-line-strong">
          <span className="mt-0.5"><Check on={e.done} /></span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className={cx('text-base font-medium', e.done && 'text-muted line-through')}>{e.name}</span>
            <span className="text-[13.5px] leading-[1.45] text-muted [text-wrap:pretty]">{e.cue}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5"><span className="font-mono text-base">{e.rx}</span><span className="font-mono text-xs text-muted">{e.load}</span></div>
        </div>
      ))}
    </section>
  );
}

function FocusTiles({ s }: { s: SessionView }) {
  const { onComplete, onToggle } = useCompletion(s);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-xs uppercase tracking-[.06em]" style={{ color: s.color }}>Today · {s.sportLabel} · {s.time} · {s.durationMin} min</span>
          <h2 className="text-[30px] font-semibold tracking-[-0.03em]">{s.title}</h2>
        </div>
        <div className="flex items-center gap-3.5"><span className="font-mono text-xs text-muted">{s.progress}</span><CompleteButton complete={s.complete} onClick={onComplete} small /></div>
      </div>
      {s.exs.length === 0 && <p className="text-[15px] text-ink-3">{s.note}</p>}
      {s.activity && <ActivityLine activity={s.activity} sport={s.sport} />}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
        {s.exs.map((e, i) => (
          <button key={i} onClick={() => onToggle(i)} className="flex min-h-[190px] flex-col gap-3.5 rounded-2xl bg-surface p-[18px] text-left" style={{ border: `1.5px solid ${e.done ? 'var(--color-accent)' : 'var(--color-line)'}` }}>
            <div className="flex items-center justify-between"><span className="font-mono text-xs text-faint">{e.n}</span><Check on={e.done} /></div>
            <div className="flex flex-col gap-0.5"><span className="font-mono text-[28px] font-medium tracking-[-0.02em]">{e.rx}</span><span className="font-mono text-[13px] text-muted">{e.load}</span></div>
            <div className="mt-auto flex flex-col gap-0.5">
              <span className={cx('text-[15.5px] font-medium', e.done && 'text-muted line-through')}>{e.name}</span>
              <span className="text-[12.5px] text-muted">{e.muscles}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
