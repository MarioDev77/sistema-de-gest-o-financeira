export default function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-mist">{label}</span>
      {children}
    </label>
  );
}

const baseInputClass =
  'w-full rounded-md border border-ink-line/20 bg-parchment px-3 py-2 text-sm text-ink outline-none focus:border-gold dark:border-parchment/20 dark:bg-ink-soft dark:text-parchment';

export function Input(props) {
  return <input {...props} className={`${baseInputClass} ${props.className || ''}`} />;
}

export function Select(props) {
  return <select {...props} className={`${baseInputClass} ${props.className || ''}`} />;
}

export function TextArea(props) {
  return <textarea {...props} className={`${baseInputClass} ${props.className || ''}`} />;
}
