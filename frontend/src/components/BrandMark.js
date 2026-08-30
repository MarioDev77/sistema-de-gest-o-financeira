// Glifo minimalista: silhueta de frasco de perfume reduzida a duas curvas —
// o elemento de assinatura visual do sistema, usado sempre em tom dourado.
export default function BrandMark({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M13 4h6" strokeLinecap="round" />
      <path d="M14 4v4.2c0 .9-.4 1.7-1.1 2.3C11 12.2 9.5 14.8 9.5 18.5 9.5 24 12.3 27.5 16 27.5S22.5 24 22.5 18.5c0-3.7-1.5-6.3-3.4-8-.7-.6-1.1-1.4-1.1-2.3V4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 17.5h11" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
