import Image from 'next/image';

/** Foto del producto o, si no hay, un mosaico árabe con la inicial. */
export default function ProductImage({
  src,
  alt,
  sizes = '(max-width: 640px) 112px, 240px',
  className = '',
  priority = false,
}: {
  src: string | null;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  if (src) {
    return (
      <div className={`relative overflow-hidden bg-ink-800 ${className}`}>
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" priority={priority} loading={priority ? undefined : 'lazy'} />
      </div>
    );
  }
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-terra-600/70 via-ink-800 to-ink-900 grid place-items-center pattern-faint ${className}`}
      aria-label={alt}
    >
      <span className="font-display text-3xl text-gold-300/90 drop-shadow">{alt.trim().charAt(0).toUpperCase()}</span>
    </div>
  );
}
