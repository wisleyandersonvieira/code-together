/**
 * Guarda de colunas das FUNÇÕES de banco que copiam ou gravam uma modelagem
 * inteira.
 *
 * Irmã de `actions/colunas-gravadas.test.ts`, que faz o mesmo para o SQL das
 * actions. A diferença é o alvo: lá é um UPDATE por tabela, aqui é uma função
 * plpgsql que enumera vinte tabelas de uma vez — e é justamente por enumerar
 * tanto que ela apodrece sem ninguém ver.
 *
 * ─── O que motivou o teste ─────────────────────────────────────────────────
 *
 * A `duplicar_modelagem` (1764400000) perdia DUAS colunas em silêncio:
 *
 *   modelagem_unidades.aluguel_sf_ano — a receita inteira do modo locação. A
 *     cópia nascia com aluguel zero, NOI negativo e saída zero. E esta coluna é
 *     ANTERIOR à função: a lista já nasceu incompleta.
 *   modelagem_locacao.mes_inicio_opex — entrou uma migration depois.
 *
 * Nenhuma das duas dava erro: a coluna omitida assume o DEFAULT e a cópia sai
 * com número errado em vez de sair quebrada. A conferência manual falhou nos
 * dois sentidos possíveis — no passado e no futuro —, e é por isso que a
 * conferência virou teste.
 *
 * ─── Por que migrations e não information_schema ───────────────────────────
 *
 * O catálogo de verdade mora num Postgres, e o CI não tem um. As migrations são
 * a fonte versionada do MESMO catálogo — é delas que o banco é construído — e é
 * o que `actions/colunas-gravadas.test.ts` já usa. Um teste que precisasse de
 * banco não rodaria, e um teste que não roda não guarda nada.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RAIZ = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

/**
 * Colunas dispensadas, com o motivo por linha.
 *
 * A lista é DELIBERADAMENTE curta e genérica: só identidade e auditoria. Toda
 * coluna de input tem de ser citada. Acrescentar nome aqui para calar o teste
 * devolve exatamente o bug que ele existe para pegar — se uma coluna nova não
 * deve ser copiada, o motivo vai escrito aqui, e não some no silêncio.
 */
const DISPENSADAS: Record<string, string> = {
  // Geradas pelo banco: a linha nova tem identidade própria, e copiar a chave
  // da origem seria copiar a linha em cima dela.
  id: 'SERIAL — a cópia recebe id próprio',
  // Escrito à mão pela função, apontando para a modelagem NOVA. Aparece na
  // lista de colunas do INSERT, mas nunca com o valor da origem.
  created_at: 'auditoria — a cópia nasce agora, não na data da origem',
  updated_at: 'auditoria — idem',
};

/** Todo o SQL do repositório que pode declarar coluna. */
function fontesSql(): string {
  const arquivos: string[] = [];
  for (const dir of ['migrations', 'supabase/migrations']) {
    const abs = path.join(RAIZ, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      if (f.endsWith('.sql')) arquivos.push(path.join(abs, f));
    }
  }
  const setup = path.join(RAIZ, 'supabase_setup.sql');
  if (existsSync(setup)) arquivos.push(setup);
  return arquivos.map((f) => readFileSync(f, 'utf8')).join('\n');
}

/** Colunas que o schema declara para uma tabela, por CREATE ou por ADD COLUMN. */
function colunasDaTabela(sql: string, tabela: string): Set<string> {
  const cols = new Set<string>();
  const alter = new RegExp(`ALTER TABLE\\s+(?:public\\.)?${tabela}([\\s\\S]*?);`, 'gi');
  for (const m of sql.matchAll(alter)) {
    const add = /ADD COLUMN(?:\s+IF NOT EXISTS)?\s+([a-z_]+)/gi;
    for (const c of m[1].matchAll(add)) cols.add(c[1].toLowerCase());
  }
  const create = new RegExp(
    `CREATE TABLE(?:\\s+IF NOT EXISTS)?\\s+(?:public\\.)?${tabela}\\s*\\(([\\s\\S]*?)\\n\\);`,
    'gi',
  );
  for (const m of sql.matchAll(create)) {
    for (const linha of m[1].split('\n')) {
      const c = linha
        .trim()
        .match(
          /^([a-z_]+)\s+(?:BOOLEAN|BOOL|SMALLINT|BIGINT|INTEGER|INT|SERIAL|DECIMAL|NUMERIC|REAL|DOUBLE|FLOAT|TEXT|VARCHAR|CHAR|TIMESTAMPTZ|TIMESTAMP|DATE|TIME|UUID|JSONB|JSON)/i,
        );
      if (c) cols.add(c[1].toLowerCase());
    }
  }
  return cols;
}

/**
 * Colunas que a função CITA para uma tabela: as listadas no `INSERT INTO tabela
 * (…)` e as do `UPDATE tabela … SET coluna =`.
 *
 * Os comentários saem antes: as duas correções desta leva têm o nome da coluna
 * escrito em prosa logo acima do INSERT, e contá-los faria o teste passar pela
 * própria documentação do bug.
 */
function colunasCitadas(fonteSql: string, tabela: string): Set<string> {
  const fonte = fonteSql.replace(/--[^\n]*/g, '');
  const cols = new Set<string>();
  const insert = new RegExp(`INSERT INTO\\s+(?:public\\.)?${tabela}\\s*\\(([\\s\\S]*?)\\)`, 'gi');
  for (const m of fonte.matchAll(insert)) {
    for (const c of m[1].split(',')) {
      const t = c.trim().toLowerCase();
      if (/^[a-z_]+$/.test(t)) cols.add(t);
    }
  }
  const update = new RegExp(`UPDATE\\s+(?:public\\.)?${tabela}\\s+\\w*\\s*SET\\s+([a-z_]+)\\s*=`, 'gi');
  for (const m of fonte.matchAll(update)) cols.add(m[1].toLowerCase());
  return cols;
}

/**
 * As funções sob guarda, e as tabelas que cada uma tem de cobrir por inteiro.
 *
 * Quando a `salvar_modelagem(jsonb)` existir, ela entra aqui com as suas 18
 * tabelas — que são estas menos `modelagem_cenarios` e `modelagem_overrides`,
 * gravados fora do salvamento.
 */
const FUNCOES: { arquivo: string; tabelas: string[] }[] = [
  {
    arquivo: 'migrations/1764600000_fn_duplicar_colunas_faltantes.sql',
    tabelas: [
      'modelagens',
      'modelagem_cenarios',
      'modelagem_financiamento',
      'modelagem_receita',
      'modelagem_aportes',
      'modelagem_aporte_parcelas',
      'modelagem_unidades',
      'modelagem_fases',
      'modelagem_unidade_fases',
      'modelagem_custos',
      'modelagem_custo_parcelas',
      'modelagem_socios',
      'modelagem_socio_aportes',
      'modelagem_takedowns',
      'modelagem_vendas_unidade',
      'modelagem_overrides',
      'modelagem_benchmark_curva',
      'modelagem_locacao',
      'modelagem_opex',
      'modelagem_ocupacao',
    ],
  },
];

describe('funções de banco citam toda coluna declarada', () => {
  const sql = fontesSql();

  for (const { arquivo, tabelas } of FUNCOES) {
    describe(path.basename(arquivo), () => {
      const fonte = readFileSync(path.join(RAIZ, arquivo), 'utf8');

      for (const tabela of tabelas) {
        it(`${tabela} — nenhuma coluna declarada fica de fora`, () => {
          const declaradas = colunasDaTabela(sql, tabela);
          // Parser que não acha coluna nenhuma passaria vazio e guardaria nada.
          expect(
            declaradas.size,
            `Nenhuma coluna encontrada para ${tabela} — o parser de schema quebrou`,
          ).toBeGreaterThan(2);

          const citadas = colunasCitadas(fonte, tabela);
          expect(
            citadas.size,
            `A função não cita ${tabela} — tabela renomeada ou removida da lista?`,
          ).toBeGreaterThan(0);

          const faltando = [...declaradas].filter((c) => !(c in DISPENSADAS) && !citadas.has(c));
          expect(
            faltando,
            `${arquivo} ignora coluna(s) de ${tabela}: ${faltando.join(', ')}.\n` +
              'A coluna omitida assume o DEFAULT e a linha sai com número errado, sem erro ' +
              'nenhum. Acrescente-a à função — ou, se for realmente derivada, a DISPENSADAS ' +
              'com o motivo escrito.',
          ).toEqual([]);
        });
      }
    });
  }

  it('o parser de tipos enxerga CHAR, DATE e JSONB — não só VARCHAR', () => {
    // Guarda do próprio parser. `modelagens.moeda` é CHAR(3), e a primeira
    // versão desta varredura não conhecia CHAR: a coluna ficava invisível e o
    // teste teria dado verde para uma função que a ignorasse. Um guard com
    // ponto cego é pior do que nenhum — ele passa a garantir o que não olha.
    const dasModelagens = colunasDaTabela(sql, 'modelagens');
    expect(dasModelagens).toContain('moeda'); // CHAR(3)
    expect(dasModelagens).toContain('data_inicio'); // DATE
    expect(colunasDaTabela(sql, 'modelagem_cenarios')).toContain('input_snapshot'); // JSONB
  });

  it('as duas colunas que motivaram o teste, pelo nome', () => {
    // Explícitas, e não só cobertas pela varredura: quem quebrar isto de novo
    // tem de ler o nome do campo no nome do teste que falhou.
    const fonte = readFileSync(
      path.join(RAIZ, 'migrations/1764600000_fn_duplicar_colunas_faltantes.sql'),
      'utf8',
    );
    expect(colunasCitadas(fonte, 'modelagem_unidades')).toContain('aluguel_sf_ano');
    expect(colunasCitadas(fonte, 'modelagem_locacao')).toContain('mes_inicio_opex');
  });

  it('a versão ANTERIOR da função reprovaria — o teste pega o bug que existiu', () => {
    // Guarda do próprio teste: se o parser afrouxar a ponto de não achar o
    // buraco que sabidamente existia, ele para de guardar qualquer coisa.
    const anterior = readFileSync(
      path.join(RAIZ, 'migrations/1764400000_fn_duplicar_modelagem_locacao.sql'),
      'utf8',
    );
    const faltaUnidades = [...colunasDaTabela(sql, 'modelagem_unidades')].filter(
      (c) => !(c in DISPENSADAS) && !colunasCitadas(anterior, 'modelagem_unidades').has(c),
    );
    const faltaLocacao = [...colunasDaTabela(sql, 'modelagem_locacao')].filter(
      (c) => !(c in DISPENSADAS) && !colunasCitadas(anterior, 'modelagem_locacao').has(c),
    );
    expect(faltaUnidades).toEqual(['aluguel_sf_ano']);
    expect(faltaLocacao).toEqual(['mes_inicio_opex']);
  });
});
