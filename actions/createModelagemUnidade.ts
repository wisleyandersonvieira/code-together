import { action } from '@uibakery/data';

function createModelagemUnidade() {
  return action('createModelagemUnidade', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_unidades (
        modelagem_id, ordem, nome, cidade, area_sf, custo_terreno, custo_obra,
        aporte_base, preco_venda, property_tax_ano, observacoes
      ) VALUES (
        {{params.modelagemId}}::int,
        COALESCE({{params.ordem}}::int, 0),
        '{{params.nome}}',
        '{{params.cidade}}',
        COALESCE({{params.areaSf}}::decimal, 0),
        COALESCE({{params.custoTerreno}}::decimal, 0),
        COALESCE({{params.custoObra}}::decimal, 0),
        COALESCE({{params.aporteBase}}::decimal, 0),
        COALESCE({{params.precoVenda}}::decimal, 0),
        COALESCE({{params.propertyTaxAno}}::decimal, 0),
        '{{params.observacoes}}'
      ) RETURNING id
    `,
  });
}

export default createModelagemUnidade;
