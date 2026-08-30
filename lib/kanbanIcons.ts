/**
 * Catálogo fechado de ícones das colunas do Kanban.
 *
 * Fechado de propósito: `(LucideIcons as any)[nome]` importaria a biblioteca
 * inteira, mataria o tree-shaking e colocaria centenas de KB no bundle. Aqui só
 * entra no bundle o que está importado nominalmente abaixo.
 *
 * As chaves são os nomes reais do lucide-react — é o que a coluna
 * `kanban_columns.icon` promete guardar. Um nome que saia deste mapa (ícone
 * renomeado, coluna antiga) cai no padrão sem quebrar a tela.
 */
import {
  AlertTriangle,
  BadgeCheck,
  Blocks,
  Building2,
  CalendarClock,
  CircleDashed,
  ClipboardCheck,
  ClipboardList,
  Construction,
  DollarSign,
  Droplets,
  FileCheck,
  FileSignature,
  Flag,
  Hammer,
  Handshake,
  HardHat,
  Home,
  KeyRound,
  Landmark,
  Layers,
  Map,
  PackageCheck,
  PaintRoller,
  Pickaxe,
  Receipt,
  Ruler,
  ShieldCheck,
  Sofa,
  Sparkles,
  TreePine,
  Trophy,
  Truck,
  Wallpaper,
  Wrench,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Ordem do mapa = ordem da grade no seletor: segue o ciclo da incorporação. */
export const ICONES_KANBAN = {
  ClipboardList,
  FileCheck,
  FileSignature,
  Ruler,
  Landmark,
  Map,
  TreePine,
  HardHat,
  Pickaxe,
  Construction,
  Layers,
  Blocks,
  Hammer,
  Wrench,
  Zap,
  Droplets,
  PaintRoller,
  Wallpaper,
  Sofa,
  Sparkles,
  ClipboardCheck,
  ShieldCheck,
  BadgeCheck,
  KeyRound,
  Home,
  Building2,
  PackageCheck,
  Truck,
  Handshake,
  DollarSign,
  Receipt,
  CalendarClock,
  AlertTriangle,
  Flag,
  Trophy,
} satisfies Record<string, LucideIcon>;

export type NomeIconeKanban = keyof typeof ICONES_KANBAN;

/** Usado quando a coluna não tem ícone ou tem um nome fora do mapa. */
export const ICONE_PADRAO = CircleDashed;

/**
 * Rótulo em português de cada ícone. Serve para a busca do seletor e para o
 * `title` do botão — ninguém procura "PaintRoller" quando quer "pintura".
 */
export const ROTULOS_ICONES: Record<NomeIconeKanban, string> = {
  ClipboardList: 'Backlog',
  FileCheck: 'Aprovação',
  FileSignature: 'Contrato',
  Ruler: 'Projeto',
  Landmark: 'Licenças',
  Map: 'Terreno',
  TreePine: 'Terraplenagem',
  HardHat: 'Canteiro',
  Pickaxe: 'Fundação',
  Construction: 'Obra',
  Layers: 'Estrutura',
  Blocks: 'Alvenaria',
  Hammer: 'Execução',
  Wrench: 'Instalações',
  Zap: 'Elétrica',
  Droplets: 'Hidráulica',
  PaintRoller: 'Pintura',
  Wallpaper: 'Revestimento',
  Sofa: 'Mobiliário',
  Sparkles: 'Acabamento',
  ClipboardCheck: 'Vistoria',
  ShieldCheck: 'Qualidade',
  BadgeCheck: 'Habite-se',
  KeyRound: 'Chaves',
  Home: 'Entrega',
  Building2: 'Empreendimento',
  PackageCheck: 'Entregue',
  Truck: 'Logística',
  Handshake: 'Venda',
  DollarSign: 'Financeiro',
  Receipt: 'Faturamento',
  CalendarClock: 'Prazo',
  AlertTriangle: 'Atraso',
  Flag: 'Marco',
  Trophy: 'Concluído',
};

export const NOMES_ICONES = Object.keys(ICONES_KANBAN) as NomeIconeKanban[];

/** Resolve o nome guardado no banco. Nome ausente ou desconhecido → padrão. */
export function iconeDaColuna(nome?: string | null): LucideIcon {
  return (nome && ICONES_KANBAN[nome as NomeIconeKanban]) || ICONE_PADRAO;
}

/** Filtro do campo de busca: casa com o nome lucide ou com o rótulo em pt-BR. */
export function buscarIcones(termo: string): NomeIconeKanban[] {
  const t = termo
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!t) return NOMES_ICONES;
  return NOMES_ICONES.filter((nome) => {
    const rotulo = ROTULOS_ICONES[nome]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return nome.toLowerCase().includes(t) || rotulo.includes(t);
  });
}
