import { action } from '@uibakery/data';

function updateModelagemUnidade() {
  return action('updateModelagemUnidade', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE modelagem_unidades SET
        ordem = COALESCE({{params.ordem}}::int, ordem),
        nome = '{{params.nome}}',
        cidade = '{{params.cidade}}',
        area_sf = COALESCE({{params.areaSf}}::decimal, 0),
        custo_terreno = COALESCE({{params.custoTerreno}}::decimal, 0),
        custo_obra = COALESCE({{params.custoObra}}::decimal, 0),
        aporte_base = COALESCE({{params.aporteBase}}::decimal, 0),
        preco_venda = COALESCE({{params.precoVenda}}::decimal, 0),
        property_tax_ano = COALESCE({{params.propertyTaxAno}}::decimal, 0),
        observacoes = '{{params.observacoes}}',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}::int
    `,
  });
}

export default updateModelagemUnidade;
