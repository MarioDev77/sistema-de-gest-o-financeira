export default function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-ink-line/10 bg-parchment-soft p-5 dark:border-parchment/10 dark:bg-ink-soft">
      <p className="text-xs uppercase tracking-wide text-mist">{label}</p>
      <p className="figures mt-2 font-display text-2xl text-ink dark:text-parchment">{value}</p>
      {hint && <p className="mt-1 text-xs text-mist">{hint}</p>}
    </div>
  );
}
