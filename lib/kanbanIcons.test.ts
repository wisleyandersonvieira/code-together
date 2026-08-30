import { describe, expect, it } from 'vitest';
import {
  ICONES_KANBAN,
  ICONE_PADRAO,
  NOMES_ICONES,
  ROTULOS_ICONES,
  buscarIcones,
  iconeDaColuna,
} from './kanbanIcons';

describe('catálogo de ícones do Kanban', () => {
  it('tem entre 24 e 36 ícones, todos com rótulo', () => {
    expect(NOMES_ICONES.length).toBeGreaterThanOrEqual(24);
    expect(NOMES_ICONES.length).toBeLessThanOrEqual(36);
    for (const nome of NOMES_ICONES) {
      expect(ROTULOS_ICONES[nome], `sem rótulo: ${nome}`).toBeTruthy();
    }
  });

  it('resolve um nome válido para o ícone do mapa', () => {
    expect(iconeDaColuna('Hammer')).toBe(ICONES_KANBAN.Hammer);
    expect(iconeDaColuna('KeyRound')).toBe(ICONES_KANBAN.KeyRound);
  });

  // Este é o caso que a coluna `icon` NULL exercita em produção.
  it('cai no padrão para NULL, vazio ou nome fora do mapa', () => {
    expect(iconeDaColuna(null)).toBe(ICONE_PADRAO);
    expect(iconeDaColuna(undefined)).toBe(ICONE_PADRAO);
    expect(iconeDaColuna('')).toBe(ICONE_PADRAO);
    expect(iconeDaColuna('IconeQueNaoExiste')).toBe(ICONE_PADRAO);
    // Nome de ícone lucide real, mas fora do catálogo fechado.
    expect(iconeDaColuna('Airplay')).toBe(ICONE_PADRAO);
  });

  it('nunca devolve undefined — a tela não pode renderizar <undefined />', () => {
    for (const entrada of [null, undefined, '', ' ', 'x', 'constructor', '__proto__', 'toString']) {
      expect(typeof iconeDaColuna(entrada as string | null)).not.toBe('undefined');
      expect(iconeDaColuna(entrada as string | null)).toBeTruthy();
    }
  });

  it('busca por nome lucide e por rótulo em português, sem acento', () => {
    expect(buscarIcones('hammer')).toContain('Hammer');
    expect(buscarIcones('pintura')).toContain('PaintRoller');
    expect(buscarIcones('eletrica')).toContain('Zap');
    expect(buscarIcones('elétrica')).toContain('Zap');
    expect(buscarIcones('')).toHaveLength(NOMES_ICONES.length);
    expect(buscarIcones('zzzzz')).toHaveLength(0);
  });
});
