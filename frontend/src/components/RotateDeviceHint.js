'use client';

import { useState } from 'react';

// Aparece só em telas na faixa típica de tablet (largura entre 640px e
// 1024px, aprox. iPad mini até iPad padrão) quando estão em modo retrato.
// Fora dessa faixa (celular ou desktop) e em modo paisagem, fica sempre
// escondido — controlado só por CSS (media queries de orientação/largura
// do Tailwind), sem depender de detecção de user-agent.
export default function RotateDeviceHint() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="fixed inset-0 z-[200] hidden flex-col items-center justify-center gap-5 bg-ink px-8 text-center text-parchment portrait:min-[640px]:max-[1024px]:flex">
      <svg viewBox="0 0 24 24" className="h-16 w-16 animate-pulse text-gold" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M9 20h6" strokeLinecap="round" />
        <path d="M19 9l2.5 2.5L19 14" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 9L2.5 11.5 5 14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>
        <p className="font-display text-xl italic">Gire seu tablet</p>
        <p className="mt-2 max-w-xs text-sm text-parchment/70">
          Este sistema funciona melhor no modo paisagem (horizontal) em tablets.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="rounded-full border border-parchment/30 px-4 py-2 text-xs text-parchment/80 hover:bg-parchment/10"
      >
        Continuar mesmo assim
      </button>
    </div>
  );
}
