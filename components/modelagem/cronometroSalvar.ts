/**
 * Cronômetro do salvamento da Modelagem Financeira.
 *
 * O `salvar()` do editor faz uma requisição HTTP por linha de cada tabela filha,
 * em série. Numa modelagem de locação cheia isso passa de trezentas chamadas, e
 * o usuário só vê um spinner. Este módulo mede onde o tempo vai — por BLOCO, que
 * é a unidade em que o salvamento é organizado e em que uma otimização faz
 * sentido.
 *
 * Fica ligado atrás de uma flag em localStorage e é a linha de base contra a
 * qual qualquer ganho vai ser medido depois. Não some quando a otimização
 * entrar: medir de novo é como se confere que o ganho é real.
 *
 * Contar as requisições AQUI, e não no `salvar()`, é deliberado: a contagem vem
 * do observador do shim, por onde toda requisição passa. Uma contagem mantida à
 * mão no editor sai do lugar no dia em que alguém acrescentar uma action nova e
 * esquecer de incrementá-la — e uma medição errada é pior que nenhuma.
 */

/** Chave da flag. Qualquer valor não vazio liga; remova a chave para desligar. */
export const CHAVE_DEBUG_SALVAR = 'provison:debug:salvar';

export interface BlocoMedido {
  nome: string;
  requisicoes: number;
  ms: number;
}

export interface Cronometro {
  /** Falso quando a flag está desligada: todo método vira no-op. */
  readonly ativo: boolean;
  /** Fecha o bloco anterior e abre um novo. Blocos repetidos SOMAM. */
  bloco(nome: string): void;
  /** Fecha o último bloco e devolve o relatório. Não imprime nada. */
  encerrar(): RelatorioSalvamento;
  /** Requisições contadas até agora, em todos os blocos. */
  readonly total: number;
}

/**
 * Quanto o editor REPINTOU durante o salvamento.
 *
 * Não vem do cronômetro: quem conta é o próprio ModelagemEditor, porque render
 * é assunto do React e não da rede. Entra no relatório para que as duas contas
 * — requisições e renders — apareçam lado a lado, que é a única forma de dizer
 * qual dos dois está custando os 40 segundos.
 *
 * `commits` e `passadas` são números diferentes e a diferença importa: sob
 * StrictMode (que este app liga em main.tsx) o React invoca a função do
 * componente DUAS vezes por commit em desenvolvimento. `passadas` ≈ 2 ×
 * `commits` é o esperado em dev, não um sintoma.
 */
export interface MedicaoRenders {
  /** Commits: quantas vezes o React de fato repintou a árvore do editor. */
  commits: number;
  /** Invocações da função do componente. Em dev, ~2× commits (StrictMode). */
  passadas: number;
  /** Soma de render + commit da árvore, em ms. NÃO inclui a pintura do browser. */
  ms: number;
}

export interface RelatorioSalvamento {
  blocos: BlocoMedido[];
  totalRequisicoes: number;
  totalMs: number;
  /** Ausente quando ninguém mediu render — o relatório sai como antes. */
  renders?: MedicaoRenders;
}

/** Lê a flag sem estourar em SSR nem com localStorage bloqueado. */
export function debugSalvarLigado(): boolean {
  try {
    return !!globalThis.localStorage?.getItem(CHAVE_DEBUG_SALVAR);
  } catch {
    // Navegador com armazenamento bloqueado (janela privada, política de site):
    // a ausência da flag é "desligado", nunca um erro que derruba o salvamento.
    return false;
  }
}

/** Milissegundos formatados como na tabela: `142 ms` até 1s, `41.7 s` acima. */
export function formatarMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/**
 * A tabela em texto, alinhada em colunas. Devolvida como string — e não impressa
 * — para o teste poder cobrar o formato sem espiar o console.
 *
 *   [salvar] premissas        1 req    142 ms
 *   [salvar] custos          38 req  5.204 ms
 *   [salvar] TOTAL          312 req    41.7 s  416 renders
 *   [salvar] render       6.2 s em 416 commits (832 passadas)
 *
 * As duas últimas linhas só aparecem quando houve medição de render.
 */
export function formatarRelatorio(r: RelatorioSalvamento): string {
  const linhas = [...r.blocos, { nome: 'TOTAL', requisicoes: r.totalRequisicoes, ms: r.totalMs }];
  const larguraNome = Math.max(...linhas.map((l) => l.nome.length));
  const larguraReq = Math.max(...linhas.map((l) => String(l.requisicoes).length));
  const larguraMs = Math.max(...linhas.map((l) => formatarMs(l.ms).length));
  const tabela = linhas.map(
    (l) =>
      `[salvar] ${l.nome.padEnd(larguraNome)}  ${String(l.requisicoes).padStart(larguraReq)} req  ${formatarMs(l.ms).padStart(larguraMs)}`,
  );
  const rd = r.renders;
  if (rd) {
    // O número de renders vai na MESMA linha do TOTAL de propósito: é ao lado do
    // tempo total que ele responde à pergunta que motivou a medição.
    tabela[tabela.length - 1] += `  ${rd.commits} renders`;
    tabela.push(
      `[salvar] render  ${formatarMs(rd.ms)} em ${rd.commits} commits (${rd.passadas} passadas)`,
    );
  }
  return tabela.join('\n');
}

/** Cronômetro desligado: todos os métodos são no-op e o relatório vem vazio. */
const INERTE: Cronometro = {
  ativo: false,
  bloco: () => {},
  encerrar: () => ({ blocos: [], totalRequisicoes: 0, totalMs: 0 }),
  total: 0,
};

/**
 * Cria o cronômetro e LIGA o observador do shim.
 *
 * `encerrar()` é obrigatório e desliga o observador — por isso o `salvar()` o
 * chama no `finally`, e não no caminho feliz: um salvamento que estoura no meio
 * deixaria o observador ligado para sempre, medindo requisições de outras telas.
 *
 * `observar` é injetado para o teste poder rodar sem o shim e sem navegador.
 */
export function criarCronometro(
  observar: (fn: ((nome: string, ms: number, erro: boolean) => void) | null) => unknown,
  ligado = debugSalvarLigado(),
): Cronometro {
  if (!ligado) return INERTE;

  const blocos: BlocoMedido[] = [];
  let atual: BlocoMedido | null = null;
  let totalRequisicoes = 0;
  const inicio = performance.now();

  const abrir = (nome: string): BlocoMedido => {
    // Bloco repetido SOMA no mesmo registro: as parcelas de custo e os aportes
    // de sócio são gravados dentro de um laço por pai, e cada volta reabriria o
    // bloco. Trinta linhas "parcelas custo" na tabela não diriam nada.
    const existente = blocos.find((b) => b.nome === nome);
    if (existente) return existente;
    const novo = { nome, requisicoes: 0, ms: 0 };
    blocos.push(novo);
    return novo;
  };

  // Toda requisição é creditada ao bloco ABERTO no momento em que ela TERMINA.
  // Como o salvamento é estritamente sequencial — um `await` por chamada —, o
  // bloco que termina é sempre o mesmo que começou. Se algum dia o salvamento
  // passar a disparar chamadas em paralelo, esta atribuição deixa de valer e o
  // cronômetro precisa passar a carregar o bloco junto da promessa.
  observar((_nome, ms) => {
    const destino = atual ?? abrir('(sem bloco)');
    destino.requisicoes++;
    destino.ms += ms;
    totalRequisicoes++;
  });

  return {
    ativo: true,
    bloco(nome: string) {
      atual = abrir(nome);
    },
    encerrar() {
      observar(null);
      atual = null;
      return {
        blocos,
        totalRequisicoes,
        // O total é o RELÓGIO DE PAREDE do salvamento inteiro, não a soma dos
        // blocos: entre uma requisição e outra há o trabalho do próprio cliente
        // — montar payload, remapear ids —, e essa diferença é justamente o que
        // diz se o gargalo é a rede ou o navegador.
        totalMs: performance.now() - inicio,
      };
    },
    get total() {
      return totalRequisicoes;
    },
  };
}
