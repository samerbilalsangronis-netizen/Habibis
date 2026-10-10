import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-dvh grid place-items-center p-6 text-center bg-pattern">
      <div>
        <img src="/logo.svg" alt="" className="w-16 h-16 mx-auto rounded-2xl" />
        <h1 className="font-display text-3xl text-gold-300 mt-4">No encontramos esta página</h1>
        <p className="text-sand-400 mt-2">Puede que el enlace esté mal escrito.</p>
        <Link href="/" className="btn-primary mt-6">
          Ir al menú
        </Link>
      </div>
    </div>
  );
}
