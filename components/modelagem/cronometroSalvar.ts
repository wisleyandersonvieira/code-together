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

/**
 * O que UMA resposta do execute-sql relatou sobre a própria execução.
 *
 * Declarado aqui, e não importado do shim, pelo mesmo motivo que a assinatura do
 * observador já é declarada duas vezes neste projeto: este módulo é TypeScript
 * puro e o teste o roda sem o shim, sem React e sem navegador. O shim tem a sua
 * cópia (`TemposServidor`), e as duas casam estruturalmente — se divergirem, o
 * `tsc` reclama na chamada do `criarCronometro` no editor.
 */
export interface TemposServidor {
  boot: string;
  seq: number;
  totalMs: number;
  authMs: number;
  conexaoMs: number;
  warmupMs: number;
  queryMs: number;
}

/**
 * O que o execute-sql relatou sobre si mesmo, somado sobre o salvamento.
 *
 * `boots` é o número de ISOLATES DISTINTOS que atenderam as requisições. Perto
 * de 1, o isolate é reaproveitado e o cache de módulo funciona. Perto do número
 * de requisições, ele é reciclado a cada chamada — e aí o `import()` remoto do
 * postgres.js e o do jose são pagos toda vez, e o pool de conexões do
 * `getSql()` nunca é reaproveitado apesar de o código dizer que é.
 *
 * `frias` conta as requisições que chegaram num isolate recém-nascido (`seq`
 * = 1). Com `boots`, separa "reciclagem" de "concorrência": vários isolates
 * atendendo em paralelo dariam muitos boots com poucas frias.
 */
export interface MedicaoServidor {
  /** Respostas que trouxeram os headers. Menor que o total = função antiga no ar. */
  respostas: number;
  /** Isolates distintos. */
  boots: number;
  /** Requisições que caíram num isolate na sua PRIMEIRA requisição. */
  frias: number;
  /** Somas, em ms, do que a função relatou de si mesma. */
  totalMs: number;
  authMs: number;
  conexaoMs: number;
  queryMs: number;
  /**
   * O `SELECT 1` que a função roda antes da query real, repartido entre
   * isolate FRIO (primeira requisição do boot) e QUENTE.
   *
   * É a linha que decide de onde vem o segundo por requisição. O cliente do
   * postgres.js é preguiçoso: `getSql()` só instancia o objeto, e o TCP, o TLS,
   * a sessão com o Supavisor e o startup só acontecem na primeira query. Sem a
   * sonda, tudo isso cai carimbado como tempo de QUERY, e um UPDATE de uma
   * linha parece custar centenas de milissegundos de banco.
   *
   * Frio na casa das centenas e quente na casa das unidades = handshake.
   * Os dois na casa das centenas = é banco de verdade, e a investigação vira
   * plano de execução e índice.
   */
  warmupFrioMs: number;
  warmupQuenteMs: number;
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
  /** Ausente quando nenhuma resposta trouxe os headers de instrumentação. */
  servidor?: MedicaoServidor;
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
 *   [salvar] rede      38.9 s em 208 requisições
 *   [salvar] servidor  31.0 s em 208 respostas  (auth 19.1 s · … · query 1.2 s)
 *   [salvar] warmup    frio 152 ms/req em 191  ·  quente 4 ms/req em 17  ·  query 6 ms/req
 *   [salvar] isolates  191 boots distintos, 191 requisições frias em 208
 *   [salvar] render    6.2 s em 209 commits (418 passadas)
 *   [salvar] fora      2.8 s  ← 41.7 s − 38.9 s
 *
 * `rede − servidor` é a ida e a volta pelo fio; `servidor` é o que a função
 * gastou dentro de si, repartido entre autenticar, conectar e consultar.
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
  const sv = r.servidor;
  if (sv) {
    const quentes = sv.respostas - sv.frias;
    const media = (soma: number, n: number) => (n > 0 ? formatarMs(soma / n) : '—');
    resumo.push([
      'servidor',
      `${formatarMs(sv.totalMs)} em ${sv.respostas} respostas  (auth ${formatarMs(sv.authMs)}` +
        ` · conexão ${formatarMs(sv.conexaoMs)} · warmup ${formatarMs(sv.warmupFrioMs + sv.warmupQuenteMs)}` +
        ` · query ${formatarMs(sv.queryMs)})`,
    ]);
    // A média por requisição, e não a soma: é comparando frio com quente que se
    // vê o handshake, e duas somas sobre populações de tamanhos diferentes não
    // se comparam.
    resumo.push([
      'warmup',
      `frio ${media(sv.warmupFrioMs, sv.frias)}/req em ${sv.frias}` +
        `  ·  quente ${media(sv.warmupQuenteMs, quentes)}/req em ${quentes}` +
        `  ·  query ${media(sv.queryMs, sv.respostas)}/req`,
    ]);
    resumo.push([
      'isolates',
      `${sv.boots} boots distintos, ${sv.frias} requisições frias em ${sv.respostas}`,
    ]);
  }
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
  observar: (
    fn: ((nome: string, ms: number, erro: boolean, servidor?: TemposServidor) => void) | null,
  ) => unknown,
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
  // Acumuladores do lado do servidor. `boots` é um Set porque a pergunta é
  // quantos isolates DISTINTOS atenderam — contar respostas com seq=1 sozinho
  // não distinguiria reciclagem de concorrência.
  const boots = new Set<string>();
  const srv = {
    respostas: 0, frias: 0, totalMs: 0, authMs: 0, conexaoMs: 0, queryMs: 0,
    warmupFrioMs: 0, warmupQuenteMs: 0,
  };

  observar((_nome, ms, _erro, servidor) => {
    const destino = atual ?? abrir('(sem bloco)');
    destino.requisicoes++;
    destino.ms += ms;
    totalRequisicoes++;
    if (servidor) {
      srv.respostas++;
      boots.add(servidor.boot);
      // `seq === 1` é a primeira requisição daquele isolate: é ela que paga o
      // handshake. Somar frio e quente juntos apagaria justamente a diferença
      // que a sonda existe para mostrar.
      if (servidor.seq === 1) {
        srv.frias++;
        srv.warmupFrioMs += servidor.warmupMs;
      } else {
        srv.warmupQuenteMs += servidor.warmupMs;
      }
      srv.totalMs += servidor.totalMs;
      srv.authMs += servidor.authMs;
      srv.conexaoMs += servidor.conexaoMs;
      srv.queryMs += servidor.queryMs;
    }
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
        // Sem nenhuma resposta instrumentada o campo some, e o relatório volta a
        // ser o de antes — em vez de mostrar uma linha de zeros que passaria por
        // "o servidor não custa nada".
        servidor: srv.respostas > 0 ? { ...srv, boots: boots.size } : undefined,
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
