import { action } from '@uibakery/data';

/**
 * Cria uma TIPOLOGIA. Os valores gravados são POR UNIDADE; o total sai do motor.
 *
 * `aporte_base` não é mais escrita: virou premissa do projeto em
 * modelagem_aportes (migration 1761000000). A coluna segue no banco, deprecada,
 * e o DEFAULT 0 dela cobre as linhas novas.
 */
function createModelagemUnidade() {
  return action('createModelagemUnidade', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_unidades (
        modelagem_id, ordem, nome, cidade, quantidade, area_sf, custo_terreno,
        custo_obra, preco_venda, property_tax_ano, observacoes
      ) VALUES (
        {{params.modelagemId}}::int,
        COALESCE({{params.ordem}}::int, 0),
        '{{params.nome}}',
        '{{params.cidade}}',
        GREATEST(1, COALESCE({{params.quantidade}}::int, 1)),
        COALESCE({{params.areaSf}}::decimal, 0),
        COALESCE({{params.custoTerreno}}::decimal, 0),
        COALESCE({{params.custoObra}}::decimal, 0),
        COALESCE({{params.precoVenda}}::decimal, 0),
        COALESCE({{params.propertyTaxAno}}::decimal, 0),
        '{{params.observacoes}}'
      ) RETURNING id
    `,
  });
}

export default createModelagemUnidade;
