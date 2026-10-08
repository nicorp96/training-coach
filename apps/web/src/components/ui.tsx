'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { SessionSource } from '@tc/core';
import { SOURCES, sourceLong } from '@/lib/sessions';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="inline-block flex-none rounded-full" style={{ width: size, height: size, background: color }} />;
}

export function Check({ on, size = 22, color = '#5C6B24' }: { on: boolean; size?: number; color?: string }) {
  return (
    <span
      aria-hidden
      className="grid flex-none place-items-center rounded-md text-[13px] font-bold text-white"
      style={{ width: size, height: size, border: `1.5px solid ${on ? color : 'var(--color-check)'}`, background: on ? color : 'transparent' }}
    >
      {on ? '✓' : ''}
    </span>
  );
}

export function SourceBadge({ source, repeatedFrom, long, className }: { source: SessionSource; repeatedFrom?: string | null; long?: boolean; className?: string }) {
  const s = SOURCES[source];
  return (
    <span className={cx('rounded-[5px] px-1.5 py-0.5 font-mono text-[10.5px]', className)} style={{ background: s.bg, color: s.color }}>
      {long ? sourceLong({ source, repeatedFrom }) : s.label}
    </span>
  );
}

export function CompleteButton({ complete, onClick, small }: { complete: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'rounded-[10px] border border-accent font-semibold transition-colors',
        small ? 'px-3.5 py-[9px] text-[13.5px]' : 'px-4 py-2.5 text-sm',
        complete ? 'bg-transparent text-accent' : 'bg-accent text-white hover:bg-accent-hover',
      )}
    >
      {complete ? 'Completed ✓' : 'Mark as complete'}
    </button>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-line">
      <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Pill-shaped filter chip (dark when active). */
export function Chip({ active, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      {...rest}
      className={cx(
        'flex items-center gap-[7px] rounded-full border px-[11px] py-[5px] text-[12.5px] transition-colors',
        active ? 'border-ink bg-ink text-white' : 'border-line-3 bg-transparent text-ink-3 hover:border-line-strong',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function AddButton({ added, onClick, className }: { added: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium',
        added ? 'border-accent bg-accent text-white' : 'border-line-strong bg-transparent text-ink hover:border-accent',
        className,
      )}
    >
      {added ? 'Added ✓' : '+ Add'}
    </button>
  );
}

export function Switch({ on, small }: { on: boolean; small?: boolean }) {
  const w = small ? 28 : 36, h = small ? 16 : 20, k = small ? 12 : 16;
  return (
    <span className="relative flex-none rounded-full transition-colors" style={{ width: w, height: h, background: on ? 'var(--color-accent)' : 'var(--color-line-3)' }}>
      <span className="absolute top-0.5 rounded-full bg-white transition-[left]" style={{ width: k, height: k, left: on ? w - k - 2 : 2 }} />
    </span>
  );
}

export function Eyebrow({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <span className={cx('eyebrow', className)} style={style}>{children}</span>;
}
