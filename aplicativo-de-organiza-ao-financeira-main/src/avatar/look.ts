import type { State } from '../data'
import { DEFAULT_EQUIPPED, cosmetic } from '../cosmetics'
import type { CosmeticSlot } from '../cosmetics'
import type { AvatarLook } from './pixelArt'

/** Item equipado num espaço: o que o servidor confirmou, ou o item inicial gratuito. */
export function equippedOf(state: Pick<State, 'cosmetics'>, slot: CosmeticSlot): string {
  const id = state.cosmetics?.equipped?.[slot]
  return id && cosmetic(id).id === id && cosmetic(id).slot === slot ? id : DEFAULT_EQUIPPED[slot]
}

/** Aparência atual: cores escolhidas pelo jogador + itens equipados. */
export function lookFor(state: Pick<State, 'avatar' | 'cosmetics'>, override: Partial<AvatarLook> = {}): AvatarLook {
  return {
    skin: state.avatar?.skin ?? 1,
    hairColor: state.avatar?.hairColor ?? 0,
    hair: equippedOf(state, 'hair'),
    outfit: equippedOf(state, 'outfit'),
    hat: equippedOf(state, 'hat'),
    accessory: equippedOf(state, 'accessory'),
    ...override,
  }
}

/** O que o jogador pode equipar: itens grátis e os que estão no inventário. */
export function ownsItem(state: Pick<State, 'cosmetics'>, id: string): boolean {
  const item = cosmetic(id)
  return item.id === id && (item.price === 0 || !!state.cosmetics?.owned.includes(id))
}
