import { useState } from 'react'
import { Coins, Lock } from 'lucide-react'
import type { State } from '../data'
import { AvatarFigure, PetFigure } from '../avatar/Avatar'
import { HAIR_COLORS, SKINS } from '../avatar/pixelArt'
import { lookFor } from '../avatar/look'
import { COSMETICS, DEFAULT_EQUIPPED, RARITY_LABELS, RARITY_ORDER, SLOT_LABELS, SLOT_ORDER, cosmetic, isPlaceholder } from '../cosmetics'
import type { CosmeticItem, CosmeticSlot } from '../cosmetics'
import { PixelIcon } from '../components/PixelIcon'

/* ==========================================================================
   Perfil — fase 1. Personagem, cores livres, itens iniciais e a Lojinha como
   vitrine. Nada aqui compra itens ou gasta Graninhas.
   ========================================================================== */

export function ItemPreview({ item, state, scale = 2.4 }: { item: CosmeticItem; state: Pick<State, 'avatar'>; scale?: number }) {
  if (item.slot === 'hair' || item.slot === 'outfit' || item.slot === 'hat' || item.slot === 'accessory') {
    return <AvatarFigure look={lookFor(state, { [item.slot]: item.id })} scale={scale} />
  }
  if (item.slot === 'companion') return item.sprite ? <PetFigure sprite={item.sprite} scale={Math.round(scale * 1.7)} /> : <span className="rpg-note">Nenhum</span>
  if (item.slot === 'theme' && item.theme) {
    return <span className="cosmetic-swatch" style={{ background: `linear-gradient(180deg, ${item.theme.top}, ${item.theme.bottom})`, borderColor: item.theme.inner }}><i style={{ background: item.theme.inner }} /></span>
  }
  if (item.slot === 'frame') return <span className="cosmetic-swatch" style={{ borderColor: item.frame, background: 'linear-gradient(180deg, var(--rpg-win-top), var(--rpg-win-bottom))' }} />
  return <span className="cosmetic-title-sample">{item.name}</span>
}

function requirementText(item: CosmeticItem, streak: number) {
  const req = item.requirement
  if (!req) return ''
  if (req.kind === 'streak') return `Sequência de ${req.days} dias · ${Math.min(streak, req.days)}/${req.days}`
  return `Concluir a missão ${req.name}`
}

export function ProfilePage({ state, onAppearance }: { state: State; onAppearance: (next: { skin: number; hairColor: number }) => Promise<boolean> }) {
  const [filter, setFilter] = useState<CosmeticSlot | 'all'>('all')
  const [saving, setSaving] = useState(false)
  const appearance = state.avatar ?? { skin: 1, hairColor: 0, available: false }
  const look = lookFor(state)
  const pet = cosmetic(DEFAULT_EQUIPPED.companion)
  const title = cosmetic(DEFAULT_EQUIPPED.title)
  const save = async (next: { skin: number; hairColor: number }) => {
    if (saving || !appearance.available) return
    setSaving(true)
    try { await onAppearance(next) } finally { setSaving(false) }
  }
  const showcase = COSMETICS.filter(item => item.price !== 0 && !isPlaceholder(item))
    .filter(item => filter === 'all' || item.slot === filter)
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || (a.price ?? 99999) - (b.price ?? 99999))

  return (
    <>
      <div className="rpg-profile-grid">
        <section className="card rpg-profile-hero" aria-label="Seu personagem">
          <h2 className="rpg-window-title"><PixelIcon name="star" size={36} />Seu personagem</h2>
          <div className="rpg-stage">
            <div className="rpg-stage-avatar"><AvatarFigure look={look} scale={6} label={`Personagem de ${state.user.name}`} /></div>
            {pet.sprite && <div className="rpg-stage-pet"><PetFigure sprite={pet.sprite} scale={5} /></div>}
          </div>
          <div className="rpg-profile-id">
            <span className="rpg-hex" aria-hidden="true">{state.progress.level}</span>
            <div>
              <strong>{state.user.name}</strong>
              <small><b>{title.name}</b> · Nível {state.progress.level} · classe {state.stats.financialClass ?? 'aguardando sincronização'}</small>
            </div>
          </div>
          <fieldset className="rpg-swatches" disabled={!appearance.available || saving}>
            <legend>Tom de pele</legend>
            {SKINS.map((color, index) => <button key={color} type="button" className={`rpg-dot ${appearance.skin === index ? 'on' : ''}`} style={{ background: color }} aria-label={`Tom de pele ${index + 1}`} aria-pressed={appearance.skin === index} onClick={() => save({ skin: index, hairColor: appearance.hairColor })} />)}
          </fieldset>
          <fieldset className="rpg-swatches" disabled={!appearance.available || saving}>
            <legend>Cor do cabelo</legend>
            {HAIR_COLORS.map((color, index) => <button key={color} type="button" className={`rpg-dot ${appearance.hairColor === index ? 'on' : ''}`} style={{ background: color }} aria-label={`Cor de cabelo ${index + 1}`} aria-pressed={appearance.hairColor === index} onClick={() => save({ skin: appearance.skin, hairColor: index })} />)}
          </fieldset>
          <small className="rpg-note">{appearance.available ? 'Cor de pele e de cabelo são sempre gratuitas e ficam salvas na sua conta.' : 'A escolha de cores fica disponível assim que a atualização do banco terminar. Tente de novo em alguns minutos.'}</small>
        </section>

        <section className="card" aria-label="Guarda-roupa">
          <h2 className="rpg-window-title"><PixelIcon name="chest" size={36} />Guarda-roupa</h2>
          <ul className="rpg-wardrobe">
            {SLOT_ORDER.map(slot => {
              const item = cosmetic(DEFAULT_EQUIPPED[slot])
              return <li key={slot}><span className="rpg-wardrobe-slot">{SLOT_LABELS[slot]}</span><strong>{item.name}</strong><span className="rpg-tag mint">Equipado</span></li>
            })}
          </ul>
          <small className="rpg-note">Por enquanto você usa os itens iniciais. Os outros chegam com a Lojinha.</small>
        </section>
      </div>

      <section className="card rpg-shop" aria-label="Lojinha em breve">
        <h2 className="rpg-window-title"><PixelIcon name="coin" size={36} />Lojinha<span className="rpg-aside"><span className="rpg-tag gold">Em breve</span></span></h2>
        <p className="info-note">A Lojinha abre na próxima atualização. Os preços já estão definidos, e nada aqui gasta Graninhas ainda. Os itens são só visuais: não dão XP, desconto nem vantagem.</p>
        <div className="rpg-shop-tabs" role="group" aria-label="Filtrar por tipo de item">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Tudo</button>
          {SLOT_ORDER.map(slot => <button key={slot} type="button" aria-pressed={filter === slot} onClick={() => setFilter(slot)}>{SLOT_LABELS[slot]}</button>)}
        </div>
        <div className="rpg-shop-grid">
          {showcase.map(item => (
            <article key={item.id} className={`rpg-shop-card rarity-${item.rarity}`}>
              <div className="rpg-shop-preview"><ItemPreview item={item} state={state} /></div>
              <strong className="rpg-shop-name">{item.name}</strong>
              <div className="rpg-shop-meta"><span className={`rpg-rarity rarity-${item.rarity}`}>{RARITY_LABELS[item.rarity]}</span><span>{SLOT_LABELS[item.slot]}</span></div>
              {item.price === null
                ? <small className="rpg-shop-req"><Lock size={13} aria-hidden="true" />{requirementText(item, state.stats.streak)}</small>
                : <small className="rpg-shop-price"><Coins size={14} aria-hidden="true" />{item.price} Graninhas · em breve</small>}
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
