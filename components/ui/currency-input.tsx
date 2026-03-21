'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { useCurrency } from '@/hooks/use-currency';

interface CurrencyInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> {
  value: number;
  onValueChange: (value: number) => void;
}

export function CurrencyInput({ value, onValueChange, ...props }: CurrencyInputProps) {
  const { currentCurrency } = useCurrency();
  const locale = currentCurrency === 'USD' ? 'en-US' : 'pt-BR';
  const currency = currentCurrency === 'USD' ? 'USD' : 'BRL';

  const formatValue = React.useCallback(
    (rawValue: number) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
      }).format(Number.isFinite(rawValue) ? rawValue : 0),
    [currency, locale],
  );

  const [displayValue, setDisplayValue] = React.useState(() => formatValue(value));

  React.useEffect(() => {
    setDisplayValue(formatValue(value));
  }, [formatValue, value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const numeric = event.target.value.replace(/\D/g, '');
    const parsed = Number(numeric || 0) / 100;
    onValueChange(parsed);
    setDisplayValue(formatValue(parsed));
  };

  return <Input inputMode="numeric" value={displayValue} onChange={handleChange} {...props} />;
}
