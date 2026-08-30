export default function Table({ columns, rows, keyField = 'id', emptyLabel = 'Nada por aqui ainda.' }) {
  if (!rows || rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-ink-line/20 p-8 text-center text-sm text-mist dark:border-parchment/20">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-ink-line/10 dark:border-parchment/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-line/10 bg-parchment-soft text-left text-xs uppercase tracking-wide text-mist dark:border-parchment/10 dark:bg-ink">
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 font-medium ${col.align === 'right' ? 'text-right' : ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[keyField]} className="border-b border-ink-line/5 last:border-0 dark:border-parchment/5">
              {columns.map((col) => (
                <td key={col.key} className={`figures px-4 py-3 text-ink dark:text-parchment ${col.align === 'right' ? 'text-right' : ''}`}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
