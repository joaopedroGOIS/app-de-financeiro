import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import type { State } from './data'
import { ProfilePage } from './pages/Profile'
import { HeroHud } from './components/RpgHud'
import { COSMETICS, DEFAULT_EQUIPPED, cosmetic } from './cosmetics'

const base: State = {
  user: { id: 'u', name: 'Ana', email: '' }, accounts: [], entries: [], archivedEntries: [], assets: [], goals: [],
  progress: { xp_total: 110, level: 2, graninha_balance: 25, nextLevelXp: 250, currentLevelXp: 125, curveVersion: 'v' },
  preferences: { theme: 'dark' }, stats: { reserveCents: 0, netWorthCents: 0, streak: 12, financialClass: 'Juntador' },
}
const save = async () => true

test('catálogo aprovado: 38 itens, 5 Míticos (um por modelo) e Lendários só por conquista', () => {
  const showcase = COSMETICS.filter(item => !item.id.endsWith('-none'))
  assert.equal(showcase.length, 38)
  const mythic = COSMETICS.filter(item => item.rarity === 'mitico')
  assert.deepEqual(mythic.map(item => item.slot).sort(), ['accessory', 'companion', 'outfit', 'theme', 'title'])
  assert.ok(mythic.every(item => item.price! >= 700 && item.price! <= 900))
  assert.ok(COSMETICS.filter(item => item.rarity === 'lendario').every(item => item.price === null && item.requirement))
  assert.equal(showcase.reduce((sum, item) => sum + (item.price ?? 0), 0), 8400)
})

test('itens equipados na fase 1 são todos gratuitos', () => {
  for (const id of Object.values(DEFAULT_EQUIPPED)) assert.equal(cosmetic(id).price, 0, id)
})

test('perfil mostra a vitrine sem nenhuma forma de comprar ou gastar Graninhas', () => {
  const html = renderToStaticMarkup(<ProfilePage state={{ ...base, avatar: { skin: 2, hairColor: 3, available: true } }} onAppearance={save} />)
  assert.match(html, /Em breve/)
  assert.match(html, /Armadura estelar/)
  assert.match(html, /Fênix de brasa/)
  assert.match(html, /Arquimago das Finanças/)
  assert.match(html, /850 Graninhas · em breve/)
  assert.match(html, /Sequência de 30 dias · 12\/30/)
  assert.doesNotMatch(html, /Comprar|Resgatar|Equipar/)
  assert.match(html, /aria-pressed="true"[^>]*aria-label|aria-label="Tom de pele 3" aria-pressed="true"/)
})

test('sem as colunas de aparência (antes da migration), o perfil carrega com o padrão e trava as cores', () => {
  const html = renderToStaticMarkup(<ProfilePage state={base} onAppearance={save} />)
  assert.match(html, /<fieldset class="rpg-swatches" disabled=""/)
  assert.match(html, /assim que a atualização do banco terminar/)
  assert.match(html, /aria-label="Tom de pele 2" aria-pressed="true"/)
})

test('HUD mostra o personagem junto do nível', () => {
  const html = renderToStaticMarkup(<HeroHud state={base} onProfile={() => {}} />)
  assert.match(html, /rpg-hud-avatar/)
  assert.match(html, /pixel-avatar/)
})
