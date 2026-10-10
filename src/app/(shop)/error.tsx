'use client';

export default function ShopError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-dvh grid place-items-center p-6 text-center bg-pattern">
      <div className="card p-6 max-w-sm">
        <img src="/logo.svg" alt="" className="w-16 h-16 mx-auto rounded-2xl" />
        <h1 className="font-display text-2xl text-gold-300 mt-3">Algo salió mal</h1>
        <p className="text-sand-400 mt-2 text-sm">{error.message || 'No pudimos cargar la página.'}</p>
        <button className="btn-primary mt-4 w-full" onClick={reset}>
          Reintentar
        </button>
      </div>
    </div>
  );
}
