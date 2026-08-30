export default function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3 sm:px-4">
      <div
        className={`max-h-[90vh] w-full ${wide ? 'max-w-2xl' : 'max-w-md'} overflow-y-auto rounded-lg border border-ink-line/10 bg-parchment p-4 sm:p-6 dark:border-parchment/10 dark:bg-ink-soft`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg italic text-ink dark:text-parchment">{title}</h3>
          <button onClick={onClose} className="text-mist hover:text-gold" aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
