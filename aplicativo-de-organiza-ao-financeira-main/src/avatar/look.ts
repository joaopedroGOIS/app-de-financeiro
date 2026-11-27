import type { State } from '../data'
import { DEFAULT_EQUIPPED } from '../cosmetics'
import type { AvatarLook } from './pixelArt'

/** Aparência atual: cores escolhidas pelo jogador + itens equipados (na fase 1, os gratuitos). */
export function lookFor(state: Pick<State, 'avatar'>, override: Partial<AvatarLook> = {}): AvatarLook {
  return {
    skin: state.avatar?.skin ?? 1,
    hairColor: state.avatar?.hairColor ?? 0,
    hair: DEFAULT_EQUIPPED.hair,
    outfit: DEFAULT_EQUIPPED.outfit,
    hat: DEFAULT_EQUIPPED.hat,
    accessory: DEFAULT_EQUIPPED.accessory,
    ...override,
  }
}
