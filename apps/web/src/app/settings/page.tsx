'use client';

import { SPORTS, SPORT_IDS } from '@tc/core';
import { PageHeader } from '@/components/shell';
import { Check, Switch } from '@/components/ui';
import { DEVICES, PROFILES } from '@/lib/mock-data';
import { useStore } from '@/lib/store';

const OPTIONS = [
  ['importActivities', 'Import completed activities'],
  ['pushWorkouts', 'Send planned workouts to device'],
] as const;

export default function SettingsPage() {
  const view = useStore((s) => s.views.settings);
  const { pid, sports, devices, toggleSport, setDevice, toggleConnection } = useStore();
  const mySports = sports[pid];
  const myDevices = devices[pid] ?? {};

  const rows = DEVICES.map((D) => {
    const d = myDevices[D.id];
    const on = !!d?.connected, busy = !!d?.busy;
    return {
      ...D, d, on, busy,
      status: busy ? 'Connecting…' : on ? `Connected · synced ${d?.lastSync}` : 'Not connected',
      dot: on ? 'var(--color-accent)' : busy ? 'var(--color-danger)' : 'var(--color-line-strong)',
      btn: busy ? 'Connecting…' : on ? 'Disconnect' : 'Connect',
      onConnect: () => !busy && toggleConnection(D.id),
    };
  });
  const nConn = rows.filter((r) => r.on).length;
  const btnClass = (on: boolean) => (on ? 'border-line-3 bg-surface text-ink' : 'border-ink bg-ink text-white');

  return (
    <>
      <PageHeader screen="settings" eyebrow={PROFILES[pid].name} title="Settings" />
      <div className="flex max-w-[1080px] flex-col gap-8">
        <section className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Devices &amp; apps</h2>
              <span className="text-sm text-muted">Import finished activities and send planned workouts to your watch or bike computer.</span>
            </div>
            <span className="font-mono text-xs text-muted">{nConn ? `${nConn} connected` : 'None connected'}</span>
          </div>

          {view === 'Cards' && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5">
              {rows.map((r) => (
                <div key={r.id} className="flex flex-col gap-4 rounded-2xl bg-surface p-5" style={{ border: `1.5px solid ${r.on ? 'var(--color-accent-border)' : 'var(--color-line)'}` }}>
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-ink text-lg font-bold text-white">{r.name[0]}</span>
                    <div className="flex min-w-0 flex-col gap-0.5"><span className="text-[17px] font-semibold">{r.name}</span><span className="text-[12.5px] text-muted">{r.sub}</span></div>
                  </div>
                  <span className="flex items-center gap-2 font-mono text-xs" style={{ color: r.on ? 'var(--color-accent-ink)' : 'var(--color-muted)' }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: r.dot }} />{r.status}
                  </span>
                  {r.on && (
                    <div className="flex flex-col gap-2.5 border-t border-line pt-3.5">
                      {OPTIONS.map(([k, label]) => (
                        <button key={k} onClick={() => setDevice(r.id, { [k]: !r.d?.[k] })} className="flex items-center justify-between gap-3 text-left text-[13.5px]">
                          <span>{label}</span><Switch on={!!r.d?.[k]} />
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={r.onConnect} className={`mt-auto rounded-[10px] border p-2.5 text-sm font-semibold ${btnClass(r.on)}`}>{r.btn}</button>
                </div>
              ))}
            </div>
          )}

          {view === 'List' && (
            <div className="card overflow-hidden">
              {rows.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-x-5 gap-y-3.5 border-b border-line px-5 py-[18px] last:border-b-0">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-[11px] bg-ink text-[17px] font-bold text-white">{r.name[0]}</span>
                  <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-[3px]">
                    <span className="text-base font-semibold">{r.name}</span>
                    <span className="flex items-center gap-[7px] font-mono text-xs" style={{ color: r.on ? 'var(--color-accent-ink)' : 'var(--color-muted)' }}>
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: r.dot }} />{r.status}
                    </span>
                  </div>
                  {r.on && (
                    <div className="flex flex-wrap gap-2">
                      {OPTIONS.map(([k, label]) => (
                        <button key={k} onClick={() => setDevice(r.id, { [k]: !r.d?.[k] })} className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-[5px] pl-1.5 pr-2.5 text-[12.5px]">
                          <Switch small on={!!r.d?.[k]} />{label}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={r.onConnect} className={`rounded-[10px] border px-4 py-2 text-[13.5px] font-semibold ${btnClass(r.on)}`}>{r.btn}</button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[12.5px] text-faint">Device connections are simulated in this local prototype. Real Garmin, Wahoo and COROS sync needs partner API access (see PLAN.md).</p>
        </section>

        <section className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">My sports</h2>
            <span className="text-sm text-muted">Your coach plans only these. They also set the training types you can pick.</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2.5">
            {SPORT_IDS.map((k) => {
              const T = SPORTS[k], a = mySports.includes(k);
              return (
                <button key={k} onClick={() => toggleSport(k)} className="flex items-start gap-3 rounded-[14px] p-4 text-left" style={{ border: `1.5px solid ${a ? T.color : 'var(--color-line)'}`, background: a ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                  <Check on={a} size={20} color={T.color} />
                  <span className="flex flex-col gap-[3px]">
                    <span className="text-[15px] font-semibold" style={{ color: a ? 'var(--color-ink)' : 'var(--color-muted)' }}>{T.label}</span>
                    <span className="text-[12.5px] text-muted">{T.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
