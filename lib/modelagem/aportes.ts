/**
 * Operações puras sobre o plano de aportes.
 *
 * Existem aqui, e não dentro do componente, por um motivo específico: a linha
 * `equity_call` do fluxo de caixa e a aba Aportes são duas interfaces para a
 * MESMA fonte. A regra de qual das duas grava o quê não pode morar em nenhuma das
 * duas telas — se morasse, as duas precisariam se sincronizar, que é exatamente o
 * que este módulo não faz. Sendo função pura, também dá para testar sem DOM.
 */
import type { AporteParcela, ChaveOverride, ModelInput, ModelOutput, PlanoAportes } from './tipos';

/** Plano de uma modelagem que nunca teve plano: reproduz o comportamento antigo. */
export const PLANO_NEUTRO: PlanoAportes = {
  modoAporte: 'demanda',
  aporteBaseTotal: 0,
  valorTotalAlvo: 0,
  parcelas: [],
  // 'participacao' é o default do banco (migration 1763100000) e o rateio de
  // sempre: capital repartido pela participação de cada sócio.
  regraRateioCapital: 'participacao',
};

/** Arredonda para centavo. Usado só onde o valor vai virar input gravado. */
const centavos = (v: number) => Math.round(v * 100) / 100;

const ordenar = (parcelas: AporteParcela[]) => [...parcelas].sort((a, b) => a.mes - b.mes);

/**
 * Uma edição naquela célula do fluxo vira parcela do plano, ou override?
 *
 * Só a linha de aporte, e só com o plano ligado. Manter override E parcela ativos
 * na mesma célula seria criar duas fontes para o mesmo número.
 */
export function editaPlanoDeAportes(input: ModelInput, linha: ChaveOverride): boolean {
  if (linha !== 'equity_call') return false;
  // Com cronograma por sócio a célula não é editável por NENHUM dos dois
  // caminhos: nem parcela, nem override. O valor do mês é a soma de aportes
  // atribuídos a sócios nomeados, e um número digitado no fluxo não diz de quem
  // é — atribuí-lo seria inventar dado. Ver `aporteSociosPorMes` no motor.
  if (input.aportes?.regraRateioCapital === 'cronograma_socio') return false;
  return input.aportes?.modoAporte === 'plano';
}

/**
 * A célula de aporte do fluxo é somente leitura?
 *
 * Existe separada de `editaPlanoDeAportes` porque as duas respondem perguntas
 * diferentes: aquela diz PARA ONDE vai a edição, esta diz se há edição possível.
 * Sem ela, a tela teria de repetir a regra — e as duas divergiriam na primeira
 * mudança.
 */
export function aporteSomenteLeitura(input: ModelInput, linha: ChaveOverride): boolean {
  return linha === 'equity_call' && input.aportes?.regraRateioCapital === 'cronograma_socio';
}

/** A frase única para o caso acima: a tela e o toast dizem a MESMA coisa. */
export const AVISO_APORTE_POR_SOCIO = 'Aporte definido por sócio. Edite na aba Sócios.';

/**
 * Lança o valor do mês como parcela. Não cria, não remove e não toca em override
 * nenhum — é essa a diferença entre editar o plano e editar a célula.
 *
 * `null` na célula do fluxo significa "vazio"; como parcela, isso é uma parcela
 * de zero, porque parcela ausente e parcela zerada já produzem o mesmo aporte.
 */
export function comParcelaNoMes(input: ModelInput, mes: number, valor: number | null): ModelInput {
  const plano = input.aportes ?? PLANO_NEUTRO;
  const parcelas = plano.parcelas ?? [];
  const novoValor = valor ?? 0;
  const existe = parcelas.some((p) => p.mes === mes);
  return {
    ...input,
    aportes: {
      ...plano,
      parcelas: ordenar(
        existe
          ? parcelas.map((p) => (p.mes === mes ? { ...p, valor: novoValor } : p))
          : [...parcelas, { mes, valor: novoValor }],
      ),
    },
  };
}

/** Remove a parcela do mês. Overrides seguem intactos, pelo mesmo motivo. */
export function semParcelaNoMes(input: ModelInput, mes: number): ModelInput {
  const plano = input.aportes ?? PLANO_NEUTRO;
  return {
    ...input,
    aportes: { ...plano, parcelas: (plano.parcelas ?? []).filter((p) => p.mes !== mes) },
  };
}

/**
 * Converte a curva que o motor calculou em parcelas do plano.
 *
 * A conversão tem de ser fiel ao centavo: recalcular a modelagem com o plano
 * resultante, em modo 'plano', devolve o mesmo fluxo de antes. Meses sem chamada
 * de capital não viram parcela — no modo plano, mês sem parcela já é zero.
 */
export function curvaComoParcelas(resultado: ModelOutput): AporteParcela[] {
  return resultado.meses
    .filter((m) => Math.abs(m.equityCall) > 0.005)
    .map((m) => ({ mes: m.mes, valor: centavos(m.equityCall) }));
}
