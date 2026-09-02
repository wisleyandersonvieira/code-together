/**
 * Guarda de colunas gravadas das ações de modelagem.
 *
 * O bug que originou este teste: a migration 1763300000 criou
 * `modelagem_financiamento.linha_rotativa`, o tipo ganhou o campo, a aba ganhou
 * o switch, o motor passou a ler — e ninguém acrescentou a coluna ao UPDATE de
 * `saveModelagemFinanciamento`. O resultado não foi erro nenhum: o switch
 * gravava, o SELECT relia o DEFAULT FALSE e a tela voltava desmarcada. Silêncio
 * total, e o motor calculando a linha errada.
 *
 * Uma coluna de INPUT que a migration cria e o save não grava é sempre esse
 * mesmo bug, e ele não aparece em teste de motor nenhum — o motor é puro e nunca
 * toca no banco. Só varrendo os dois fontes e comparando dá para pegar.
 *
 * O que o teste NÃO cobra: colunas de identidade e de auditoria, que ninguém
 * grava por parâmetro, e as colunas DERIVADAS — não há nenhuma nestas tabelas,
 * de propósito (só input e override moram lá; ver a migration 1760800000).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RAIZ = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

/** Nunca vêm por parâmetro: chave, vínculo e auditoria. */
const NAO_GRAVAVEIS = new Set(['id', 'modelagem_id', 'created_at', 'updated_at']);

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
        .match(/^([a-z_]+)\s+(?:BOOLEAN|INT|INTEGER|BIGINT|SERIAL|DECIMAL|NUMERIC|TEXT|VARCHAR|TIMESTAMP)/i);
      if (c) cols.add(c[1].toLowerCase());
    }
  }
  return cols;
}

/** Colunas que aparecem à esquerda de um `=` no SET de um UPDATE. */
function colunasGravadas(arquivo: string): Set<string> {
  const fonte = readFileSync(path.join(RAIZ, arquivo), 'utf8');
  const set = fonte.slice(fonte.indexOf('SET'), fonte.indexOf('WHERE modelagem_id'));
  // Sem os comentários: `-- coluna = ...` em prosa não é gravação.
  const semComentario = set.replace(/--[^\n]*/g, '');
  return new Set(
    [...semComentario.matchAll(/^\s*([a-z_]+)\s*=/gm)].map((m) => m[1].toLowerCase()),
  );
}

describe('ações de modelagem gravam toda coluna de input', () => {
  const sql = fontesSql();

  // Tabelas 1:1 com a modelagem, salvas por UPDATE de todas as colunas de uma
  // vez. As listas por item (custos, sócios, takedowns) têm outra forma e ficam
  // de fora daqui.
  const casos: [string, string][] = [
    ['modelagem_financiamento', 'actions/saveModelagemFinanciamento.ts'],
    ['modelagem_receita', 'actions/saveModelagemReceita.ts'],
    ['modelagem_aportes', 'actions/saveModelagemAportes.ts'],
  ];

  for (const [tabela, acao] of casos) {
    it(`${tabela} — toda coluna declarada chega ao ${path.basename(acao)}`, () => {
      const declaradas = colunasDaTabela(sql, tabela);
      // Se o parser não achar coluna nenhuma, o teste passaria vazio e não
      // guardaria nada. Melhor reprovar do que dar falso verde.
      expect(declaradas.size).toBeGreaterThan(3);

      const gravadas = colunasGravadas(acao);
      const faltando = [...declaradas].filter(
        (c) => !NAO_GRAVAVEIS.has(c) && !gravadas.has(c),
      );
      expect(
        faltando,
        `Coluna(s) declaradas em migration e nunca gravadas por ${acao}: ${faltando.join(', ')}. ` +
          'A tela grava, o SELECT relê o DEFAULT e o usuário vê a escolha dele sumir.',
      ).toEqual([]);
    });
  }

  it('linha_rotativa especificamente — foi este o bug', () => {
    // Explícito, e não só coberto pela varredura acima: quem quebrar isto de
    // novo tem de ler o nome do campo no nome do teste que falhou.
    expect(colunasGravadas('actions/saveModelagemFinanciamento.ts')).toContain('linha_rotativa');
  });
});
