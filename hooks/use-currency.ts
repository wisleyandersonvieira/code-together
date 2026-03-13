import { useLoadAction } from '@uibakery/data';
import loadParametrosAction from '@/actions/loadParametros';

interface CurrencyConfig {
  symbol: string;
  code: string;
  locale: string;
}

const currencies: Record<string, CurrencyConfig> = {
  BRL: {
    symbol: 'R$',
    code: 'BRL', 
    locale: 'pt-BR'
  },
  USD: {
    symbol: '$',
    code: 'USD',
    locale: 'en-US'
  }
};

export function useCurrency() {
  const [parametros] = useLoadAction(loadParametrosAction, []);
  
  const moedaParam = parametros?.find((p: any) => p.chave === 'MOEDA');
  const currentCurrency = moedaParam?.valor || 'BRL';
  const config = currencies[currentCurrency] || currencies.BRL;
  
  const formatCurrency = (value: number | string | null | undefined): string => {
    const numericValue = typeof value === 'string' ? parseFloat(value) : (value || 0);
    
    if (isNaN(numericValue)) {
      return `${config.symbol} 0,00`;
    }

    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
    }).format(numericValue);
  };

  const parseCurrencyInput = (value: string): number => {
    if (!value) return 0;
    
    // Remove currency symbols and convert comma to dot for parsing
    const cleanValue = value.replace(/[R$\s]/g, '').replace(',', '.');
    const numericValue = parseFloat(cleanValue);
    
    return isNaN(numericValue) ? 0 : numericValue;
  };

  const formatCurrencyInput = (value: string): string => {
    // Remove non-numeric characters except comma and dot
    const cleaned = value.replace(/[^\d,]/g, '');
    
    // Handle decimal formatting for Brazilian currency
    if (config.locale === 'pt-BR') {
      // Add currency symbol
      return cleaned ? `${config.symbol} ${cleaned}` : '';
    }
    
    return cleaned ? `${config.symbol} ${cleaned}` : '';
  };

  return {
    formatCurrency,
    parseCurrencyInput,
    formatCurrencyInput,
    currencySymbol: config.symbol,
    currencyCode: config.code,
    currentCurrency
  };
}
