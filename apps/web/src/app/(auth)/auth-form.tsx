'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/api';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignup = mode === 'signup';

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email'));
    const password = String(f.get('password'));
    setBusy(true);
    setError(null);
    const res = isSignup
      ? await authClient.signUp.email({ email, password, name: String(f.get('name')) })
      : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? 'Something went wrong');
      return;
    }
    qc.clear();
    const next = params.get('next');
    router.replace(next?.startsWith('/') ? next : '/today');
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-[9px] bg-accent text-lg font-bold text-white">T</div>
          <div className="text-2xl font-bold tracking-[-0.02em]">Tempo</div>
        </div>
        <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.03em]">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="mt-1.5 text-[15px] text-muted">{isSignup ? 'Your personal training coach.' : 'Sign in to see today’s training.'}</p>
        <form onSubmit={onSubmit} className="card mt-6 flex flex-col gap-4 !rounded-[18px] p-6">
          {isSignup && (
            <label className="flex flex-col gap-1.5"><span className="eyebrow !text-[11px]">Name</span><input name="name" required autoComplete="name" className="field" /></label>
          )}
          <label className="flex flex-col gap-1.5"><span className="eyebrow !text-[11px]">Email</span><input name="email" type="email" required autoComplete="email" className="field" /></label>
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow !text-[11px]">Password</span>
            <input name="password" type="password" required minLength={isSignup ? 10 : undefined} autoComplete={isSignup ? 'new-password' : 'current-password'} className="field" />
            {isSignup && <span className="text-xs text-faint">At least 10 characters.</span>}
          </label>
          {error && <p role="alert" className="rounded-lg bg-[#FBEDE6] px-3 py-2 text-sm text-danger">{error}</p>}
          <button disabled={busy} className="rounded-[10px] bg-accent px-4 py-3 text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60">
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-muted">
          {isSignup ? 'Already have an account? ' : 'New here? '}
          <Link href={isSignup ? '/login' : '/signup'} className="font-medium">{isSignup ? 'Sign in' : 'Create an account'}</Link>
        </p>
      </div>
    </div>
  );
}
