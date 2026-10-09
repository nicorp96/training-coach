'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { authClient } from '@/lib/api';
import { useActiveAthleteId, useMe } from '@/lib/queries';
import { useStore, VIEWS, type Screen } from '@/lib/store';
import { cx } from './ui';

const NAV: { href: `/${Screen}`; label: string; short: string }[] = [
  { href: '/today', label: 'Today', short: 'Today' },
  { href: '/calendar', label: 'Calendar', short: 'Calendar' },
  { href: '/builder', label: 'New training', short: 'New' },
  { href: '/strength', label: 'Strength exercises', short: 'Strength' },
  { href: '/settings', label: 'Settings', short: 'Settings' },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();
  const unauthorized = (me.error as { status?: number } | null)?.status === 401;
  useEffect(() => {
    if (unauthorized) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [unauthorized, router, pathname]);
  // Render screens only once we know who is signed in (also avoids hydration mismatches with persisted UI state).
  const hydrated = !!me.data;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[208px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-8 border-r border-line bg-rail px-3.5 py-6 md:flex">
        <Logo />
        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cx('flex items-center gap-2.5 rounded-[10px] p-2.5 text-[14.5px] font-medium', active ? 'bg-accent-soft text-ink' : 'text-muted hover:text-ink')}
              >
                <span className="h-4 w-[3px] rounded-sm" style={{ background: active ? 'var(--color-accent)' : 'transparent' }} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="relative mt-auto">{hydrated && <ProfileSwitcher />}</div>
      </aside>

      <div className="flex items-center justify-between border-b border-line bg-rail px-4 py-3 md:hidden">
        <Logo />
        {hydrated && <ProfileSwitcher compact />}
      </div>

      <main className="min-w-0 px-4 pb-28 pt-6 md:px-8 md:pb-14 md:pt-7">
        {hydrated ? children : me.isError && !unauthorized ? <LoadError onRetry={() => me.refetch()} /> : <Loading />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-line bg-rail pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((n) => {
          const active = pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={cx('flex flex-col items-center gap-1 py-2.5 text-[11.5px] font-medium', active ? 'text-accent' : 'text-muted')}>
              <span className="h-[3px] w-5 rounded-sm" style={{ background: active ? 'var(--color-accent)' : 'transparent' }} />
              {n.short}
            </Link>
          );
        })}
      </nav>
      {hydrated && <Toast />}
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5 md:px-2.5">
      <div className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-accent text-[15px] font-bold text-white">T</div>
      <div className="text-xl font-bold tracking-[-0.02em]">Tempo</div>
    </div>
  );
}

function Avatar({ initials, color, size }: { initials: string; color: string; size: number }) {
  return (
    <span className="grid flex-none place-items-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

function ProfileSwitcher({ compact }: { compact?: boolean }) {
  const { data: me } = useMe();
  const activeId = useActiveAthleteId();
  const set = useStore((s) => s.set);
  const flash = useStore((s) => s.flash);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!me) return null;
  const P = me.athletes.find((a) => a.id === activeId) ?? me.athletes[0];
  if (!P) return null;
  const signOut = async () => {
    await authClient.signOut();
    set({ athleteId: null });
    router.replace('/login');
  };

  return (
    <div className="relative">
      {open && (
        <div className={cx('absolute z-20 flex flex-col gap-0.5 rounded-[14px] border border-line-2 bg-surface p-1.5 shadow-[0_16px_40px_rgba(30,32,20,.14)]', compact ? 'right-0 top-12 w-64' : 'inset-x-0 bottom-16')}>
          <div className="eyebrow px-2.5 pb-1.5 pt-2 !text-[11px]">Switch profile</div>
          {me.athletes.map((p) => (
            <button
              key={p.id}
              onClick={() => { setOpen(false); if (p.id !== P.id) { set({ athleteId: p.id, selSession: null }); flash(`Switched to ${p.firstName}`); } }}
              className={cx('flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left hover:bg-accent-soft', p.id === P.id && 'bg-accent-soft')}
            >
              <Avatar initials={p.initials} color={p.color} size={30} />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{p.name}</span>
                <span className="text-xs text-muted">{p.goal ?? (p.role === 'owner' ? 'You' : p.role === 'coach' ? 'You coach' : 'Shared with you')}</span>
              </span>
            </button>
          ))}
          <div className="mt-1 border-t border-line pt-1">
            <div className="truncate px-2.5 py-1.5 text-xs text-muted">{me.user.email}</div>
            <button onClick={signOut} className="w-full rounded-[10px] px-2.5 py-2 text-left text-sm text-ink-3 hover:bg-accent-soft">Sign out</button>
          </div>
        </div>
      )}
      {compact ? (
        <button onClick={() => setOpen((o) => !o)} aria-label="Switch profile">
          <Avatar initials={P.initials} color={P.color} size={34} />
        </button>
      ) : (
        <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface p-2.5 text-left hover:border-line-strong">
          <Avatar initials={P.initials} color={P.color} size={34} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium">{P.name}</span>
            <span className="truncate text-xs text-muted">{P.goal ?? me.user.email}</span>
          </span>
          <span className="text-xs text-muted">⇅</span>
        </button>
      )}
    </div>
  );
}

function Loading() {
  return <div className="py-20 text-center font-mono text-xs uppercase tracking-[.08em] text-faint">Loading…</div>;
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="card mx-auto mt-16 flex max-w-md flex-col items-center gap-3 p-8 text-center">
      <h2 className="text-xl font-semibold">Can’t reach the server</h2>
      <p className="text-sm text-muted">Is the API running? Start everything with <code className="font-mono">pnpm dev</code>.</p>
      <button onClick={onRetry} className="rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-white">Try again</button>
    </div>
  );
}

function Toast() {
  const toast = useStore((s) => s.toast);
  const set = useStore((s) => s.set);
  if (!toast) return null;
  return (
    <div role="status" className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-ink py-3 pl-[18px] pr-3.5 text-sm font-medium text-white shadow-[0_16px_40px_rgba(30,32,20,.2)] md:bottom-7">
      <span>{toast.msg}</span>
      {toast.action && (
        <button onClick={() => { toast.onAction?.(); set({ toast: null }); }} className="rounded-lg bg-white px-2.5 py-1.5 text-[13px] font-semibold text-accent">
          {toast.action}
        </button>
      )}
    </div>
  );
}

export function PageHeader<K extends Screen>({ screen, eyebrow, title }: { screen: K; eyebrow: string; title: string }) {
  const view = useStore((s) => s.views[screen]);
  const setView = useStore((s) => s.setView);
  const router = useRouter();

  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0">
        <div className="eyebrow !text-xs">{eyebrow}</div>
        <h1 className="mt-1.5 text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-4xl">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3.5">
        <div className="flex items-center gap-2">
          <span className="eyebrow !text-[11px] !text-faint">Layout</span>
          <div className="flex gap-0.5 rounded-[10px] border border-line bg-surface-2 p-[3px]">
            {VIEWS[screen].map((v) => (
              <button
                key={v}
                onClick={() => setView(screen, v as never)}
                className={cx('rounded-[7px] px-[11px] py-1.5 text-[13px] font-medium', view === v ? 'bg-ink text-white' : 'text-muted hover:text-ink')}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        {screen !== 'builder' && (
          <button onClick={() => router.push('/builder')} className="rounded-[10px] bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
            + New training
          </button>
        )}
      </div>
    </header>
  );
}
