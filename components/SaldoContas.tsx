'use client';

import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import loadContasDestaqueAction from '@/actions/loadContasDestaque';

interface ContaDestaque {
  id: number;
  nome: string;
  banco: string;
  numero: string;
  saldo_inicial: number;
  data_saldo_inicial: string;
  saldo_atual: number;
}

export function SaldoContas() {
  const { formatCurrency } = useCurrency();
  const [contasData, contasLoading, contasError] = useLoadAction(loadContasDestaqueAction, []);

  const contas: ContaDestaque[] = contasData || [];

  const totalSaldo = contas.reduce((total, conta) => {
    const saldo = conta.saldo_atual != null ? parseFloat(conta.saldo_atual.toString()) : 0;
    return total + saldo;
  }, 0);

  if (contasLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Saldo Contas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (contasError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Saldo Contas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Erro ao carregar dados das contas.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (contas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Saldo Contas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nenhuma conta marcada como destaque encontrada.
          </p>
          <p className="text-sm text-muted-foreground text-center">
            Marque contas como "destaque" no cadastro para exibi-las aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Saldo Contas
        </CardTitle>
        {contas.length > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted-foreground">Total Geral:</span>
            <span className={`font-bold text-lg ${totalSaldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalSaldo)}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {contas.map((conta) => {
            const saldoAtual = conta.saldo_atual != null ? parseFloat(conta.saldo_atual.toString()) : 0;
            const saldoInicial = conta.saldo_inicial != null ? parseFloat(conta.saldo_inicial.toString()) : 0;
            const variacao = saldoAtual - saldoInicial;
            
            return (
              <div key={conta.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{conta.nome}</span>
                    <Badge variant="outline" className="text-xs">
                      {conta.banco}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Conta: {conta.numero}</span>
                    {variacao !== 0 && (
                      <span className="flex items-center gap-1">
                        {variacao > 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        <span className={`text-xs ${variacao > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {variacao > 0 ? '+' : ''}{formatCurrency(Math.abs(variacao))}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-lg ${saldoAtual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(saldoAtual)}
                  </div>
                  {saldoInicial !== saldoAtual && (
                    <div className="text-xs text-muted-foreground">
                      Base: {formatCurrency(saldoInicial)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
