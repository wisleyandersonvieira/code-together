import { describe, expect, it } from 'vitest';
import { numeroSql, numeroSqlOuNulo, percentuaisInteiros } from './numeroSql';

describe('coerção de número vindo do Postgres', () => {
  it('aceita number e string — DECIMAL chega como string', () => {
    expect(numeroSql(1234.56)).toBe(1234.56);
    expect(numeroSql('1234.56')).toBe(1234.56);
    expect(numeroSql('-88669.98')).toBe(-88669.98);
    expect(numeroSql('0')).toBe(0);
  });

  it('devolve 0 para o que não é número', () => {
    expect(numeroSql(null)).toBe(0);
    expect(numeroSql(undefined)).toBe(0);
    expect(numeroSql('')).toBe(0);
    expect(numeroSql('abc')).toBe(0);
    expect(numeroSql(NaN)).toBe(0);
    expect(numeroSql({})).toBe(0);
  });

  // O bug que a coerção existe para evitar: sem ela, "100" + "200" = "100200".
  it('soma como número, não como texto', () => {
    const contas = [{ saldo: '100.50' }, { saldo: '200.25' }, { saldo: '-50' }];
    const total = contas.reduce((a, c) => a + numeroSql(c.saldo), 0);
    expect(total).toBeCloseTo(250.75, 10);
  });

  it('numeroSqlOuNulo preserva a ausência', () => {
    expect(numeroSqlOuNulo(null)).toBeNull();
    expect(numeroSqlOuNulo(undefined)).toBeNull();
    expect(numeroSqlOuNulo('')).toBeNull();
    expect(numeroSqlOuNulo('0')).toBe(0);
    expect(numeroSqlOuNulo(0)).toBe(0);
  });
});

describe('percentuais do donut', () => {
  it('sempre somam exatamente 100', () => {
    const casos = [
      [1, 1, 1],
      [3, 3, 3, 1],
      [7, 11, 2],
      [5],
      [1, 2, 3, 4, 5, 6, 7],
      Array(11).fill(10),
      [1, 1, 1, 1, 1, 1],
      [999, 1],
    ];
    for (const caso of casos) {
      const p = percentuaisInteiros(caso);
      expect(p.reduce((a, b) => a + b, 0), JSON.stringify(caso)).toBe(100);
      expect(p).toHaveLength(caso.length);
    }
  });

  it('total zero devolve zeros, não NaN', () => {
    expect(percentuaisInteiros([0, 0, 0])).toEqual([0, 0, 0]);
    expect(percentuaisInteiros([])).toEqual([]);
  });

  it('mantém a ordem de entrada', () => {
    expect(percentuaisInteiros([50, 25, 25])).toEqual([50, 25, 25]);
  });
});
