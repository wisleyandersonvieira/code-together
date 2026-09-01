/**
 * Relatório de impacto da correção da base do fee de estruturação.
 *
 * NÃO há migration e NADA é escrito: nenhuma modelagem é "atualizada", nenhum
 * valor calculado é persistido. Toda modelagem simplesmente passa a calcular
 * diferente ao abrir — e este script existe para dizer, ANTES de alguém abrir,
 * de quanto é a diferença em cada uma. Se alguma já foi apresentada a investidor,
 * é aqui que o número novo aparece.
 *
 * Roda uma vez, imprime uma tabela e sai. Não vira tela.
 *
 *   MODELAGEM_EMAIL=voce@exemplo.com MODELAGEM_SENHA='...' \
 *     npx vite-node scripts/relatorio-impacto-fee.ts
 *
 * As credenciais são OBRIGATÓRIAS: a edge function `execute-sql` rejeita a anon
 * key de propósito (ver a "Camada 1" lá) e exige um usuário autenticado E
 * aprovado por admin. O script não traz credencial embutida e não grava nenhuma.
 *
 * Lê o banco pela MESMA consulta do app (`loadModelagemCompleta`) e mapeia com o
 * MESMO `mapearModelInput` — não há segunda leitura do banco a divergir da do app.
 */
import { calcular } from '../lib/modelagem/motor';
import { mapearModelInput } from '../lib/modelagem/mapear';
import type { ModelOutput } from '../lib/modelagem/tipos';
import { gerarMotorAntigo, apagarMotorAntigo, GERADO } from './motorAntigo';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Acesso ao banco ─────────────────────────────────────────────────────────
// Mesma edge function que o shim do @uibakery/data usa no navegador, com a chave
// anon (pública por design, protegida por RLS). Sobrescrevíveis por env para
// apontar para outro ambiente.
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://zkzcdafgdcsotcnmlmcp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY ?? lerChaveDoClient();

/** A anon key já vive versionada em src/integrations/supabase/client.ts. */
function lerChaveDoClient(): string {
  const fonte = readFileSync(join(import.meta.dirname, '../src/integrations/supabase/client.ts'), 'utf8');
  const m = fonte.match(/SUPABASE_PUBLISHABLE_KEY\s*=\s*"([^"]+)"/);
  if (!m) throw new Error('Não achei a anon key em src/integrations/supabase/client.ts');
  return m[1];
}

/** Linha crua do banco, no formato que `mapearModelInput` já sabe ler. */
type LinhaCrua = Record<string, unknown>;

/**
 * Troca e-mail e senha por um access token.
 *
 * A anon key sozinha NÃO passa: `execute-sql` exige usuário autenticado e
 * aprovado. Sem as duas variáveis o script para aqui, com a instrução — em vez
 * de seguir e falhar com "Não autorizado", que não diz o que fazer.
 */
async function autenticar(): Promise<string> {
  const email = process.env.MODELAGEM_EMAIL;
  const senha = process.env.MODELAGEM_SENHA;
  if (!email || !senha) {
    throw new Error(
      'Defina MODELAGEM_EMAIL e MODELAGEM_SENHA. A edge function execute-sql ' +
        'rejeita a anon key e exige um usuário aprovado por admin.',
    );
  }
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify({ email, password: senha }),
  });
  const corpo = await r.json();
  if (!corpo?.access_token) {
    throw new Error(`Login falhou: ${corpo?.error_description ?? corpo?.msg ?? r.status}`);
  }
  return corpo.access_token as string;
}

let TOKEN = '';

async function sql(query: string, params: Record<string, unknown> = {}): Promise<LinhaCrua[]> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/execute-sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query, params }),
  });
  const corpo = await r.json();
  if (corpo?.error) throw new Error(corpo.error);
  return corpo?.data ?? [];
}

/**
 * A consulta de `actions/loadModelagemCompleta.ts`, com UMA diferença: sem o
 * `WHERE m.id = ...`, para varrer todas as modelagens de uma vez. O corpo
 * (os sub-selects que aninham as tabelas filhas) é lido do próprio arquivo da
 * action, e não copiado — copiar é como as duas leituras divergiriam.
 */
function consultaTodas(): string {
  const fonte = readFileSync(join(import.meta.dirname, '../actions/loadModelagemCompleta.ts'), 'utf8');
  const m = fonte.match(/query:\s*`([\s\S]*?)`,\s*\}\);/);
  if (!m) throw new Error('Não consegui extrair a query de actions/loadModelagemCompleta.ts');
  return m[1]
    // O cenário baseline de cada modelagem, que é o que o app abre por padrão.
    .replace(/COALESCE\(\s*\{\{params\.cenarioId\}\}::int,/, 'COALESCE(NULL::int,')
    .replace(/WHERE m\.id = \{\{params\.id\}\}::int/, 'ORDER BY m.id');
}

// ─── Formatação ──────────────────────────────────────────────────────────────
const dinheiro = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const deltaDinheiro = (a: number, b: number) => `${b - a >= 0 ? '+' : ''}${dinheiro(b - a)}`;
const deltaPct = (a: number | null, b: number | null) =>
  a == null || b == null ? 'n/d' : `${(b - a) * 100 >= 0 ? '+' : ''}${((b - a) * 100).toFixed(2)} p.p.`;
const deltaMult = (a: number | null, b: number | null) =>
  a == null || b == null ? 'n/d' : `${b - a >= 0 ? '+' : ''}${(b - a).toFixed(4)}x`;

function tabela(linhas: string[][]) {
  const larg = linhas[0].map((_, c) => Math.max(...linhas.map((l) => l[c].length)));
  const sep = '─'.repeat(larg.reduce((a, b) => a + b + 3, 1));
  linhas.forEach((l, i) => {
    console.log('│ ' + l.map((c, k) => (k === 0 ? c.padEnd(larg[k]) : c.padStart(larg[k]))).join(' │ ') + ' │');
    if (i === 0) console.log(sep);
  });
}

async function main() {
  gerarMotorAntigo();
  try {
    // Import dinâmico: o arquivo só existe depois da geração acima.
    const { calcular: calcularAntigo } = (await import(GERADO)) as { calcular: typeof calcular };

    TOKEN = await autenticar();
    const linhas = await sql(consultaTodas());
    if (linhas.length === 0) {
      console.log('Nenhuma modelagem no banco — nada a comparar.');
      return;
    }

    const cabecalho = [
      'Modelagem', 'Fee antes', 'Fee depois', 'Δ fee',
      'Δ lucro projeto', 'Δ MOIC', 'Δ TIR anual',
    ];
    const corpo: string[][] = [cabecalho];
    let somaAntes = 0;
    let somaDepois = 0;

    for (const linha of linhas) {
      const nome = String(linha.nome ?? `#${linha.id}`);
      let antes: ModelOutput;
      let depois: ModelOutput;
      try {
        const input = mapearModelInput(linha as never);
        antes = calcularAntigo(input);
        depois = calcular(input);
      } catch (e) {
        // Uma modelagem que o mapeamento não consegue ler não derruba o
        // relatório: ela aparece como 'erro' na linha dela e as outras seguem.
        const msg = e instanceof Error ? e.message : String(e);
        corpo.push([nome, 'erro', 'erro', msg.slice(0, 30), '', '', '']);
        continue;
      }
      somaAntes += antes.apuracao.feeTotal;
      somaDepois += depois.apuracao.feeTotal;
      corpo.push([
        nome,
        dinheiro(antes.apuracao.feeTotal),
        dinheiro(depois.apuracao.feeTotal),
        deltaDinheiro(antes.apuracao.feeTotal, depois.apuracao.feeTotal),
        deltaDinheiro(antes.apuracao.lucroProjeto, depois.apuracao.lucroProjeto),
        deltaMult(antes.indicadores.moic, depois.indicadores.moic),
        deltaPct(antes.indicadores.tirAnual, depois.indicadores.tirAnual),
      ]);
    }

    tabela(corpo);
    console.log();
    console.log(
      `${linhas.length} modelagem(ns). Fee somado: ${dinheiro(somaAntes)} → ${dinheiro(somaDepois)} ` +
        `(${deltaDinheiro(somaAntes, somaDepois)}).`,
    );
    // Quem mudou é quem precisa ser reapresentado a investidor.
    const mudaram = corpo.slice(1).filter((l) => l[3] !== '+$0' && l[3] !== 'erro');
    console.log(
      mudaram.length === 0
        ? 'Nenhuma modelagem muda de número: em todas a base do fee já coincidia com o total sacado.'
        : `${mudaram.length} modelagem(ns) mudam de número: ${mudaram.map((l) => l[0]).join(', ')}.`,
    );
  } finally {
    apagarMotorAntigo();
  }
}

main().catch((e: unknown) => {
  apagarMotorAntigo();
  console.error('Falhou:', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
