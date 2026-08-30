export default function PageHeader({ eyebrow, title, action }) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <div>
        {eyebrow && <p className="text-xs uppercase tracking-widest text-gold">{eyebrow}</p>}
        <h2 className="mt-1 font-display text-2xl italic text-ink dark:text-parchment">{title}</h2>
        <div className="mt-3 h-px w-16 bg-gold/60" />
      </div>
      {action}
    </div>
  );
}
