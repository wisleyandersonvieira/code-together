import { describe, expect, it } from 'vitest';
import {
  criarCronometro,
  formatarMs,
  formatarRelatorio,
  type RelatorioSalvamento,
} from './cronometroSalvar';

/** Observador de mentira: guarda o callback para o teste disparar requisições. */
function observadorFalso() {
  let fn: ((nome: string, ms: number, erro: boolean) => void) | null = null;
  return {
    observar: (novo: typeof fn) => {
      fn = novo;
      return null;
    },
    requisicao: (nome: string, ms: number) => fn?.(nome, ms, false),
    get ligado() {
      return fn !== null;
    },
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
