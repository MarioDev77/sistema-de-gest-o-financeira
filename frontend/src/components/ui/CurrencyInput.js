'use client';

import { useState, useEffect, useRef } from 'react';

const baseInputClass =
  'w-full rounded-md border border-ink-line/20 bg-parchment px-3 py-2 text-sm text-ink outline-none focus:border-gold dark:border-parchment/20 dark:bg-ink-soft dark:text-parchment';

function centsToDisplay(cents) {
  const value = cents / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Input de dinheiro com máscara "de trás pra frente", como maquininha/apps
 * bancários: cada dígito digitado entra nas casas de centavos e empurra o
 * resto para a esquerda, já formatado como Real (R$ 1.000,00, R$ 1.000.000,00,
 * R$ 1.000.000.000,00...). Não precisa digitar ponto nem vírgula.
 *
 * `value` é o valor em reais (número), igual ao resto do form. `onValueChange`
 * recebe o novo valor em reais (número) toda vez que muda.
 */
export default function CurrencyInput({ value, onValueChange, className, placeholder, disabled, required }) {
  const [cents, setCents] = useState(() => Math.round(Number(value || 0) * 100));
  const lastEmitted = useRef(Number(value || 0));

  // Mantém sincronizado se o valor mudar por fora (ex: abrir modal de edição
  // com um empréstimo já existente).
  useEffect(() => {
    const incomingCents = Math.round(Number(value || 0) * 100);
    if (incomingCents !== cents && Number(value || 0) !== lastEmitted.current) {
      setCents(incomingCents);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(e) {
    const digitsOnly = e.target.value.replace(/\D/g, '');
    const nextCents = digitsOnly === '' ? 0 : Number(digitsOnly);
    // Trava em 999.999.999.999,99 (quase 1 trilhão) só pra evitar overflow.
    const clamped = Math.min(nextCents, 99999999999999);
    setCents(clamped);
    const reais = clamped / 100;
    lastEmitted.current = reais;
    onValueChange(reais);
  }

  function handleKeyDown(e) {
    // Backspace some com o último dígito, igual a um input de dinheiro normal.
    if (e.key === 'Backspace') {
      e.preventDefault();
      const nextCents = Math.floor(cents / 10);
      setCents(nextCents);
      const reais = nextCents / 100;
      lastEmitted.current = reais;
      onValueChange(reais);
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={centsToDisplay(cents)}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={`figures ${baseInputClass} ${className || ''}`}
    />
  );
}
