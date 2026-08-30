export default function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-gold text-ink hover:bg-gold-soft',
    ghost: 'border border-ink-line/20 text-ink hover:border-gold hover:text-gold dark:border-parchment/20 dark:text-parchment',
    danger: 'border border-bordeaux/40 text-bordeaux hover:bg-bordeaux/10',
  };
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
