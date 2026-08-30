'use client';

import { useState } from 'react';

/**
 * Abas simples para uso dentro de modais de detalhe.
 * Uso:
 *   <Tabs tabs={[{ key: 'parcelas', label: 'Parcelas' }, { key: 'recebido', label: 'Recebido' }]}>
 *     {(active) => active === 'parcelas' ? <ParcelasView /> : <RecebidoView />}
 *   </Tabs>
 */
export default function Tabs({ tabs, defaultTab, children }) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.key);

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-ink-line/10 dark:border-parchment/10">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              active === tab.key
                ? 'border-gold text-gold'
                : 'border-transparent text-mist hover:text-ink dark:hover:text-parchment'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{children(active)}</div>
    </div>
  );
}
