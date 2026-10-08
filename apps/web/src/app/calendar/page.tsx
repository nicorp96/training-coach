'use client';

import { useRouter } from 'next/navigation';
import {
  MONTHS,
  WEEKDAYS,
  addDays,
  addMonths,
  dayOfMonth,
  longDate,
  monthIndex,
  startOfWeek,
  tint,
  toDate,
  weekday,
} from '@tc/core';
import { PageHeader } from '@/components/shell';
import { Chip, Dot, Eyebrow, SourceBadge, cx } from '@/components/ui';
import { SOURCES, useSessionView, useSessions, useToday } from '@/lib/sessions';
import { useStore, type SourceFilter } from '@/lib/store';

const FILTERS: [SourceFilter, string][] = [['all', 'All'], ['coach', 'Coach'], ['me', 'You'], ['past', 'Repeat']];

export default function CalendarPage() {
  const view = useStore((s) => s.views.calendar);
  const { calMonth, weekStart, selDate, srcFilter, set, goToDate, updateDraft } = useStore();
  const router = useRouter();
  const today = useToday();
  const all = useSessions();
  const sv = useSessionView();

  const byDate = (d: string) => all.filter((x) => x.date === d);
  const byDateF = (d: string) => byDate(d).filter((x) => srcFilter === 'all' || x.source === srcFilter);
  const openBuilder = (date: string) => { updateDraft({ date }); router.push('/builder'); };

  const mi = monthIndex(calMonth);
  const dim = new Date(Date.UTC(toDate(calMonth).getUTCFullYear(), mi + 1, 0)).getUTCDate();
  const nCells = Math.ceil((weekday(calMonth) + dim) / 7) * 7;
  const gridStart = startOfWeek(calMonth);
  const cells = Array.from({ length: nCells }, (_, i) => addDays(gridStart, i));

  const we = addDays(weekStart, 6);
  const weekLabel = monthIndex(weekStart) === monthIndex(we)
    ? `${dayOfMonth(weekStart)} – ${dayOfMonth(we)} ${MONTHS[monthIndex(we)]}`
    : `${dayOfMonth(weekStart)} ${MONTHS[monthIndex(weekStart)]!.slice(0, 3)} – ${dayOfMonth(we)} ${MONTHS[monthIndex(we)]!.slice(0, 3)}`;

  const selected = byDate(selDate).map(sv);
  const goToday = () => goToDate(today);

  return (
    <>
      <PageHeader screen="calendar" eyebrow="Plan" title={`${MONTHS[mi]} at a glance`} />
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1 !text-[11px] !text-faint">Planned by</span>
            {FILTERS.map(([k, l]) => (
              <Chip key={k} active={srcFilter === k} onClick={() => set({ srcFilter: k })} className="!px-3 !py-1.5 !text-[13px]">
                <Dot color={k === 'all' ? 'transparent' : SOURCES[k].color} size={7} />{l}
              </Chip>
            ))}
          </div>

          {view === 'Month' && (
            <section className="card !rounded-[18px] p-3 md:p-[18px]">
              <NavRow label={`${MONTHS[mi]} ${toDate(calMonth).getUTCFullYear()}`} onPrev={() => set({ calMonth: addMonths(calMonth, -1) })} onNext={() => set({ calMonth: addMonths(calMonth, 1) })} onToday={goToday} />
              <div className="mb-1.5 grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((w) => <div key={w} className="px-1 font-mono text-[11px] uppercase tracking-[.06em] text-faint md:px-2">{w}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1 md:gap-1.5">
                {cells.map((d) => {
                  const sel = d === selDate, isT = d === today;
                  return (
                    <button
                      key={d}
                      onClick={() => set({ selDate: d })}
                      className={cx('flex min-h-[72px] min-w-0 flex-col gap-[5px] rounded-[10px] border p-1 text-left hover:border-line-strong md:min-h-[108px] md:p-[7px]', sel ? 'border-accent bg-accent-soft' : 'border-accent-soft bg-surface-2')}
                      style={{ opacity: monthIndex(d) === mi ? 1 : 0.4 }}
                    >
                      <span className={cx('grid h-[26px] w-[26px] place-items-center rounded-full font-mono text-[12.5px] font-medium', isT ? 'bg-accent text-white' : 'text-ink')}>{dayOfMonth(d)}</span>
                      {byDateF(d).map((x) => {
                        const c = sv(x).color;
                        return (
                          <span key={x.id} className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-[3px] text-xs" style={{ background: tint(c), opacity: d < today ? 0.6 : 1 }}>
                            <Dot color={c} size={6} /><span className="hidden truncate md:inline">{x.title}</span>
                          </span>
                        );
                      })}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {view === 'Week' && (
            <section className="card !rounded-[18px] p-[18px]">
              <NavRow label={weekLabel} onPrev={() => set({ weekStart: addDays(weekStart, -7) })} onNext={() => set({ weekStart: addDays(weekStart, 7) })} onToday={goToday} />
              <div className="grid grid-cols-[repeat(7,minmax(118px,1fr))] gap-2 overflow-x-auto pb-1.5">
                {WEEKDAYS.map((w, i) => {
                  const d = addDays(weekStart, i), sel = d === selDate;
                  return (
                    <div key={d} className={cx('flex min-h-[420px] min-w-0 flex-col gap-2 rounded-xl border px-2 py-2.5', sel ? 'border-accent bg-accent-soft' : 'border-accent-soft bg-surface-2')}>
                      <button onClick={() => set({ selDate: d })} className="flex flex-col items-start gap-0.5 px-1 pb-1.5 pt-0.5">
                        <span className="font-mono text-[11px] uppercase text-muted">{w}</span>
                        <span className={cx('text-2xl font-semibold', d === today ? 'text-accent' : 'text-ink')}>{dayOfMonth(d)}</span>
                      </button>
                      {byDateF(d).map((x) => {
                        const v = sv(x);
                        return (
                          <button key={x.id} onClick={() => set({ selDate: d })} className="flex min-w-0 flex-col gap-1.5 rounded-[10px] border border-line-2 bg-surface-2 p-2.5 text-left" style={{ opacity: d < today ? 0.6 : 1 }}>
                            <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase" style={{ color: v.color }}><Dot color={v.color} size={6} />{x.time}</span>
                            <span className="text-[13px] font-medium leading-tight [overflow-wrap:anywhere]">{x.title}</span>
                            <span className="flex flex-wrap items-center justify-between gap-1.5"><span className="text-[11.5px] text-muted">{x.durationMin} min</span><SourceBadge source={x.source} className="!text-[10px]" /></span>
                          </button>
                        );
                      })}
                      <button onClick={() => openBuilder(d)} className="mt-auto rounded-[9px] border border-dashed border-line-3 p-[7px] text-[12.5px] text-muted hover:border-accent hover:text-accent">+ Add</button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <aside className="card sticky top-6 flex flex-[1_1_280px] flex-col gap-3.5 !rounded-[18px] p-5">
          <div className="flex flex-col gap-1">
            <Eyebrow>{selDate === today ? 'Today' : selDate < today ? 'Past' : 'Upcoming'}</Eyebrow>
            <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{longDate(selDate)}</h3>
          </div>
          {selected.map((x) => (
            <div key={x.id} className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface-2 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[.05em]" style={{ color: x.color }}><Dot color={x.color} size={7} />{x.sportLabel} · {x.time}</span>
                <span className="font-mono text-[11px] text-muted">{x.statusLabel}</span>
              </div>
              <div className="text-base font-semibold">{x.title}</div>
              <SourceBadge source={x.source} repeatedFrom={x.repeatedFrom} long className="self-start" />
              {x.exs.length === 0 && <div className="text-[13px] leading-[1.45] text-muted">{x.durationMin} min · {x.note}</div>}
              {x.exs.map((e) => (
                <div key={e.n} className="flex justify-between gap-2.5 text-[13px]"><span className="text-ink-3">{e.name}</span><span className="whitespace-nowrap font-mono text-muted">{e.rx}</span></div>
              ))}
            </div>
          ))}
          {selected.length === 0 && <div className="text-sm text-muted">No training planned.</div>}
          <button onClick={() => openBuilder(selDate)} className="rounded-[10px] border border-line-3 p-2.5 text-sm font-medium hover:border-accent hover:text-accent">+ Add training to this day</button>
        </aside>
      </div>
    </>
  );
}

function NavRow({ label, onPrev, onNext, onToday }: { label: string; onPrev: () => void; onNext: () => void; onToday: () => void }) {
  const btn = 'h-[34px] rounded-[9px] border border-line-3 hover:border-line-strong';
  return (
    <div className="mb-3.5 flex items-center justify-between px-1">
      <h2 className="whitespace-nowrap text-[22px] font-semibold tracking-[-0.02em]">{label}</h2>
      <div className="flex gap-1.5">
        <button onClick={onPrev} aria-label="Previous" className={cx(btn, 'w-[34px]')}>←</button>
        <button onClick={onToday} className={cx(btn, 'px-3 text-[13px]')}>Today</button>
        <button onClick={onNext} aria-label="Next" className={cx(btn, 'w-[34px]')}>→</button>
      </div>
    </div>
  );
}
