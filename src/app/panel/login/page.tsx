'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get('error') === 'sin-acceso' ? 'Tu usuario no tiene acceso al panel o está desactivado.' : null,
  );

  useEffect(() => {
    // Usuario sin perfil de personal: cerrar sesión para poder entrar con otra cuenta
    if (params.get('error')) supabaseBrowser().auth.signOut();
  }, [params]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setError(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message);
      return;
    }
    const next = params.get('next');
    router.replace(next && next.startsWith('/panel') && next !== '/panel/login' ? next : '/panel');
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
      <div className="text-center">
        <img src="/icons/panel-192.png" alt="" className="w-16 h-16 mx-auto rounded-2xl" />
        <h1 className="font-display text-2xl text-gold-300 mt-3">Panel Habibis</h1>
        <p className="text-sm text-sand-400">Entra con tu correo y contraseña</p>
      </div>
      <div>
        <label className="label" htmlFor="email">
          Correo
        </label>
        <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-terra-400">{error}</p>}
      <button className="btn-primary w-full text-base" disabled={busy}>
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
      <p className="text-xs text-center text-sand-500">¿Olvidaste la contraseña? Pídele al administrador que la cambie.</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-dvh grid place-items-center p-4 bg-pattern">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
