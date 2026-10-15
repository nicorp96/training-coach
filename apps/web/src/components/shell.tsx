'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { authClient } from '@/lib/api';
import { useActiveAthleteId, useMe } from '@/lib/queries';
import { useStore, VIEWS, type Screen } from '@/lib/store';
import { cx } from './ui';

const NAV: { href: `/${Screen}`; label: string; short: string; icon: IconName }[] = [
  { href: '/today', label: 'Today', short: 'Today', icon: 'today' },
  { href: '/calendar', label: 'Calendar', short: 'Calendar', icon: 'calendar' },
  { href: '/builder', label: 'New training', short: 'New', icon: 'plus' },
  { href: '/strength', label: 'Strength exercises', short: 'Strength', icon: 'strength' },
  { href: '/profile', label: 'Profile & zones', short: 'Profile', icon: 'profile' },
  { href: '/settings', label: 'Settings', short: 'Settings', icon: 'settings' },
];
// Phone tab bar: five targets; Settings sits behind the gear in the top bar.
const TABS = NAV.filter((n) => n.href !== '/settings');

type IconName = 'today' | 'calendar' | 'plus' | 'strength' | 'profile' | 'settings';
const ICON_PATHS: Record<IconName, string> = {
  today: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  calendar: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4',
  plus: 'M12 5v14M5 12h14',
  strength: 'M3 9.5v5M6 7v10M18 7v10M21 9.5v5M6 12h12',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};

function Icon({ name, size = 22, stroke = 1.8 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

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

      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-rail/95 px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+10px)] backdrop-blur md:hidden">
        <Logo />
        <div className="flex items-center gap-1.5">
          <Link
            href="/settings"
            aria-label="Settings"
            className={cx('grid h-10 w-10 place-items-center rounded-full', pathname.startsWith('/settings') ? 'bg-accent-soft text-accent' : 'text-muted')}
          >
            <Icon name="settings" size={21} />
          </Link>
          {hydrated && <ProfileSwitcher compact />}
        </div>
      </div>

      <main className="min-w-0 px-4 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-5 md:px-8 md:pb-14 md:pt-7">
        {hydrated ? children : me.isError && !unauthorized ? <LoadError onRetry={() => me.refetch()} /> : <Loading />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-rail/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {TABS.map((n) => {
          const active = pathname.startsWith(n.href);
          if (n.icon === 'plus') {
            return (
              <Link key={n.href} href={n.href} aria-label={n.label} className="flex flex-col items-center justify-center gap-1 py-1.5">
                <span className={cx('grid h-11 w-11 place-items-center rounded-full text-white shadow-[0_4px_12px_rgba(92,107,36,.35)]', active ? 'bg-accent-ink' : 'bg-accent')}>
                  <Icon name="plus" size={22} stroke={2.4} />
                </span>
              </Link>
            );
          }
          return (
            <Link key={n.href} href={n.href} className={cx('flex flex-col items-center gap-[3px] pb-1.5 pt-2 text-[10.5px] font-medium', active ? 'text-accent' : 'text-muted')}>
              <Icon name={n.icon} size={23} stroke={active ? 2.1 : 1.7} />
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
      {open && <button aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />}
      {open && (
        <div className={cx('absolute z-20 flex flex-col gap-0.5 rounded-[14px] border border-line-2 bg-surface p-1.5 shadow-[0_16px_40px_rgba(30,32,20,.14)]', compact ? 'right-0 top-12 w-[min(18rem,calc(100vw-2rem))]' : 'inset-x-0 bottom-16')}>
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
            <Link href="/settings" onClick={() => setOpen(false)} className="block w-full rounded-[10px] px-2.5 py-2 text-left text-sm text-ink-3 hover:bg-accent-soft">Settings</Link>
            <button onClick={signOut} className="w-full rounded-[10px] px-2.5 py-2 text-left text-sm text-ink-3 hover:bg-accent-soft">Sign out</button>
          </div>
        </div>
      )}
      {compact ? (
        <button onClick={() => setOpen((o) => !o)} aria-label="Switch profile" className="grid h-10 w-10 place-items-center">
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
    <div role="status" className="fixed bottom-[calc(env(safe-area-inset-bottom)+84px)] left-1/2 z-30 max-w-[calc(100vw-2rem)] flex -translate-x-1/2 items-center gap-4 rounded-xl bg-ink py-3 pl-[18px] pr-3.5 text-sm font-medium text-white shadow-[0_16px_40px_rgba(30,32,20,.2)] md:bottom-7">
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
    <header className="mb-5 flex flex-wrap items-end justify-between gap-x-5 gap-y-3.5 md:mb-7">
      <div className="min-w-0">
        <div className="eyebrow !text-xs">{eyebrow}</div>
        <h1 className="mt-1.5 text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-4xl">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3.5">
        <div className="flex items-center gap-2">
          <span className="eyebrow hidden !text-[11px] !text-faint md:inline">Layout</span>
          <div className="flex gap-0.5 rounded-[10px] border border-line bg-surface-2 p-[3px]">
            {VIEWS[screen].map((v) => (
              <button
                key={v}
                onClick={() => setView(screen, v as never)}
                className={cx('rounded-[7px] px-3 py-2 text-[13px] font-medium md:px-[11px] md:py-1.5', view === v ? 'bg-ink text-white' : 'text-muted hover:text-ink')}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        {screen !== 'builder' && (
          <button onClick={() => router.push('/builder')} className="hidden rounded-[10px] bg-accent md:block px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
            + New training
          </button>
        )}
      </div>
    </header>
  );
}
