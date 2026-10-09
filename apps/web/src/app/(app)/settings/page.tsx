'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { DEVICE_PROVIDERS, SPORTS, SPORT_IDS, type DeviceProvider } from '@tc/core';
import { PageHeader } from '@/components/shell';
import { Check, Switch, cx } from '@/components/ui';
import {
  useAthlete,
  useConnectStrava,
  useDevices,
  useDisconnectStrava,
  useIntegrations,
  useSetSports,
  useShareAccess,
  useSyncStrava,
  useUpdateDevice,
} from '@/lib/queries';
import { useStore } from '@/lib/store';

const OPTIONS = [
  ['importActivities', 'Import completed activities'],
  ['pushWorkouts', 'Send planned workouts to device'],
] as const;

const ago = (iso: string | null) => {
  if (!iso) return 'never';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : min < 1440 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`;
};

export default function SettingsPage() {
  const view = useStore((s) => s.views.settings);
  const flash = useStore((s) => s.flash);
  const { data: athlete } = useAthlete();
  const { data: devices = [] } = useDevices();
  const setSports = useSetSports();
  const updateDevice = useUpdateDevice();
  const [busy, setBusy] = useState<DeviceProvider | null>(null);
  if (!athlete) return null;

  const canEdit = athlete.role !== 'viewer';
  const mySports = setSports.isPending ? setSports.variables : athlete.sports;
  const toggleSport = (k: (typeof SPORT_IDS)[number]) => {
    const next = mySports.includes(k) ? mySports.filter((x) => x !== k) : [...mySports, k];
    if (next.length) setSports.mutate(next, { onError: (e) => flash(`Couldn’t save: ${e.message}`) });
  };

  const rows = DEVICE_PROVIDERS.map((D) => {
    const d = devices.find((x) => x.provider === D.id);
    const on = !!d?.connected, isBusy = busy === D.id;
    return {
      ...D, d, on,
      status: isBusy ? 'Connecting…' : on ? `Connected · synced ${ago(d!.lastSyncAt)}` : 'Not connected',
      dot: on ? 'var(--color-accent)' : isBusy ? 'var(--color-danger)' : 'var(--color-line-strong)',
      btn: isBusy ? 'Connecting…' : on ? 'Disconnect' : 'Connect',
      onConnect: () => {
        if (isBusy || !canEdit) return;
        if (on) {
          updateDevice.mutate({ provider: D.id, connected: false }, { onSuccess: () => flash(`${D.name} disconnected`) });
          return;
        }
        // Simulated OAuth round-trip until real partner API access exists (PLAN.md §8).
        setBusy(D.id);
        setTimeout(() => updateDevice.mutate(
          { provider: D.id, connected: true, importActivities: true, pushWorkouts: true },
          { onSuccess: () => flash(`${D.name} connected`), onSettled: () => setBusy(null) },
        ), 1200);
      },
      toggle: (k: 'importActivities' | 'pushWorkouts') => canEdit && updateDevice.mutate({ provider: D.id, [k]: !d?.[k] }),
    };
  });
  const nConn = rows.filter((r) => r.on).length;
  const btnClass = (on: boolean) => (on ? 'border-line-3 bg-surface text-ink' : 'border-ink bg-ink text-white');

  return (
    <>
      <PageHeader screen="settings" eyebrow={athlete.name} title="Settings" />
      <div className="flex max-w-[1080px] flex-col gap-8">
        <StravaSection canConnect={athlete.role === 'owner'} canSync={canEdit} />

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
                        <button key={k} onClick={() => r.toggle(k)} className="flex items-center justify-between gap-3 text-left text-[13.5px]">
                          <span>{label}</span><Switch on={!!r.d?.[k]} />
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={r.onConnect} disabled={!canEdit} className={`mt-auto rounded-[10px] border p-2.5 text-sm font-semibold disabled:opacity-50 ${btnClass(r.on)}`}>{r.btn}</button>
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
                        <button key={k} onClick={() => r.toggle(k)} className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-[5px] pl-1.5 pr-2.5 text-[12.5px]">
                          <Switch small on={!!r.d?.[k]} />{label}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={r.onConnect} disabled={!canEdit} className={`rounded-[10px] border px-4 py-2 text-[13.5px] font-semibold disabled:opacity-50 ${btnClass(r.on)}`}>{r.btn}</button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[12.5px] text-faint">Direct device connections are simulated for now: they need partner API access from Garmin, Wahoo and COROS. Until then, your watch syncs to Strava and Tempo imports from there.</p>
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
                <button key={k} disabled={!canEdit} onClick={() => toggleSport(k)} className="flex items-start gap-3 rounded-[14px] p-4 text-left disabled:cursor-default" style={{ border: `1.5px solid ${a ? T.color : 'var(--color-line)'}`, background: a ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
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

        {athlete.role === 'owner' && <ShareSection name={athlete.firstName} />}
      </div>
    </>
  );
}

function StravaSection({ canConnect, canSync }: { canConnect: boolean; canSync: boolean }) {
  const { data } = useIntegrations();
  const connect = useConnectStrava();
  const sync = useSyncStrava();
  const disconnect = useDisconnectStrava();
  const flash = useStore((s) => s.flash);
  const st = data?.find((i) => i.provider === 'strava');

  // Coming back from Strava's consent screen: /settings?strava=connected|error&msg=…
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const status = q.get('strava');
    if (!status) return;
    const msg = q.get('msg');
    flash(status === 'connected' ? `Strava connected${msg ? ` · ${msg} activities imported` : ''}` : `Strava: ${msg ?? 'connection failed'}`);
    window.history.replaceState(null, '', window.location.pathname);
  }, [flash]);

  if (!st) return null;
  const onSync = () => sync.mutate(undefined, {
    onSuccess: (r) => flash(r.imported ? `Imported ${r.imported} ${r.imported === 1 ? 'activity' : 'activities'} · ${r.matched} matched to your plan` : 'Up to date: no new activities'),
    onError: (e) => flash(e.message),
  });

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Strava</h2>
        <span className="text-sm text-muted">Import finished runs, rides and workouts. Your watch syncs to Strava, Tempo reads from there. Read-only: nothing is posted to Strava.</span>
      </div>
      <div className="card flex flex-wrap items-center gap-x-5 gap-y-3.5 px-5 py-[18px]" style={st.connected ? { borderColor: 'var(--color-strava-line)' } : undefined}>
        <span className="grid h-10 w-10 flex-none place-items-center rounded-[11px] bg-strava text-[17px] font-bold text-white">S</span>
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-[3px]">
          <span className="text-base font-semibold">{st.connected ? 'Connected to Strava' : 'Strava'}</span>
          <span className="font-mono text-xs text-muted">
            {!st.available ? 'Not set up on this server yet' : st.connected ? `${st.activityCount} activities · synced ${ago(st.lastSyncAt)}` : 'Not connected'}
          </span>
          {st.lastError && <span className="text-[12.5px] text-danger">{st.lastError}</span>}
        </div>
        {st.available && st.connected && (
          <div className="flex flex-wrap gap-2">
            {canSync && (
              <button onClick={onSync} disabled={sync.isPending} className="rounded-[10px] border border-ink bg-ink px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-60">
                {sync.isPending ? 'Syncing…' : 'Sync now'}
              </button>
            )}
            {canConnect && (
              <button
                onClick={() => disconnect.mutate(undefined, { onSuccess: () => flash('Strava disconnected. Imported activities stay in Tempo.') })}
                className="rounded-[10px] border border-line-3 bg-surface px-4 py-2 text-[13.5px] font-semibold"
              >
                Disconnect
              </button>
            )}
          </div>
        )}
        {st.available && !st.connected && canConnect && (
          <button onClick={() => connect.mutate(undefined, { onError: (e) => flash(e.message) })} disabled={connect.isPending} className="rounded-[10px] bg-strava px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-60">
            Connect with Strava
          </button>
        )}
        {!st.available && <p className="basis-full text-[12.5px] text-faint">Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET to the server’s .env (see README) to enable this.</p>}
      </div>
    </section>
  );
}

function ShareSection({ name }: { name: string }) {
  const share = useShareAccess();
  const [role, setRole] = useState<'coach' | 'viewer'>('viewer');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get('email'));
    share.mutate({ email, role }, {
      onSuccess: () => { setMsg({ ok: true, text: `${email} can now ${role === 'coach' ? 'see and edit' : 'see'} ${name}’s plan.` }); form.reset(); },
      onError: (err) => setMsg({ ok: false, text: err.message }),
    });
  }

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Share your plan</h2>
        <span className="text-sm text-muted">Let your partner or coach see your training. They need a Tempo account first, and you’ll appear in their profile switcher.</span>
      </div>
      <form onSubmit={onSubmit} className="card flex flex-wrap items-end gap-3 p-5">
        <label className="flex min-w-[220px] flex-[2_1_220px] flex-col gap-1.5">
          <span className="eyebrow !text-[11px]">Their email</span>
          <input name="email" type="email" required className="field" placeholder="name@example.com" />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow !text-[11px]">Access</span>
          <div className="flex gap-0.5 rounded-[10px] border border-line bg-surface-2 p-[3px]">
            {(['viewer', 'coach'] as const).map((r) => (
              <button type="button" key={r} onClick={() => setRole(r)} className={cx('rounded-[7px] px-3 py-1.5 text-[13px] font-medium', role === r ? 'bg-ink text-white' : 'text-muted')}>
                {r === 'viewer' ? 'Can view' : 'Can edit'}
              </button>
            ))}
          </div>
        </div>
        <button disabled={share.isPending} className="rounded-[10px] bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">Share</button>
        {msg && <p className={cx('basis-full text-sm', msg.ok ? 'text-accent-ink' : 'text-danger')}>{msg.text}</p>}
      </form>
    </section>
  );
}
