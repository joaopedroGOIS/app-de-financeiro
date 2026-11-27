/* ==========================================================================
   Catálogo de cosméticos aprovado em 26/11/2026 (documento "Proposta: Perfil,
   pets e Lojinha"). Itens são estritamente visuais: nunca dão XP, desconto ou
   vantagem. Na fase 1 nada é comprado; a Lojinha aparece como vitrine.
   ========================================================================== */
import type { OutfitColors } from './avatar/pixelArt'

export type CosmeticSlot = 'hair' | 'outfit' | 'hat' | 'accessory' | 'companion' | 'theme' | 'frame' | 'title'
export type Rarity = 'padrao' | 'raro' | 'extra' | 'mitico' | 'lendario'
export type Requirement = { kind: 'streak'; days: number } | { kind: 'mission'; code: string; name: string }
export type ThemeColors = { top: string; bottom: string; inner: string }
export type CosmeticItem = {
  id: string
  slot: CosmeticSlot
  name: string
  rarity: Rarity
  /** Preço em Graninhas; 0 = grátis; null = só por conquista. */
  price: number | null
  requirement?: Requirement
  colors?: OutfitColors
  sprite?: string
  theme?: ThemeColors
  frame?: string
}

export const SLOT_LABELS: Record<CosmeticSlot, string> = {
  hair: 'Cabelo', outfit: 'Roupa', hat: 'Chapéu', accessory: 'Acessório', companion: 'Companheiro', theme: 'Tema', frame: 'Moldura', title: 'Título',
}
export const SLOT_ORDER: CosmeticSlot[] = ['hair', 'outfit', 'hat', 'accessory', 'companion', 'theme', 'frame', 'title']
export const RARITY_LABELS: Record<Rarity, string> = { padrao: 'Padrão', raro: 'Raro', extra: 'Extra Raro', mitico: 'Mítico', lendario: 'Lendário' }
export const RARITY_ORDER: Rarity[] = ['padrao', 'raro', 'extra', 'mitico', 'lendario']

export const COSMETICS: CosmeticItem[] = [
  { id: 'hair-short', slot: 'hair', name: 'Corte curto', rarity: 'padrao', price: 0 },
  { id: 'hair-bun', slot: 'hair', name: 'Coque', rarity: 'padrao', price: 50 },
  { id: 'hair-long', slot: 'hair', name: 'Cabelo longo', rarity: 'padrao', price: 50 },
  { id: 'hair-mohawk', slot: 'hair', name: 'Moicano', rarity: 'padrao', price: 70 },

  { id: 'outfit-tunic', slot: 'outfit', name: 'Túnica simples', rarity: 'padrao', price: 0, colors: { t: '#4b7bd8', u: '#345fb0', p: '#3a2d55', b: '#5a3b22' } },
  { id: 'outfit-ranger', slot: 'outfit', name: 'Roupa de patrulheiro', rarity: 'padrao', price: 60, colors: { t: '#3f9b5a', u: '#2b7343', p: '#5a3b22', b: '#3a2615' } },
  { id: 'outfit-mage', slot: 'outfit', name: 'Manto do mago', rarity: 'raro', price: 180, colors: { t: '#6a46f0', u: '#ffc94a', p: '#4b2fc0', b: '#2a1866' } },
  { id: 'outfit-goose', slot: 'outfit', name: 'Fantasia de ganso', rarity: 'raro', price: 220, colors: { t: '#fff6e0', u: '#d9cfc0', p: '#f39c34', b: '#f39c34' } },
  { id: 'outfit-knight', slot: 'outfit', name: 'Armadura de cavaleiro', rarity: 'extra', price: 450, colors: { t: '#cfc8e6', u: '#8f88a8', p: '#6f6888', b: '#4a4560' } },
  { id: 'outfit-stellar', slot: 'outfit', name: 'Armadura estelar', rarity: 'mitico', price: 850, colors: { t: '#26306e', u: '#ffc94a', p: '#1a2152', b: '#ffc94a' } },
  { id: 'outfit-royal', slot: 'outfit', name: 'Traje real', rarity: 'lendario', price: null, requirement: { kind: 'streak', days: 100 }, colors: { t: '#b8233f', u: '#ffc94a', p: '#7d1229', b: '#d98a1c' } },

  { id: 'hat-none', slot: 'hat', name: 'Sem chapéu', rarity: 'padrao', price: 0 },
  { id: 'hat-cap', slot: 'hat', name: 'Boné vermelho', rarity: 'padrao', price: 60 },
  { id: 'hat-wizard', slot: 'hat', name: 'Chapéu de mago', rarity: 'raro', price: 200 },
  { id: 'hat-helmet', slot: 'hat', name: 'Elmo de prata', rarity: 'extra', price: 400 },
  { id: 'hat-crown', slot: 'hat', name: 'Coroa da constância', rarity: 'lendario', price: null, requirement: { kind: 'streak', days: 30 } },

  { id: 'acc-none', slot: 'accessory', name: 'Sem acessório', rarity: 'padrao', price: 0 },
  { id: 'acc-glasses', slot: 'accessory', name: 'Óculos de leitura', rarity: 'padrao', price: 40 },
  { id: 'acc-scarf', slot: 'accessory', name: 'Cachecol', rarity: 'padrao', price: 60 },
  { id: 'acc-cape', slot: 'accessory', name: 'Capa carmesim', rarity: 'raro', price: 250 },
  { id: 'acc-wings', slot: 'accessory', name: 'Asas de cristal', rarity: 'mitico', price: 800 },

  { id: 'pet-none', slot: 'companion', name: 'Sem companheiro', rarity: 'padrao', price: 0 },
  { id: 'pet-slime', slot: 'companion', name: 'Slime verde', rarity: 'padrao', price: 80, sprite: 'slime' },
  { id: 'pet-cat', slot: 'companion', name: 'Gato de rua', rarity: 'raro', price: 180, sprite: 'cat' },
  { id: 'pet-goose', slot: 'companion', name: 'Ganso companheiro', rarity: 'extra', price: 500, sprite: 'goose' },
  { id: 'pet-phoenix', slot: 'companion', name: 'Fênix de brasa', rarity: 'mitico', price: 900, sprite: 'phoenix' },
  { id: 'pet-dragon', slot: 'companion', name: 'Dragão do controle', rarity: 'lendario', price: null, requirement: { kind: 'mission', code: 'control_master', name: 'Mestre do Controle' }, sprite: 'dragon' },

  { id: 'theme-night', slot: 'theme', name: 'Noite roxa', rarity: 'padrao', price: 0, theme: { top: '#2c2068', bottom: '#17103c', inner: '#5a47c8' } },
  { id: 'theme-forest', slot: 'theme', name: 'Floresta encantada', rarity: 'raro', price: 150, theme: { top: '#1f5134', bottom: '#0d281a', inner: '#3f9b5a' } },
  { id: 'theme-ocean', slot: 'theme', name: 'Mar profundo', rarity: 'raro', price: 150, theme: { top: '#1b4a7a', bottom: '#0b223c', inner: '#3d7fd0' } },
  { id: 'theme-ember', slot: 'theme', name: 'Forja em brasa', rarity: 'extra', price: 400, theme: { top: '#6b2318', bottom: '#330f0a', inner: '#d0573a' } },
  { id: 'theme-aurora', slot: 'theme', name: 'Aurora boreal', rarity: 'mitico', price: 750, theme: { top: '#1d5b5a', bottom: '#2a1858', inner: '#5ef0b0' } },
  { id: 'theme-royal', slot: 'theme', name: 'Tesouro real', rarity: 'lendario', price: null, requirement: { kind: 'streak', days: 365 }, theme: { top: '#5c4410', bottom: '#2a1e06', inner: '#c9962a' } },

  { id: 'frame-classic', slot: 'frame', name: 'Moldura clássica', rarity: 'padrao', price: 0, frame: '#ece7ff' },
  { id: 'frame-mint', slot: 'frame', name: 'Moldura menta', rarity: 'padrao', price: 80, frame: '#c9fff0' },
  { id: 'frame-crimson', slot: 'frame', name: 'Moldura carmesim', rarity: 'raro', price: 160, frame: '#ffc2cc' },
  { id: 'frame-gold', slot: 'frame', name: 'Moldura dourada', rarity: 'extra', price: 420, frame: '#ffe08a' },

  { id: 'title-adventurer', slot: 'title', name: 'Aventureiro', rarity: 'padrao', price: 0 },
  { id: 'title-thrifty', slot: 'title', name: 'O Econômico', rarity: 'padrao', price: 40 },
  { id: 'title-sheets', slot: 'title', name: 'Mestre das Planilhas', rarity: 'raro', price: 150 },
  { id: 'title-archmage', slot: 'title', name: 'Arquimago das Finanças', rarity: 'mitico', price: 700 },
]

export const cosmetic = (id: string) => COSMETICS.find(item => item.id === id) ?? COSMETICS[0]
export const outfitColors = (id: string): OutfitColors => cosmetic(id).colors ?? cosmetic('outfit-tunic').colors!

/** Itens equipados na fase 1: só os gratuitos (sem compras ainda). */
export const DEFAULT_EQUIPPED: Record<CosmeticSlot, string> = {
  hair: 'hair-short', outfit: 'outfit-tunic', hat: 'hat-none', accessory: 'acc-none', companion: 'pet-none', theme: 'theme-night', frame: 'frame-classic', title: 'title-adventurer',
}
/** Itens "Sem chapéu", "Sem acessório" e "Sem companheiro" são opções, não itens de vitrine. */
export const isPlaceholder = (item: CosmeticItem) => item.id.endsWith('-none')
