'use client';

import { IconInstagram, IconWhatsApp } from '@/components/ui/Icons';
import { waDigits } from '@/lib/phone';

export default function FloatingSocial({
  whatsapp,
  instagram,
  raised = false,
}: {
  whatsapp: string;
  instagram: string | null;
  raised?: boolean;
}) {
  const ig = (instagram || '').replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
  return (
    <div className={`fixed right-4 z-20 flex flex-col gap-3 transition-all ${raised ? 'bottom-24' : 'bottom-6'}`}>
      {ig && (
        <a
          href={`https://instagram.com/${ig}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="grid place-items-center w-12 h-12 rounded-full text-white shadow-lg bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600"
        >
          <IconInstagram className="w-6 h-6" />
        </a>
      )}
      {whatsapp && (
        <a
          href={`https://wa.me/${waDigits(whatsapp)}?text=${encodeURIComponent('¡Hola Habibis! 👋')}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
          className="grid place-items-center w-12 h-12 rounded-full text-white shadow-lg bg-[#25D366]"
        >
          <IconWhatsApp className="w-6 h-6" />
        </a>
      )}
    </div>
  );
}
