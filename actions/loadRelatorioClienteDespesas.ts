import { action } from '@uibakery/data';

function loadRelatorioClienteDespesas() {
  return action('loadRelatorioClienteDespesas', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT DISTINCT
        tp.data_vencimento,
        tp.data_pagamento,
        f.name as fornecedor_nome,
        p.name as projeto_nome,
        tp.valor,
        c.nome as conta_nome,
        tp.parcela,
        tp.total_parcelas,
        tp.status,
        CASE 
          WHEN tp.status = 'PAGO' THEN 'Quitada'
          ELSE 'Pendente'
        END as situacao_pagamento,
        cp.numero_documento,
        tp.id as titulo_id
      FROM titulos_pagar tp
      INNER JOIN contas_pagar cp ON tp.conta_pagar_id = cp.id
      INNER JOIN fornecedores f ON cp.fornecedor_id = f.id
      LEFT JOIN contas_pagar_projetos cpp ON cp.id = cpp.conta_pagar_id
      LEFT JOIN projetos p ON cpp.projeto_id = p.id
      LEFT JOIN contas c ON tp.conta_id = c.id
      WHERE 
        ({{params.projetoId}} IS NULL OR p.id = {{params.projetoId}})
        AND ({{params.contaId}} IS NULL OR tp.conta_id = {{params.contaId}})
        AND ({{params.situacaoPagamento}} IS NULL OR 
             ({{params.situacaoPagamento}} = 'quitado' AND tp.status = 'PAGO') OR
             ({{params.situacaoPagamento}} = 'pendente' AND tp.status != 'PAGO'))
        {{ params.dataVencimentoInicio ? "AND tp.data_vencimento >= '" + params.dataVencimentoInicio + "'::date" : "" }}
        {{ params.dataVencimentoFim ? "AND tp.data_vencimento <= '" + params.dataVencimentoFim + "'::date" : "" }}
        {{ params.dataPagamentoInicio ? "AND tp.data_pagamento >= '" + params.dataPagamentoInicio + "'::date" : "" }}
        {{ params.dataPagamentoFim ? "AND tp.data_pagamento <= '" + params.dataPagamentoFim + "'::date" : "" }}
      ORDER BY tp.data_vencimento DESC, p.name;
    `,
  });
}

export default loadRelatorioClienteDespesas;
