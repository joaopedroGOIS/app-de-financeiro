/* Ícones em pixel art 12x12 da prévia RPG, desenhados como SVG (nítidos e compatíveis com SSR). */
const PALETTE: Record<string, string> = { k: '#1a0f2e', w: '#fff6e0', r: '#ff4d6d', y: '#ffc94a', o: '#d98a1c', s: '#cfc8e6', v: '#7b5cff', l: '#b7a6ff', p: '#f3e2b8', d: '#8a5a2b', i: '#6b4a2a', b: '#b5733a', g: '#a89f94' }

export const PIXEL_SPRITES = {
  heart: ['............', '..kk....kk..', '.krrk..krrk.', 'krwrrkkrrrrk', 'krrrrrrrrrrk', 'krrrrrrrrrrk', '.krrrrrrrrk.', '..krrrrrrk..', '...krrrrk...', '....krrk....', '.....kk.....', '............'],
  coin: ['....kkkk....', '..kkyyyykk..', '.kyywyyyyok.', '.kywyooyyok.', 'kyyyoyyoyyok', 'kyyyoyyyyyok', 'kyyyoyyyyyok', 'kyyyoyyoyyok', '.kyyyooyyok.', '.koyyyyyook.', '..kkooookk..', '....kkkk....'],
  shield: ['.kkkkkkkkkk.', 'kssssssssssk', 'ksvvvvvvvvsk', 'ksvlvvyyvvsk', 'ksvlvyyyyvsk', 'ksvvvvyyvvsk', 'ksvvvvyyvvsk', '.ksvvvvvvsk.', '.ksvvvvvvsk.', '..ksvvvvsk..', '...kssssk...', '....kkkk....'],
  flame: ['.....kk.....', '....kook....', '...koook.k..', '...koroookk.', '..korroooook', '.korrrooyok.', '.korryyyyok.', 'korryyyyyrok', 'korrywwyyrok', '.koryyyyrok.', '..koooooook.', '...kkkkkk...'],
  star: ['.....kk.....', '....kyyk....', '....kwyk....', 'kkkkkwyykkkk', 'kyyyywyyyyok', '.kyyyyyyyok.', '..kyyyyyyk..', '..kyyyyyok..', '.kyyyokyyok.', '.kyok..kyok.', '.kok....kok.', '.kk......kk.'],
  scroll: ['.kkkkkkkkkk.', 'kdpppppppppk', '.kpppppppdk.', '.kpiiiiippk.', '.kppppppppk.', '.kpiiiipppk.', '.kppppppppk.', '.kpiiiiippk.', '.kppppppppk.', '.kpppppppdk.', 'kdpppppppppk', '.kkkkkkkkkk.'],
  chest: ['............', '..kkkkkkkk..', '.kbbbbbbbbk.', 'kbwbbbbbbbbk', 'kddddyyddddk', 'kkkkkyykkkkk', 'kbbbbyybbbbk', 'kbbbbkkbbbbk', 'kbbbbbbbbbbk', 'kddddddddddk', 'kkkkkkkkkkkk', '............'],
  skull: ['...kkkkkk...', '..kwwwwwwk..', '.kwwwwwwwwk.', 'kwwwwwwwwwgk', 'kwkkwwwkkwgk', 'kwkrkwkrkwgk', 'kwkkwwwkkwgk', '.kwwwkwwwgk.', '..kwwwwwgk..', '..kwkwkwgk..', '..kkwkwkkk..', '...kkkkkk...'],
  crown: ['............', '.k...kk...k.', 'kyk.kyyk.kyk', 'kyykyyyykyyk', 'kyyyyyyyyyyk', 'kyywyyyywyyk', 'kyyyyrryyyyk', 'kooooooooook', 'kyyyyyyyyyyk', 'kkkkkkkkkkkk', '............', '............'],
  card: ['............', '............', '.kkkkkkkkkk.', 'kvvvvvvvvvvk', 'kkkkkkkkkkkk', 'kvvvvvvvvvvk', 'kvyyvvvvvvvk', 'kvyyvvvlllvk', 'kvvvvvvvvvvk', '.kkkkkkkkkk.', '............', '............'],
} as const
export type PixelSprite = keyof typeof PIXEL_SPRITES

const pathCache: Partial<Record<PixelSprite, { color: string; d: string }[]>> = {}
function paths(name: PixelSprite) {
  const cached = pathCache[name]
  if (cached) return cached
  const byColor = new Map<string, string>()
  PIXEL_SPRITES[name].forEach((row, y) => [...row].forEach((ch, x) => {
    const color = PALETTE[ch]
    if (color) byColor.set(color, `${byColor.get(color) ?? ''}M${x} ${y}h1v1h-1z`)
  }))
  return (pathCache[name] = [...byColor].map(([color, d]) => ({ color, d })))
}

export function PixelIcon({ name, size = 24, className = '' }: { name: PixelSprite; size?: number; className?: string }) {
  return (
    <svg className={`pixel-icon ${className}`.trim()} width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {paths(name).map(part => <path key={part.color} fill={part.color} d={part.d} />)}
    </svg>
  )
}
