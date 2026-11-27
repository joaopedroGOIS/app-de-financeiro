import { buildAvatar, buildPet } from './pixelArt'
import type { AvatarLook, PixelBuf } from './pixelArt'
import { outfitColors } from '../cosmetics'

/* Desenha a grade de pixels como SVG: nítido em qualquer escala e compatível com SSR e testes. */
const cache = new Map<string, { color: string; d: string }[]>()
function paths(key: string, make: () => PixelBuf | null) {
  const hit = cache.get(key)
  if (hit) return hit
  const buf = make()
  const byColor = new Map<string, string>()
  if (buf) buf.px.forEach((color, i) => {
    if (color) byColor.set(color, `${byColor.get(color) ?? ''}M${i % buf.w} ${Math.floor(i / buf.w)}h1v1h-1z`)
  })
  const result = [...byColor].map(([color, d]) => ({ color, d }))
  cache.set(key, result)
  return result
}

export type AvatarAppearance = { skin: number; hairColor: number }
export const DEFAULT_APPEARANCE: AvatarAppearance = { skin: 1, hairColor: 0 }

/** `portrait` recorta só a cabeça (para o topo e o menu). */
export function AvatarFigure({ look, scale = 3, className = '', label, portrait = false }: { look: AvatarLook; scale?: number; className?: string; label?: string; portrait?: boolean }) {
  const key = [look.skin, look.hairColor, look.hair, look.outfit, look.hat, look.accessory].join('|')
  return (
    <svg className={`pixel-avatar ${portrait ? 'portrait' : ''} ${className}`.trim()} width={Math.round((portrait ? 18 : 26) * scale)} height={Math.round((portrait ? 18 : 37) * scale)} viewBox={portrait ? '4 3 18 18' : '0 0 26 37'} shapeRendering="crispEdges"
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      {paths(`avatar:${key}`, () => buildAvatar(look, outfitColors)).map(part => <path key={part.color} fill={part.color} d={part.d} />)}
    </svg>
  )
}

export function PetFigure({ sprite, scale = 4, className = '', label }: { sprite: string; scale?: number; className?: string; label?: string }) {
  return (
    <svg className={`pixel-pet ${className}`.trim()} width={Math.round(18 * scale)} height={Math.round(18 * scale)} viewBox="0 0 18 18" shapeRendering="crispEdges"
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      {paths(`pet:${sprite}`, () => buildPet(sprite)).map(part => <path key={part.color} fill={part.color} d={part.d} />)}
    </svg>
  )
}
