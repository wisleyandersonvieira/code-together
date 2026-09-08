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
  /**
   * Tempo somado DENTRO das requisições — a soma dos blocos, que é a soma do
   * que o shim cronometrou em cada chamada.
   *
   * Somar só vale porque o salvamento é estritamente sequencial: um `await` por
   * chamada, nenhuma sobreposição. No dia em que ele disparar chamadas em
   * paralelo esta soma passa a contar o mesmo relógio duas vezes e vira maior
   * que `totalMs` — mesma premissa que o comentário do observador já registra.
   */
  totalRedeMs: number;
  /** Ausente quando ninguém mediu render — o relatório sai sem a linha. */
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
 *   [salvar] premissas    1 req   142 ms
 *   [salvar] custos      38 req   5.2 s
 *   [salvar] TOTAL      208 req  41.7 s
 *   [salvar] rede    38.9 s em 208 requisições
 *   [salvar] render   6.2 s em 209 commits (418 passadas)
 *   [salvar] fora     2.8 s  ← 41.7 s − 38.9 s
 *
 * `fora` É A LINHA QUE DECIDE, e por isso vem por último.
 *
 * Os contadores de render dizem quanto o render CUSTA; `fora` diz quanto ele
 * ACRESCENTA, que é outra coisa. O `setIsLoading(true)` do shim roda antes de a
 * requisição ser disparada, então o commit que ele provoca ocupa a thread
 * enquanto a chamada seguinte já está no ar: um render de 15 ms dentro de uma
 * latência de 100 ms não custa milissegundo nenhum de relógio de parede.
 *
 * `fora` é o tempo de parede que NÃO está dentro de requisição alguma — o que
 * sobra de render e de trabalho síncrono depois de descontar tudo que se
 * sobrepôs à rede. Perto de `render`, o render é aditivo e vale eliminá-lo;
 * muito menor que `render`, ele está escondido atrás da rede e eliminá-lo não
 * devolve quase nada.
 *
 * A linha `render` só aparece quando houve medição de render.
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

  // As três linhas do resumo têm alinhamento PRÓPRIO, e não o da tabela acima:
  // são somas em outra unidade — segundos contra requisições —, e forçá-las na
  // grade de colunas da tabela só faria as duas leituras se atrapalharem.
  const rd = r.renders;
  const resumo: [string, string][] = [
    ['rede', `${formatarMs(r.totalRedeMs)} em ${r.totalRequisicoes} requisições`],
  ];
  if (rd) {
    resumo.push(['render', `${formatarMs(rd.ms)} em ${rd.commits} commits (${rd.passadas} passadas)`]);
  }
  resumo.push([
    'fora',
    `${formatarMs(r.totalMs - r.totalRedeMs)}  ← ${formatarMs(r.totalMs)} − ${formatarMs(r.totalRedeMs)}`,
  ]);
  const larguraRotulo = Math.max(...resumo.map(([rotulo]) => rotulo.length));
  for (const [rotulo, texto] of resumo) {
    tabela.push(`[salvar] ${rotulo.padEnd(larguraRotulo)}  ${texto}`);
  }

  return tabela.join('\n');
}

/** Cronômetro desligado: todos os métodos são no-op e o relatório vem vazio. */
const INERTE: Cronometro = {
  ativo: false,
  bloco: () => {},
  encerrar: () => ({ blocos: [], totalRequisicoes: 0, totalMs: 0, totalRedeMs: 0 }),
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
        totalRedeMs: blocos.reduce((soma, b) => soma + b.ms, 0),
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
