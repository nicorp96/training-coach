'use client';

import { useRouter } from 'next/navigation';
import { EXERCISES, EXERCISE_IDS, MUSCLE_GROUPS, getExercise } from '@tc/core';
import { PageHeader } from '@/components/shell';
import { AddButton, Chip, cx } from '@/components/ui';
import { useAthlete } from '@/lib/queries';
import { useStore } from '@/lib/store';

export default function StrengthPage() {
  const view = useStore((s) => s.views.strength);
  const { grp, libGrp, draft, set, toggleDraftExercise, flash } = useStore();
  const router = useRouter();
  const { data: athlete } = useAthlete();
  const P = { firstName: athlete?.firstName ?? '', recommendedExercises: athlete?.recommendedExercises ?? [], recommendationNote: athlete?.recommendationNote };
  const rec = (id: string) => P.recommendedExercises.includes(id);
  const ids = [...EXERCISE_IDS].sort((a, b) => Number(rec(b)) - Number(rec(a)));
  const inDraft = (id: string) => draft.exercises.some((e) => e.id === id);
  const toggle = (id: string) => {
    if (toggleDraftExercise(id)) flash(`${getExercise(id).name} added to new training`, 'Open', () => router.push('/builder'));
  };

  const groupIds = ids.filter((id) => EXERCISES[id]!.group === libGrp);
  const nRec = groupIds.filter(rec).length;

  return (
    <>
      <PageHeader screen="strength" eyebrow="Library" title="Strength exercises" />

      {view === 'Grid' && (
        <div className="flex flex-col gap-7">
          {P.recommendedExercises.length > 0 && <section className="flex flex-col gap-4 rounded-[18px] border border-accent-line bg-accent-tint p-[22px]">
            <div className="flex max-w-[640px] flex-col gap-1.5">
              <span className="eyebrow !text-accent">Recommended for {P.firstName}</span>
              {P.recommendationNote && <p className="text-[17px] leading-[1.45] [text-wrap:pretty]">{P.recommendationNote}</p>}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5">
              {P.recommendedExercises.map((id) => {
                const E = getExercise(id);
                return (
                  <div key={id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[15px] font-medium">{E.name}</span>
                      <span className="font-mono text-xs text-muted">{E.defaults.sets} × {E.defaults.reps} · {E.defaults.load}</span>
                    </div>
                    <AddButton added={inDraft(id)} onClick={() => toggle(id)} />
                  </div>
                );
              })}
            </div>
          </section>}
          <section className="flex flex-col gap-3.5">
            <div className="flex flex-wrap gap-1.5">
              {['All', ...MUSCLE_GROUPS].map((g) => <Chip key={g} active={grp === g} onClick={() => set({ grp: g })} className="!px-[13px] !py-1.5 !text-[13px]">{g}</Chip>)}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
              {ids.filter((id) => grp === 'All' || EXERCISES[id]!.group === grp).map((id) => {
                const E = getExercise(id);
                return (
                  <div key={id} className="card flex min-h-[220px] flex-col gap-3 p-[18px]">
                    <div className="flex justify-between font-mono text-[11px] uppercase tracking-[.06em] text-muted"><span>{E.group}</span><span>{E.level}</span></div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[19px] font-semibold tracking-[-0.01em]">{E.name}</span>
                      <span className="text-[13px] text-muted">{E.muscles} · {E.equipment}</span>
                    </div>
                    <p className="text-[13.5px] leading-[1.45] text-ink-3 [text-wrap:pretty]">{E.cue}</p>
                    <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
                      <span className="font-mono text-[13px]">{E.defaults.sets} × {E.defaults.reps} <span className="text-muted">· {E.defaults.load}</span></span>
                      <AddButton added={inDraft(id)} onClick={() => toggle(id)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {view === 'Groups' && (
        <div className="grid items-start gap-5 md:grid-cols-[180px_minmax(0,1fr)]">
          <nav className="flex gap-0.5 overflow-x-auto md:sticky md:top-6 md:flex-col">
            {MUSCLE_GROUPS.map((g) => (
              <button key={g} onClick={() => set({ libGrp: g })} className={cx('flex items-baseline justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-lg font-semibold tracking-[-0.01em]', libGrp === g ? 'bg-accent-soft text-ink' : 'text-muted')}>
                <span>{g}</span><span className="font-mono text-xs font-normal text-muted">{EXERCISE_IDS.filter((id) => EXERCISES[id]!.group === g).length}</span>
              </button>
            ))}
          </nav>
          <section className="flex flex-col gap-3">
            <div className="mb-1 flex flex-wrap items-baseline gap-3.5">
              <h2 className="text-[44px] font-bold tracking-[-0.04em]">{libGrp}</h2>
              {nRec > 0 && <span className="font-mono text-xs text-accent">{nRec} recommended for {P.firstName}</span>}
            </div>
            {groupIds.map((id) => {
              const E = getExercise(id);
              return (
                <div key={id} className={cx('flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border bg-surface px-[22px] py-5', rec(id) ? 'border-accent-line' : 'border-line')}>
                  <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-[19px] font-semibold">{E.name}</span>
                      {rec(id) && <span className="rounded-[5px] bg-accent px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[.04em] text-white">For you</span>}
                    </div>
                    <span className="text-[13px] text-muted">{E.muscles} · {E.equipment} · {E.level}</span>
                    <p className="mt-1 max-w-[560px] text-sm leading-normal text-ink-3 [text-wrap:pretty]">{E.cue}</p>
                  </div>
                  <div className="flex flex-col gap-0.5"><span className="font-mono text-xl">{E.defaults.sets} × {E.defaults.reps}</span><span className="font-mono text-xs text-muted">{E.defaults.load}</span></div>
                  <AddButton added={inDraft(id)} onClick={() => toggle(id)} className="!rounded-[9px] !px-3 !py-2 !text-[13px]" />
                </div>
              );
            })}
          </section>
        </div>
      )}
    </>
  );
}
