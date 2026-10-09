'use client';

import { useState, type FormEvent } from 'react';
import {
  SPORTS,
  THRESHOLD_INFO,
  THRESHOLD_METRICS,
  displayThreshold,
  parsePace,
  shortDate,
  speedFromPace,
  type AthleteDto,
  type ThresholdMetric,
  type Thresholds,
} from '@tc/core';
import { formatZone, wattsPerKg, zonesFor, type Zone, type ZoneKind } from '@tc/engine';
import { PageHeader } from '@/components/shell';
import { cx } from '@/components/ui';
import { useAthlete, useThresholdHistory, useUpdateProfile } from '@/lib/queries';
import { useStore } from '@/lib/store';

const GROUPS: { title: string; metrics: ThresholdMetric[] }[] = [
  { title: 'Running', metrics: ['thresholdSpeed'] },
  { title: 'Cycling', metrics: ['ftp'] },
  { title: 'Heart rate', metrics: ['lthr', 'maxHr', 'restingHr'] },
  { title: 'Body', metrics: ['weight'] },
];

export default function ProfilePage() {
  const { data: athlete } = useAthlete();
  if (!athlete) return null;
  // Re-mount the form when switching profiles so it starts from that athlete's values.
  return <Profile key={athlete.id} athlete={athlete} />;
}

type FormState = { name: string; goal: string; goalDate: string } & Record<ThresholdMetric, string>;

const toForm = (a: AthleteDto): FormState => ({
  name: a.name,
  goal: a.goal ?? '',
  goalDate: a.goalDate ?? '',
  ...(Object.fromEntries(THRESHOLD_METRICS.map((m) => [m, displayThreshold(m, a.thresholds[m])])) as Record<ThresholdMetric, string>),
});

/** Parses one threshold field into SI units. `undefined` = invalid input. */
function parseThreshold(m: ThresholdMetric, text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  const v = m === 'thresholdSpeed' ? (parsePace(t) === null ? NaN : speedFromPace(parsePace(t)!)) : Number(t.replace(',', '.'));
  const { min, max } = THRESHOLD_INFO[m];
  return Number.isFinite(v) && v >= min - 1e-9 && v <= max + 1e-9 ? v : undefined;
}

function Profile({ athlete }: { athlete: AthleteDto }) {
  const flash = useStore((s) => s.flash);
  const update = useUpdateProfile();
  const [form, setForm] = useState(() => toForm(athlete));
  const canEdit = athlete.role !== 'viewer';

  const parsed = Object.fromEntries(THRESHOLD_METRICS.map((m) => [m, parseThreshold(m, form[m])])) as Record<ThresholdMetric, number | null | undefined>;
  const invalid = THRESHOLD_METRICS.filter((m) => parsed[m] === undefined);
  // Preview zones live from what's typed; fall back to saved values while a field is invalid.
  const preview = Object.fromEntries(THRESHOLD_METRICS.map((m) => [m, parsed[m] === undefined ? athlete.thresholds[m] : parsed[m]])) as Thresholds;
  const initial = toForm(athlete);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (invalid.length || !form.name.trim()) return;
    update.mutate(
      {
        name: form.name.trim(),
        goal: form.goal.trim() || null,
        goalDate: form.goalDate || null,
        // Only send what was edited, so unchanged values don't start a new history entry.
        thresholds: Object.fromEntries(THRESHOLD_METRICS.filter((m) => form[m] !== initial[m]).map((m) => [m, parsed[m]])),
      },
      {
        onSuccess: (a) => { setForm(toForm(a)); flash('Profile saved'); },
        onError: (err) => flash(`Couldn’t save: ${err.message}`),
      },
    );
  }

  const set = (k: keyof FormState) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHeader screen="profile" eyebrow={athlete.name} title="Profile & zones" />
      <form onSubmit={onSubmit} className="flex max-w-[1080px] flex-col gap-8">
        <section className="flex flex-col gap-3.5">
          <SectionTitle title="About" sub="Your name and the event you are training for." />
          <div className="card grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 p-5">
            <Field label="Name"><input className="field" required maxLength={80} disabled={!canEdit} value={form.name} onChange={set('name')} /></Field>
            <Field label="Goal"><input className="field" maxLength={120} disabled={!canEdit} placeholder="e.g. Hamburg Half Marathon" value={form.goal} onChange={set('goal')} /></Field>
            <Field label="Goal date"><input className="field" type="date" disabled={!canEdit} value={form.goalDate} onChange={set('goalDate')} /></Field>
          </div>
        </section>

        <section className="flex flex-col gap-3.5">
          <SectionTitle title="Thresholds" sub="Your zones are calculated from these. Update them after a test or a race; old values are kept in the history." />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] items-start gap-3.5">
            {GROUPS.map((g) => (
              <div key={g.title} className="card flex flex-col gap-3.5 p-5">
                <span className="text-[15px] font-semibold">{g.title}</span>
                {g.metrics.map((m) => {
                  const I = THRESHOLD_INFO[m], since = athlete.thresholdsSince[m];
                  return (
                    <label key={m} className="flex flex-col gap-1.5">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="eyebrow !text-[11px]">{I.label}</span>
                        {since && athlete.thresholds[m] !== null && <span className="font-mono text-[10.5px] text-faint">since {shortDate(since)}</span>}
                      </span>
                      <span className="relative">
                        <input
                          className={cx('field w-full !pr-12 font-mono', parsed[m] === undefined && '!border-danger')}
                          inputMode={m === 'thresholdSpeed' ? 'text' : 'decimal'}
                          placeholder={m === 'thresholdSpeed' ? '5:00' : '—'}
                          disabled={!canEdit}
                          value={form[m]}
                          onChange={set(m)}
                          aria-invalid={parsed[m] === undefined}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-faint">{I.unit}</span>
                      </span>
                      <span className={cx('text-[12px]', parsed[m] === undefined ? 'text-danger' : 'text-muted')}>
                        {parsed[m] === undefined ? `Enter ${m === 'thresholdSpeed' ? 'a pace like 5:00' : `${Math.round(I.min)}–${Math.round(I.max)} ${I.unit}`}` : I.hint}
                      </span>
                    </label>
                  );
                })}
                {g.metrics.includes('ftp') && wattsPerKg(preview) && <span className="font-mono text-xs text-accent-ink">{wattsPerKg(preview)} W/kg</span>}
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-3">
              <button disabled={!dirty || !!invalid.length || update.isPending} className="rounded-[10px] bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
                {update.isPending ? 'Saving…' : 'Save profile'}
              </button>
              {dirty && <button type="button" onClick={() => setForm(initial)} className="text-sm text-muted hover:text-ink">Discard changes</button>}
            </div>
          )}
        </section>

        <ZonesSection athlete={athlete} thresholds={preview} />
        <HistorySection />
      </form>
    </>
  );
}

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h2>
      <span className="text-sm text-muted">{sub}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5"><span className="eyebrow !text-[11px]">{label}</span>{children}</label>;
}

type ZoneCard = { kind: ZoneKind; title: string; color: string; zones: Zone[] | null; basis?: string; empty: string };

function ZonesSection({ athlete, thresholds }: { athlete: AthleteDto; thresholds: Thresholds }) {
  const view = useStore((s) => s.views.profile);
  const z = zonesFor(thresholds);
  const byKind = { pace: z.pace, power: z.power };
  // Sport-specific zones come from the sport registry (zoneKind), plus heart rate for everyone.
  const cards: ZoneCard[] = [
    ...athlete.sports.flatMap((id) => {
      const S = SPORTS[id];
      if (!S.zoneKind) return [];
      return [{
        kind: S.zoneKind, title: `${S.label} · ${S.zoneKind === 'pace' ? 'pace' : 'power'}`, color: S.color, zones: byKind[S.zoneKind],
        empty: S.zoneKind === 'pace' ? 'Add your threshold pace to see these zones.' : 'Add your FTP to see these zones.',
      }];
    }),
    {
      kind: 'hr', title: 'Heart rate', color: 'var(--color-hr)', zones: z.hr?.zones ?? null,
      basis: z.hr ? (z.hr.basis === 'lthr' ? 'Based on threshold HR' : 'Based on max HR. Add threshold HR for more accurate zones.') : undefined,
      empty: 'Add your threshold or max heart rate to see these zones.',
    },
  ];

  return (
    <section className="flex flex-col gap-3.5">
      <SectionTitle title="Training zones" sub="Use these as targets when you plan a run or ride." />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3.5">
        {cards.map((c) => (
          <div key={c.kind} className="card flex flex-col gap-3.5 p-5">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
              <span className="text-[15px] font-semibold">{c.title}</span>
            </div>
            {!c.zones ? (
              <p className="text-sm text-muted">{c.empty}</p>
            ) : view === 'Bars' ? (
              <div className="flex flex-col gap-2">
                {c.zones.map((zone, i) => (
                  <div key={zone.id} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                      <span><span className="font-mono text-xs text-muted">{zone.id}</span> <span className="font-medium">{zone.name}</span></span>
                      <span className="whitespace-nowrap font-mono text-[12.5px]">{formatZone(zone, c.kind)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${((i + 1) / c.zones!.length) * 100}%`, background: `color-mix(in oklch, ${c.color} ${25 + (75 * i) / (c.zones!.length - 1)}%, #FFFFFF)` }}
                      />
                    </div>
                    <span className="text-[12px] text-muted">{zone.purpose}</span>
                  </div>
                ))}
              </div>
            ) : (
              <table className="w-full text-[13.5px]">
                <tbody>
                  {c.zones.map((zone) => (
                    <tr key={zone.id} className="border-b border-line last:border-b-0">
                      <td className="py-1.5 pr-2 font-mono text-xs text-muted">{zone.id}</td>
                      <td className="py-1.5 pr-2">{zone.name}</td>
                      <td className="py-1.5 text-right font-mono text-[12.5px]">{formatZone(zone, c.kind)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {c.basis && <span className="text-[12px] text-faint">{c.basis}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function HistorySection() {
  const { data: history = [] } = useThresholdHistory();
  if (!history.length) return null;
  const byDate = new Map<string, typeof history>();
  for (const h of history) byDate.set(h.validFrom, [...(byDate.get(h.validFrom) ?? []), h]);

  return (
    <section className="flex flex-col gap-3.5">
      <SectionTitle title="History" sub="Every threshold change, newest first." />
      <div className="card overflow-hidden">
        {[...byDate].map(([date, rows]) => (
          <div key={date} className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 border-b border-line px-5 py-3.5 last:border-b-0">
            <span className="w-24 flex-none font-mono text-xs text-muted">{shortDate(date)}</span>
            <span className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]">
              {rows.map((r) => (
                <span key={r.metric}>
                  <span className="text-muted">{THRESHOLD_INFO[r.metric].label}</span>{' '}
                  <span className="font-mono">{r.value === null ? 'cleared' : `${displayThreshold(r.metric, r.value)} ${THRESHOLD_INFO[r.metric].unit}`}</span>
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
