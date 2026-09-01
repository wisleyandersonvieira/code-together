/**
 * Gera, em disco e temporariamente, o motor ANTERIOR à correção da base do fee.
 *
 * Existe para uma coisa só: o relatório de impacto precisa rodar `calcular` com
 * a fórmula antiga e com a nova sobre o MESMO input, e não há migration nem
 * flag de configuração que permita pedir a antiga em runtime — a correção vale
 * para todas as modelagens, sem opção.
 *
 * Em vez de manter uma segunda cópia do motor apodrecendo no repositório, o
 * arquivo é derivado do próprio `motor.ts` por substituição textual e apagado no
 * fim. Se o trecho substituído deixar de existir, a geração FALHA em vez de
 * devolver em silêncio um "motor antigo" que na verdade é o novo — que é o único
 * jeito de o relatório mentir.
 *
 * O arquivo gerado mora em `lib/modelagem/` porque o motor importa `./tipos`,
 * `./conferencias` e `./indicadores` por caminho relativo.
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const MOTOR = join(RAIZ, 'lib/modelagem/motor.ts');
export const GERADO = join(RAIZ, 'lib/modelagem/motor-antigo.gerado.ts');

/** O bloco NOVO, exatamente como está em `motor.ts`. */
const NOVO = `    const picoSaldoDevedor = meses.length ? Math.max(...meses.map((x) => x.saldoDevedor)) : 0;
    const novoFee = baseFeeEstruturacao(picoSaldoDevedor) * (fin.feeEstruturacaoPct || 0);`;

/** O bloco ANTIGO: o fee sobre o total desembolsado. */
const ANTIGO = `    const dividaSacadaParaFee = soma(meses.map((x) => x.draw + x.saqueReservaJuros));
    const novoFee = dividaSacadaParaFee * (fin.feeEstruturacaoPct || 0);`;

/** Idem para a base registrada na apuração, que a fórmula antiga não tinha. */
const NOVO_BASE = `  const baseFee = baseFeeEstruturacao(saldoDevedorMaximo);`;
const ANTIGO_BASE = `  const baseFee = dividaSacada;`;

export function gerarMotorAntigo(): string {
  const fonte = readFileSync(MOTOR, 'utf8');
  if (!fonte.includes(NOVO) || !fonte.includes(NOVO_BASE)) {
    throw new Error(
      'motorAntigo: o trecho do fee mudou em motor.ts e a substituição não bate mais. ' +
        'Atualize as constantes NOVO/NOVO_BASE — sem isso o relatório compararia o motor novo consigo mesmo.',
    );
  }
  const antigo = fonte.replace(NOVO, ANTIGO).replace(NOVO_BASE, ANTIGO_BASE);
  writeFileSync(GERADO, antigo, 'utf8');
  return GERADO;
}

export function apagarMotorAntigo() {
  if (existsSync(GERADO)) unlinkSync(GERADO);
}
