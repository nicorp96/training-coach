'use client';

import { useRouter } from 'next/navigation';
import { EXERCISES, EXERCISE_IDS, MUSCLE_GROUPS, SPORTS, addDays, getExercise, longDate, shortDate, type SessionExercise, type SessionSource, type SportId } from '@tc/core';
import { PageHeader } from '@/components/shell';
import { AddButton, Check, Chip, Dot, Eyebrow, cx } from '@/components/ui';
import { useAthlete, useCreateSession, useSessionsRange, useSuggestions } from '@/lib/queries';
import { useSessionView, useToday } from '@/lib/sessions';
import { newDraft, useStore, type StartMode } from '@/lib/store';

type PlanLike = { title: string; sport: SportId; durationMin: number; exercises: SessionExercise[]; date?: string };

function useLoadPlan() {
  const updateDraft = useStore((s) => s.updateDraft);
  const flash = useStore((s) => s.flash);
  return (p: PlanLike, source: SessionSource, key: string) => {
    updateDraft({
      title: p.title, sport: p.sport, dur: String(p.durationMin), exercises: p.exercises.map((e) => ({ ...e })),
      source, repeatedFrom: p.date ?? null, pick: key,
    });
    flash(source === 'coach' ? `Loaded coach plan “${p.title}”` : `Copied “${p.title}” from ${shortDate(p.date!)}`);
  };
}

const START: [StartMode, string, string][] = [
  ['blank', 'Start from scratch', 'Build it yourself'],
  ['past', 'Repeat a past training', 'Copy one you already did'],
  ['coach', 'Ask my coach', 'Plans suggested for you'],
];

export default function BuilderPage() {
  const view = useStore((s) => s.views.builder);
  const startMode = useStore((s) => s.startMode);
  const set = useStore((s) => s.set);
  const resetDraft = useStore((s) => s.resetDraft);

  return (
    <>
      <PageHeader screen="builder" eyebrow="Create" title="New training" />
      <div className="mb-5 flex flex-col gap-3.5">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
          {START.map(([k, label, desc]) => {
            const a = startMode === k;
            return (
              <button
                key={k}
                onClick={() => { set({ startMode: k }); if (k === 'blank') resetDraft(); }}
                className={cx('flex items-center gap-3 rounded-[14px] px-4 py-3.5 text-left', a ? 'bg-accent-soft' : 'bg-surface')}
                style={{ border: `1.5px solid ${a ? 'var(--color-accent)' : 'var(--color-line)'}` }}
              >
                <span className="h-3.5 w-3.5 flex-none rounded-full" style={{ border: `4px solid ${a ? 'var(--color-accent)' : 'var(--color-line-3)'}` }} />
                <span className="flex flex-col gap-0.5"><span className="text-[15px] font-semibold">{label}</span><span className="text-[12.5px] text-muted">{desc}</span></span>
              </button>
            );
          })}
        </div>
        {startMode === 'past' && <PastPlans />}
        {startMode === 'coach' && <CoachPlans />}
      </div>
      {view === 'Form' ? <FormBuilder /> : <GuidedBuilder />}
    </>
  );
}

function UseButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={cx('mt-auto self-start rounded-lg border px-3 py-1.5 text-[13px] font-medium', active ? 'border-accent bg-accent text-white' : 'border-line bg-surface')}>
      {active ? 'Loaded ✓' : label}
    </button>
  );
}

function PastPlans() {
  const today = useToday();
  const { data: all = [], isLoading } = useSessionsRange(addDays(today, -60), addDays(today, -1));
  const pick = useStore((s) => s.draft.pick);
  const loadPlan = useLoadPlan();
  const seen = new Set<string>();
  const past = all
    .filter((x) => x.date < today && x.exercises.length)
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((x) => (seen.has(x.title) ? false : (seen.add(x.title), true)))
    .slice(0, 6);

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2.5">
      {past.map((x) => {
        const key = 'p' + x.id, a = pick === key;
        return (
          <div key={x.id} className="flex flex-col gap-2 rounded-[14px] bg-surface p-4" style={{ border: `1.5px solid ${a ? 'var(--color-accent)' : 'var(--color-line)'}` }}>
            <span className="font-mono text-[11px] text-repeat">{shortDate(x.date)} · {x.exercises.length} exercises · {x.durationMin} min</span>
            <span className="text-base font-semibold">{x.title}</span>
            <span className="text-[12.5px] leading-[1.4] text-muted">{x.exercises.map((e) => getExercise(e.id).name).join(', ')}</span>
            <UseButton active={a} label="Use this" onClick={() => loadPlan({ ...x, exercises: x.exercises.map(({ id, sets, reps, load }) => ({ id, sets, reps, load })) }, 'past', key)} />
          </div>
        );
      })}
      {!isLoading && past.length === 0 && <p className="text-sm text-muted">No strength sessions in the last 60 days yet.</p>}
    </div>
  );
}

function CoachPlans() {
  const { data: suggestions = [], isLoading } = useSuggestions();
  const pick = useStore((s) => s.draft.pick);
  const loadPlan = useLoadPlan();
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2.5">
      {!isLoading && suggestions.length === 0 && <p className="text-sm text-muted">No suggestions from your coach right now.</p>}
      {suggestions.map((p) => {
        const key = 'c' + p.id, a = pick === key, T = SPORTS[p.sport];
        return (
          <div key={key} className="flex flex-col gap-2 rounded-[14px] bg-accent-tint p-4" style={{ border: `1.5px solid ${a ? 'var(--color-accent)' : 'var(--color-line)'}` }}>
            <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[.05em]" style={{ color: T.color }}>
              <Dot color={T.color} size={7} />{T.label} · {p.durationMin} min{p.exercises.length ? ` · ${p.exercises.length} exercises` : ''}
            </span>
            <span className="text-base font-semibold">{p.title}</span>
            <span className="text-[13px] leading-[1.45] text-ink-3 [text-wrap:pretty]">{p.why}</span>
            <UseButton active={a} label="Use plan" onClick={() => loadPlan(p, 'coach', key)} />
          </div>
        );
      })}
    </div>
  );
}

/** Shared builder state + derived lists for both layouts. */
function useBuilder() {
  const s = useStore();
  const { data: athlete } = useAthlete();
  const P = { recommendedExercises: athlete?.recommendedExercises ?? [] };
  const d = s.draft;
  const sportOpts = (Object.keys(SPORTS) as SportId[]).filter((k) => (athlete?.sports ?? []).includes(k) || d.sport === k);
  const q = s.q.trim().toLowerCase();
  const recommended = (id: string) => P.recommendedExercises.includes(id);
  const ids = [...EXERCISE_IDS].sort((a, b) => Number(recommended(b)) - Number(recommended(a)));
  const picker = ids.filter((id) => (s.grp === 'All' || EXERCISES[id]!.group === s.grp) && (!q || EXERCISES[id]!.name.toLowerCase().includes(q)));
  const inDraft = (id: string) => d.exercises.some((e) => e.id === id);
  const count = `${d.exercises.length} ${d.exercises.length === 1 ? 'exercise' : 'exercises'}`;
  return { s, d, sportOpts, picker, recommended, inDraft, count, sport: SPORTS[d.sport] };
}

function Label({ children, guided }: { children: React.ReactNode; guided?: boolean }) {
  return guided ? <span className="text-sm text-muted">{children}</span> : <Eyebrow className="!text-[11px]">{children}</Eyebrow>;
}

function DetailFields({ guided }: { guided?: boolean }) {
  const { s, d, sport } = useBuilder();
  const f = cx('field', guided && '!py-[11px] !text-[15px]');
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <label className="flex flex-col gap-1.5"><Label guided={guided}>Date</Label><input type="date" className={f} value={d.date} onChange={(e) => s.updateDraft({ date: e.target.value })} /></label>
        <label className="flex flex-col gap-1.5"><Label guided={guided}>Start</Label><input type="time" className={f} value={d.time} onChange={(e) => s.updateDraft({ time: e.target.value })} /></label>
        <label className="flex flex-col gap-1.5"><Label guided={guided}>Minutes</Label><input type="number" min={5} className={f} value={d.dur} onChange={(e) => s.updateDraft({ dur: e.target.value })} /></label>
      </div>
      {sport.endurance && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
          <label className="flex flex-col gap-1.5"><Label guided={guided}>Distance (km)</Label><input type="number" className={f} placeholder="e.g. 12" value={d.dist} onChange={(e) => s.updateDraft({ dist: e.target.value })} /></label>
          <label className="flex flex-col gap-1.5"><Label guided={guided}>{guided ? 'Target pace or power' : 'Target'}</Label><input className={f} placeholder={sport.targetHint} value={d.target} onChange={(e) => s.updateDraft({ target: e.target.value })} /></label>
        </div>
      )}
    </>
  );
}

function GroupChips() {
  const grp = useStore((s) => s.grp);
  const set = useStore((s) => s.set);
  return (
    <div className="flex flex-wrap gap-1.5">
      {['All', ...MUSCLE_GROUPS].map((g) => <Chip key={g} active={grp === g} onClick={() => set({ grp: g })}>{g}</Chip>)}
    </div>
  );
}

function SetsStepper({ sets, onChange, small }: { sets: number; onChange: (n: number) => void; small?: boolean }) {
  const b = cx('h-8 bg-surface text-muted hover:text-ink', small ? 'w-[26px]' : 'w-7');
  return (
    <div className="flex items-center overflow-hidden rounded-[9px] border border-line-2">
      <button className={b} onClick={() => onChange(Math.max(1, sets - 1))} aria-label="Fewer sets">−</button>
      <span className="min-w-11 text-center font-mono text-[13px]">{sets} sets</span>
      <button className={b} onClick={() => onChange(Math.min(10, sets + 1))} aria-label="More sets">+</button>
    </div>
  );
}

function useSave() {
  const create = useCreateSession();
  const router = useRouter();
  const { draft: d, flash, goToDate, set } = useStore();
  return () => {
    const sport = SPORTS[d.sport];
    const title = d.title.trim() || `${sport.label} session`;
    const distanceKm = parseFloat(d.dist) || null;
    create.mutate(
      {
        date: d.date, time: d.time || '07:00', durationMin: parseInt(d.dur) || 45, sport: d.sport, title,
        note: sport.endurance && (distanceKm || d.target) ? [distanceKm && `${distanceKm} km`, d.target].filter(Boolean).join(' · ') : '',
        source: d.source, repeatedFrom: d.repeatedFrom,
        distanceKm: sport.endurance ? distanceKm : null, target: sport.endurance ? d.target || null : null,
        exercises: d.exercises.map((e) => ({ exerciseId: e.id, sets: e.sets, reps: e.reps, load: e.load })),
      },
      {
        onSuccess: (s) => {
          set({ draft: newDraft(), step: 1, startMode: 'blank' });
          goToDate(s.date);
          flash(`Saved “${s.title}” to ${shortDate(s.date)}`);
          router.push('/calendar');
        },
        onError: (e) => flash(`Couldn’t save: ${e.message}`),
      },
    );
  };
}

function FormBuilder() {
  const { s, d, sportOpts, picker, recommended, inDraft, count } = useBuilder();
  const save = useSave();
  return (
    <div className="flex flex-wrap items-start gap-5">
      <section className="card min-w-0 flex-[1.5_1_580px] overflow-hidden !rounded-[18px]">
        <div className="flex flex-col gap-[18px] p-6">
          <input
            value={d.title}
            onChange={(e) => s.updateDraft({ title: e.target.value })}
            placeholder="Training name"
            className="w-full border-0 border-b border-line-2 bg-transparent pb-3 pt-1 text-[28px] font-semibold tracking-[-0.02em] outline-none focus:border-accent"
          />
          <div className="flex flex-col gap-2">
            <Eyebrow className="!text-[11px]">Type</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {sportOpts.map((k) => {
                const T = SPORTS[k], a = d.sport === k;
                return (
                  <button key={k} onClick={() => s.updateDraft({ sport: k })} className={cx('flex items-center gap-2 rounded-full px-3.5 py-2 text-[13.5px] font-medium', a && 'bg-accent-soft')} style={{ border: `1.5px solid ${a ? T.color : 'var(--color-line-2)'}` }}>
                    <Dot color={T.color} />{T.label}
                  </button>
                );
              })}
            </div>
          </div>
          <DetailFields />
        </div>
        <div className="flex items-baseline justify-between border-t border-line bg-surface-2 px-6 py-3.5"><Eyebrow>Exercises</Eyebrow><span className="font-mono text-xs text-muted">{count}</span></div>
        {d.exercises.map((e, i) => {
          const E = getExercise(e.id);
          return (
            <div key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto_28px] items-center gap-3 border-t border-line px-6 py-3 md:grid-cols-[24px_minmax(120px,1fr)_auto_84px_88px_28px]">
              <span className="hidden font-mono text-xs text-faint md:block">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0"><div className="text-[15px] font-medium">{E.name}</div><div className="text-[12.5px] text-muted">{E.group}</div></div>
              <SetsStepper sets={e.sets} onChange={(sets) => s.updateDraftExercise(i, { sets })} />
              <input aria-label="Reps" className="field order-last col-span-1 !rounded-[9px] !px-2.5 !py-2 font-mono !text-[13px] md:order-none" value={e.reps} onChange={(ev) => s.updateDraftExercise(i, { reps: ev.target.value })} />
              <input aria-label="Load" className="field order-last col-span-1 !rounded-[9px] !px-2.5 !py-2 font-mono !text-[13px] md:order-none" value={e.load} onChange={(ev) => s.updateDraftExercise(i, { load: ev.target.value })} />
              <button onClick={() => s.removeDraftExercise(i)} aria-label={`Remove ${E.name}`} className="h-7 w-7 rounded-[7px] text-base text-faint hover:text-danger">×</button>
            </div>
          );
        })}
        {d.exercises.length === 0 && <div className="border-t border-line px-6 py-7 text-sm text-muted">Add exercises from the library.</div>}
        <div className="flex justify-end gap-2.5 border-t border-line px-6 py-4">
          <button onClick={s.resetDraft} className="rounded-[10px] border border-line-3 px-4 py-2.5 text-sm">Clear</button>
          <button onClick={save} className="rounded-[10px] bg-accent px-[18px] py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">Save training</button>
        </div>
      </section>

      <section className="card sticky top-6 flex min-w-0 flex-[1_1_300px] flex-col gap-3 !rounded-[18px] p-5">
        <Eyebrow>Exercise library</Eyebrow>
        <input className="field" placeholder="Search exercises" value={s.q} onChange={(e) => s.set({ q: e.target.value })} />
        <GroupChips />
        <div className="-mx-2 flex max-h-[520px] flex-col overflow-auto">
          {picker.map((id) => {
            const E = EXERCISES[id]!;
            return (
              <div key={id} className="flex items-center gap-2.5 rounded-[10px] px-2 py-2.5 hover:bg-hover">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14.5px] font-medium">
                    {E.name}{recommended(id) && <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[.05em] text-accent">For you</span>}
                  </div>
                  <div className="text-[12.5px] text-muted">{E.group} · {E.equipment}</div>
                </div>
                <AddButton added={inDraft(id)} onClick={() => s.toggleDraftExercise(id)} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function GuidedBuilder() {
  const { s, d, sportOpts, picker, recommended, inDraft, count } = useBuilder();
  const sv = useSessionView();
  const save = useSave();
  const step = s.step;
  const review = sv({
    id: 'draft', athleteId: '', date: d.date, sport: d.sport, title: d.title.trim() || `${SPORTS[d.sport].label} session`, time: d.time || '07:00',
    durationMin: parseInt(d.dur) || 45, note: '', source: d.source, repeatedFrom: d.repeatedFrom, completedAt: null, rpe: null, feeling: null,
    exercises: d.exercises.map((e, i) => ({ ...e, rowId: String(i), done: false })),
  });

  return (
    <div className="flex max-w-[880px] flex-col gap-5">
      <div className="grid grid-cols-3 gap-2">
        {['Details', 'Exercises', 'Review'].map((l, i) => (
          <button key={l} onClick={() => s.set({ step: (i + 1) as 1 | 2 | 3 })} className={cx('flex flex-col gap-2 text-left', i + 1 === step ? 'text-ink' : 'text-muted')}>
            <span className="h-1 rounded-sm" style={{ background: i + 1 <= step ? 'var(--color-accent)' : 'var(--color-line)' }} />
            <span className="font-mono text-xs uppercase tracking-[.06em]">0{i + 1} · {l}</span>
          </button>
        ))}
      </div>
      <section className="card flex flex-col gap-[22px] !rounded-[18px] p-5 md:p-7">
        {step === 1 && (
          <div className="flex flex-col gap-[22px]">
            <label className="flex flex-col gap-2">
              <span className="text-[15px] text-muted">What do you want to call it?</span>
              <input className="field !rounded-xl !px-4 !py-3.5 !text-xl font-medium" placeholder="e.g. Lower body strength" value={d.title} onChange={(e) => s.updateDraft({ title: e.target.value })} />
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-[15px] text-muted">What kind of training?</span>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
                {sportOpts.map((k) => {
                  const T = SPORTS[k], a = d.sport === k;
                  return (
                    <button key={k} onClick={() => s.updateDraft({ sport: k })} className={cx('flex min-h-[120px] flex-col gap-[22px] rounded-[14px] p-4 text-left', a && 'bg-accent-soft')} style={{ border: `1.5px solid ${a ? T.color : 'var(--color-line-2)'}` }}>
                      <Dot color={T.color} size={12} />
                      <span className="flex flex-col gap-[3px]"><span className="text-base font-semibold">{T.label}</span><span className="text-[12.5px] text-muted">{T.description}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
            <DetailFields guided />
          </div>
        )}
        {step === 2 && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[22px]">
            <div className="flex min-w-0 flex-col gap-3">
              <span className="text-[15px] text-muted">Pick exercises</span>
              <input className="field" placeholder="Search exercises" value={s.q} onChange={(e) => s.set({ q: e.target.value })} />
              <GroupChips />
              <div className="-mx-2 flex max-h-[380px] flex-col overflow-auto">
                {picker.map((id) => {
                  const E = EXERCISES[id]!;
                  return (
                    <button key={id} onClick={() => s.toggleDraftExercise(id)} className="flex items-center gap-2.5 rounded-[10px] px-2 py-2.5 text-left hover:bg-hover">
                      <Check on={inDraft(id)} size={20} />
                      <span className="flex min-w-0 flex-1 flex-col"><span className="text-[14.5px] font-medium">{E.name}</span><span className="text-[12.5px] text-muted">{E.group} · {E.equipment}</span></span>
                      {recommended(id) && <span className="font-mono text-[10px] uppercase text-accent">For you</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-2.5">
              <div className="flex justify-between"><span className="text-[15px] text-muted">Your session</span><span className="font-mono text-xs text-muted">{count}</span></div>
              {d.exercises.map((e, i) => (
                <div key={e.id} className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface-2 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2"><span className="text-[14.5px] font-medium">{getExercise(e.id).name}</span><button onClick={() => s.removeDraftExercise(i)} aria-label="Remove" className="text-base text-faint hover:text-danger">×</button></div>
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-2">
                    <SetsStepper small sets={e.sets} onChange={(sets) => s.updateDraftExercise(i, { sets })} />
                    <input aria-label="Reps" className="field !rounded-[9px] !px-[9px] !py-[7px] font-mono !text-[12.5px]" value={e.reps} onChange={(ev) => s.updateDraftExercise(i, { reps: ev.target.value })} />
                    <input aria-label="Load" className="field !rounded-[9px] !px-[9px] !py-[7px] font-mono !text-[12.5px]" value={e.load} onChange={(ev) => s.updateDraftExercise(i, { load: ev.target.value })} />
                  </div>
                </div>
              ))}
              {d.exercises.length === 0 && <div className="rounded-xl border border-dashed border-line-3 p-6 text-center text-sm text-muted">Nothing added yet.</div>}
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="flex flex-col gap-[18px]">
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-xs uppercase tracking-[.06em]" style={{ color: review.color }}>{review.sportLabel} · {longDate(review.date)} · {review.time}–{review.end}</span>
              <h2 className="text-[34px] font-semibold tracking-[-0.03em]">{review.title}</h2>
            </div>
            <div className="flex flex-col overflow-hidden rounded-xl border border-line">
              {review.exs.map((e) => (
                <div key={e.n} className="grid grid-cols-[32px_minmax(0,1fr)_auto_90px] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  <span className="font-mono text-xs text-faint">{e.n}</span><span className="text-[15px]">{e.name}</span>
                  <span className="font-mono text-sm">{e.rx}</span><span className="text-right font-mono text-[13px] text-muted">{e.load}</span>
                </div>
              ))}
              {review.exs.length === 0 && <div className="px-4 py-3.5 text-sm text-muted">{review.durationMin} min · no exercises added</div>}
            </div>
          </div>
        )}
        <div className="flex justify-between gap-2.5 border-t border-line pt-[18px]">
          <button onClick={() => s.set({ step: Math.max(1, step - 1) as 1 | 2 | 3 })} className={cx('rounded-[10px] border border-line-3 px-4 py-2.5 text-sm', step === 1 ? 'text-faint' : 'text-ink')}>Back</button>
          {step !== 3
            ? <button onClick={() => s.set({ step: (step + 1) as 2 | 3 })} className="rounded-[10px] bg-ink px-[18px] py-2.5 text-sm font-semibold text-white">Continue →</button>
            : <button onClick={save} className="rounded-[10px] bg-accent px-[18px] py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">Save training</button>}
        </div>
      </section>
    </div>
  );
}
