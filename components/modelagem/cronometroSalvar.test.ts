import { describe, expect, it } from 'vitest';
import {
  criarCronometro,
  formatarMs,
  formatarRelatorio,
  type RelatorioSalvamento,
  type TemposServidor,
} from './cronometroSalvar';

/** Observador de mentira: guarda o callback para o teste disparar requisições. */
function observadorFalso() {
  let fn:
    | ((nome: string, ms: number, erro: boolean, servidor?: TemposServidor) => void)
    | null = null;
  return {
    observar: (novo: typeof fn) => {
      fn = novo;
      return null;
    },
    requisicao: (nome: string, ms: number, servidor?: TemposServidor) =>
      fn?.(nome, ms, false, servidor),
    get ligado() {
      return fn !== null;
    },
  };
}

/** Resposta do execute-sql com tempos plausíveis, para o teste não repetir seis campos. */
function resposta(boot: string, seq: number, extra: Partial<TemposServidor> = {}): TemposServidor {
  return {
    boot, seq, totalMs: 800, authMs: 500, conexaoMs: 200, warmupMs: 60, queryMs: 20, ...extra,
  };
}

describe('cronômetro do salvamento', () => {
  it('desligado, é inerte e não liga o observador do shim', () => {
    const obs = observadorFalso();
    const cron = criarCronometro(obs.observar, false);
    expect(cron.ativo).toBe(false);
    cron.bloco('premissas');
    expect(obs.ligado).toBe(false);
    const r = cron.encerrar();
    expect(r.blocos).toEqual([]);
    expect(r.totalRequisicoes).toBe(0);
  });

  it('credita cada requisição ao bloco aberto e soma tempo e contagem', () => {
    const obs = observadorFalso();
    const cron = criarCronometro(obs.observar, true);
    cron.bloco('premissas');
    obs.requisicao('updateModelagemPremissas', 142);
    cron.bloco('custos');
    obs.requisicao('createModelagemCusto', 100);
    obs.requisicao('updateModelagemCusto', 30);
    const r = cron.encerrar();
    expect(r.blocos).toEqual([
      { nome: 'premissas', requisicoes: 1, ms: 142 },
      { nome: 'custos', requisicoes: 2, ms: 130 },
    ]);
    expect(r.totalRequisicoes).toBe(3);
  });

  it('bloco repetido SOMA em vez de criar uma segunda linha', () => {
    // As parcelas de custo são gravadas num laço por custo: sem isso a tabela
    // teria trinta linhas "parcelas custo" e não diria nada.
    const obs = observadorFalso();
    const cron = criarCronometro(obs.observar, true);
    cron.bloco('parcelas custo');
    obs.requisicao('a', 10);
    cron.bloco('parcelas custo');
    obs.requisicao('b', 20);
    const r = cron.encerrar();
    expect(r.blocos).toHaveLength(1);
    expect(r.blocos[0]).toEqual({ nome: 'parcelas custo', requisicoes: 2, ms: 30 });
  });

  it('requisição antes de qualquer bloco não é perdida', () => {
    const obs = observadorFalso();
    const cron = criarCronometro(obs.observar, true);
    obs.requisicao('solta', 5);
    const r = cron.encerrar();
    expect(r.blocos[0].nome).toBe('(sem bloco)');
    expect(r.totalRequisicoes).toBe(1);
  });

  it('encerrar DESLIGA o observador — senão mediria outras telas para sempre', () => {
    const obs = observadorFalso();
    const cron = criarCronometro(obs.observar, true);
    expect(obs.ligado).toBe(true);
    cron.encerrar();
    expect(obs.ligado).toBe(false);
  });

  it('formata ms até 1s e segundos acima, como na tabela', () => {
    expect(formatarMs(142)).toBe('142 ms');
    expect(formatarMs(999)).toBe('999 ms');
    expect(formatarMs(5204)).toBe('5.2 s');
    expect(formatarMs(41_700)).toBe('41.7 s');
  });

  it('alinha a tabela em colunas e fecha com TOTAL, rede e fora', () => {
    const r: RelatorioSalvamento = {
      blocos: [
        { nome: 'premissas', requisicoes: 1, ms: 142 },
        { nome: 'custos', requisicoes: 38, ms: 5204 },
      ],
      totalRequisicoes: 312,
      totalMs: 41_700,
      totalRedeMs: 5346,
    };
    expect(formatarRelatorio(r)).toBe(
      [
        '[salvar] premissas    1 req  142 ms',
        '[salvar] custos      38 req   5.2 s',
        '[salvar] TOTAL      312 req  41.7 s',
        '[salvar] rede  5.3 s em 312 requisições',
        '[salvar] fora  36.4 s  ← 41.7 s − 5.3 s',
      ].join('\n'),
    );
  });
});

describe('rede, render e fora — as linhas que decidem', () => {
  const base: RelatorioSalvamento = {
    blocos: [{ nome: 'premissas', requisicoes: 208, ms: 38_900 }],
    totalRequisicoes: 208,
    totalMs: 41_700,
    totalRedeMs: 38_900,
  };

  it('sem medição de render, saem rede e fora — nunca a linha de render', () => {
    const linhas = formatarRelatorio(base).split('\n');
    expect(linhas).toEqual([
      '[salvar] premissas  208 req  38.9 s',
      '[salvar] TOTAL      208 req  41.7 s',
      '[salvar] rede  38.9 s em 208 requisições',
      '[salvar] fora  2.8 s  ← 41.7 s − 38.9 s',
    ]);
  });

  it('com medição, a linha de render entra entre rede e fora', () => {
    const linhas = formatarRelatorio({
      ...base,
      renders: { commits: 209, passadas: 418, ms: 6200 },
    }).split('\n');
    expect(linhas.slice(2)).toEqual([
      '[salvar] rede    38.9 s em 208 requisições',
      '[salvar] render  6.2 s em 209 commits (418 passadas)',
      '[salvar] fora    2.8 s  ← 41.7 s − 38.9 s',
    ]);
  });

  it('`fora` é o que sobra do relógio de parede depois de descontar a rede', () => {
    // O caso que a linha existe para expor: render caro (6.2 s) escondido atrás
    // da rede (fora = 0.3 s). Aqui a Etapa B economizaria quase nada.
    const linhas = formatarRelatorio({
      ...base,
      totalMs: 39_200,
      renders: { commits: 209, passadas: 418, ms: 6200 },
    }).split('\n');
    expect(linhas[linhas.length - 1]).toBe('[salvar] fora    300 ms  ← 39.2 s − 38.9 s');
  });

  it('`totalRedeMs` sai da soma dos blocos, não de uma contagem à parte', () => {
    const obs = observadorFalso();
    const cron = criarCronometro(obs.observar, true);
    cron.bloco('premissas');
    obs.requisicao('a', 142);
    cron.bloco('custos');
    obs.requisicao('b', 100);
    obs.requisicao('c', 30);
    expect(cron.encerrar().totalRedeMs).toBe(272);
  });
});

describe('tempos do servidor — a evidência da Parte 1', () => {
  it('soma o que a função relatou e conta os isolates DISTINTOS', () => {
    const obs = observadorFalso();
    const cron = criarCronometro(obs.observar, true);
    cron.bloco('premissas');
    // Três requisições, três isolates diferentes, todas na primeira requisição
    // do seu isolate: a assinatura da reciclagem.
    obs.requisicao('a', 1000, resposta('aaaa1111', 1));
    obs.requisicao('b', 1000, resposta('bbbb2222', 1));
    obs.requisicao('c', 1000, resposta('cccc3333', 1));
    const sv = cron.encerrar().servidor!;
    expect(sv).toEqual({
      respostas: 3,
      boots: 3,
      frias: 3,
      totalMs: 2400,
      authMs: 1500,
      conexaoMs: 600,
      queryMs: 60,
      warmupFrioMs: 180,
      warmupQuenteMs: 0,
    });
  });

  it('isolate reaproveitado dá UM boot e uma só requisição fria', () => {
    const obs = observadorFalso();
    const cron = criarCronometro(obs.observar, true);
    cron.bloco('premissas');
    obs.requisicao('a', 900, resposta('aaaa1111', 1));
    obs.requisicao('b', 120, resposta('aaaa1111', 2, { totalMs: 60, authMs: 1, conexaoMs: 0 }));
    obs.requisicao('c', 118, resposta('aaaa1111', 3, { totalMs: 58, authMs: 1, conexaoMs: 0 }));
    const sv = cron.encerrar().servidor!;
    expect(sv.boots).toBe(1);
    expect(sv.frias).toBe(1);
    expect(sv.respostas).toBe(3);
  });

  it('sem header nenhum, o campo some — nunca vira uma linha de zeros', () => {
    const obs = observadorFalso();
    const cron = criarCronometro(obs.observar, true);
    cron.bloco('premissas');
    obs.requisicao('a', 1000);
    const r = cron.encerrar();
    expect(r.servidor).toBeUndefined();
    expect(formatarRelatorio(r)).not.toContain('servidor');
  });

  it('as linhas de servidor e isolates entram entre rede e fora', () => {
    const linhas = formatarRelatorio({
      blocos: [{ nome: 'premissas', requisicoes: 118, ms: 122_500 }],
      totalRequisicoes: 118,
      totalMs: 122_500,
      totalRedeMs: 122_500,
      servidor: {
        respostas: 118,
        boots: 118,
        frias: 118,
        totalMs: 94_400,
        authMs: 5200,
        conexaoMs: 5500,
        queryMs: 2400,
        warmupFrioMs: 81_300,
        warmupQuenteMs: 0,
      },
    }).split('\n');
    expect(linhas.slice(2)).toEqual([
      '[salvar] rede      122.5 s em 118 requisições',
      '[salvar] servidor  94.4 s em 118 respostas  (auth 5.2 s · conexão 5.5 s · warmup 81.3 s · query 2.4 s)',
      '[salvar] warmup    frio 689 ms/req em 118  ·  quente —/req em 0  ·  query 20 ms/req',
      '[salvar] isolates  118 boots distintos, 118 requisições frias em 118',
      '[salvar] fora      0 ms  ← 122.5 s − 122.5 s',
    ]);
  });
});

describe('warmup frio × quente — a sonda de handshake', () => {
  it('separa a primeira requisição do isolate das seguintes', () => {
    const obs = observadorFalso();
    const cron = criarCronometro(obs.observar, true);
    cron.bloco('premissas');
    // Assinatura do handshake: o SELECT 1 da requisição fria custa centenas de
    // ms, o da quente custa unidades, e a query real é barata nas duas.
    obs.requisicao('a', 900, resposta('aaaa', 1, { warmupMs: 712, queryMs: 9 }));
    obs.requisicao('b', 130, resposta('aaaa', 2, { warmupMs: 3, queryMs: 8 }));
    obs.requisicao('c', 940, resposta('bbbb', 1, { warmupMs: 745, queryMs: 11 }));
    const sv = cron.encerrar().servidor!;
    expect(sv.warmupFrioMs).toBe(1457);
    expect(sv.warmupQuenteMs).toBe(3);
    expect(sv.frias).toBe(2);
    expect(sv.queryMs).toBe(28);
  });

  it('sem requisição quente, a média quente sai como travessão e não como zero', () => {
    // Zero leria como "o warmup quente é grátis"; travessão diz "não houve
    // amostra". Com 109 de 118 frias, essa distinção é a leitura inteira.
    const texto = formatarRelatorio({
      blocos: [{ nome: 'x', requisicoes: 1, ms: 900 }],
      totalRequisicoes: 1,
      totalMs: 900,
      totalRedeMs: 900,
      servidor: {
        respostas: 1, boots: 1, frias: 1, totalMs: 800, authMs: 40,
        conexaoMs: 45, queryMs: 9, warmupFrioMs: 700, warmupQuenteMs: 0,
      },
    });
    expect(texto).toContain('quente —/req em 0');
    expect(texto).toContain('frio 700 ms/req em 1');
  });
});
