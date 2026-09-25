'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions';
import { Button, inputCls } from '@/components/ui';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <input type="hidden" name="next" value={next} />
      <input name="password" type="password" required autoFocus placeholder="Senha" className={inputCls} autoComplete="current-password" />
      {state?.error && <p className="text-xs text-bad">{state.error}</p>}
      <Button disabled={pending} className="w-full">{pending ? 'Entrando…' : 'Entrar'}</Button>
    </form>
  );
}
