export default function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <p className="mb-4 rounded-md border border-bordeaux/30 bg-bordeaux/10 px-3 py-2 text-sm text-bordeaux">
      {message}
    </p>
  );
}
