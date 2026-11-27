import { useState } from 'react'
import { Coins, Lock } from 'lucide-react'
import type { State } from '../data'
import { AvatarFigure, PetFigure } from '../avatar/Avatar'
import { HAIR_COLORS, SKINS } from '../avatar/pixelArt'
import { equippedOf, lookFor, ownsItem } from '../avatar/look'
import { COSMETICS, RARITY_LABELS, RARITY_ORDER, SLOT_LABELS, SLOT_ORDER, cosmetic, isPlaceholder } from '../cosmetics'
import type { CosmeticItem, CosmeticSlot } from '../cosmetics'
import { PixelIcon } from '../components/PixelIcon'
import { Button, Modal } from '../ui'

/* ==========================================================================
   Perfil — personagem, guarda-roupa e Lojinha. Toda compra e todo item
   equipado são confirmados pelo servidor; itens são só visuais.
   ========================================================================== */

export function ItemPreview({ item, state, scale = 2.4 }: { item: CosmeticItem; state: Pick<State, 'avatar' | 'cosmetics'>; scale?: number }) {
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

type Props = {
  state: State
  onAppearance: (next: { skin: number; hairColor: number }) => Promise<boolean>
  onPurchase: (item: CosmeticItem, key: string) => Promise<boolean>
  onEquip: (slot: CosmeticSlot, item: string) => Promise<boolean>
}

export function ProfilePage({ state, onAppearance, onPurchase, onEquip }: Props) {
  const [filter, setFilter] = useState<CosmeticSlot | 'all'>('all')
  const [wardrobeSlot, setWardrobeSlot] = useState<CosmeticSlot>('hair')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState<{ item: CosmeticItem; key: string } | null>(null)
  const appearance = state.avatar ?? { skin: 1, hairColor: 0, available: false }
  const shop = state.cosmetics
  const shopOpen = !!shop?.available && shop.shopOpen
  const balance = state.progress.graninha_balance
  const look = lookFor(state)
  const pet = cosmetic(equippedOf(state, 'companion'))
  const title = cosmetic(equippedOf(state, 'title'))
  const run = async (task: () => Promise<boolean>) => {
    if (busy) return false
    setBusy(true)
    try { return await task() } finally { setBusy(false) }
  }
  const saveAppearance = (next: { skin: number; hairColor: number }) => { if (appearance.available) void run(() => onAppearance(next)) }
  const wardrobe = COSMETICS.filter(item => item.slot === wardrobeSlot && ownsItem(state, item.id))
  const missing = COSMETICS.filter(item => item.slot === wardrobeSlot && !ownsItem(state, item.id)).length
  const showcase = COSMETICS.filter(item => item.price !== 0 && !isPlaceholder(item))
    .filter(item => filter === 'all' || item.slot === filter)
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || (a.price ?? 99999) - (b.price ?? 99999))

  const shopAction = (item: CosmeticItem) => {
    if (item.price === null) return <small className="rpg-shop-req"><Lock size={13} aria-hidden="true" />{requirementText(item, state.stats.streak)}</small>
    if (shop?.owned.includes(item.id)) return <span className="rpg-tag mint">Já é seu</span>
    if (!shopOpen || !shop?.active.includes(item.id)) return <small className="rpg-shop-price"><Coins size={14} aria-hidden="true" />{item.price} Graninhas · em breve</small>
    if (balance < item.price) return <><button type="button" className="btn btn-sm rpg-buy" disabled><Coins size={14} aria-hidden="true" />{item.price}</button><small className="rpg-note">faltam {item.price - balance}</small></>
    return <button type="button" className="btn btn-sm rpg-btn-gold rpg-buy" disabled={busy} onClick={() => setConfirming({ item, key: crypto.randomUUID() })}><Coins size={14} aria-hidden="true" />{item.price} · Comprar</button>
  }

  return (
    <>
      <div className="rpg-profile-grid">
        <section className="card rpg-profile-hero" aria-label="Seu personagem">
          <h2 className="rpg-window-title"><PixelIcon name="star" size={36} />Seu personagem</h2>
          <div className="rpg-stage">
            <div className="rpg-stage-avatar"><AvatarFigure look={look} scale={6} label={`Personagem de ${state.user.name}`} /></div>
            {pet.sprite && <div className="rpg-stage-pet"><PetFigure sprite={pet.sprite} scale={5} label={pet.name} /></div>}
          </div>
          <div className="rpg-profile-id">
            <span className="rpg-hex" aria-hidden="true">{state.progress.level}</span>
            <div>
              <strong>{state.user.name}</strong>
              <small><b>{title.name}</b> · Nível {state.progress.level} · classe {state.stats.financialClass ?? 'aguardando sincronização'}</small>
            </div>
          </div>
          <fieldset className="rpg-swatches" disabled={!appearance.available || busy}>
            <legend>Tom de pele</legend>
            {SKINS.map((color, index) => <button key={color} type="button" className={`rpg-dot ${appearance.skin === index ? 'on' : ''}`} style={{ background: color }} aria-label={`Tom de pele ${index + 1}`} aria-pressed={appearance.skin === index} onClick={() => saveAppearance({ skin: index, hairColor: appearance.hairColor })} />)}
          </fieldset>
          <fieldset className="rpg-swatches" disabled={!appearance.available || busy}>
            <legend>Cor do cabelo</legend>
            {HAIR_COLORS.map((color, index) => <button key={color} type="button" className={`rpg-dot ${appearance.hairColor === index ? 'on' : ''}`} style={{ background: color }} aria-label={`Cor de cabelo ${index + 1}`} aria-pressed={appearance.hairColor === index} onClick={() => saveAppearance({ skin: appearance.skin, hairColor: index })} />)}
          </fieldset>
          <small className="rpg-note">{appearance.available ? 'Cor de pele e de cabelo são sempre gratuitas e ficam salvas na sua conta.' : 'A escolha de cores fica disponível assim que a atualização do banco terminar. Tente de novo em alguns minutos.'}</small>
        </section>

        <section className="card rpg-wardrobe-window" aria-label="Guarda-roupa">
          <h2 className="rpg-window-title"><PixelIcon name="chest" size={36} />Guarda-roupa</h2>
          <div className="rpg-shop-tabs" role="group" aria-label="Escolher espaço do guarda-roupa">
            {SLOT_ORDER.map(slot => <button key={slot} type="button" aria-pressed={wardrobeSlot === slot} onClick={() => setWardrobeSlot(slot)}>{SLOT_LABELS[slot]}</button>)}
          </div>
          <div className="rpg-shop-grid compact">
            {wardrobe.map(item => {
              const equipped = equippedOf(state, wardrobeSlot) === item.id
              return (
                <article key={item.id} className={`rpg-shop-card rarity-${item.rarity}`}>
                  <div className="rpg-shop-preview"><ItemPreview item={item} state={state} scale={2} /></div>
                  <strong className="rpg-shop-name">{item.name}</strong>
                  {equipped ? <span className="rpg-tag mint">Equipado</span>
                    : <button type="button" className="btn btn-sm" disabled={busy || !shop?.available} onClick={() => void run(() => onEquip(wardrobeSlot, item.id))}>Equipar</button>}
                </article>
              )
            })}
          </div>
          <small className="rpg-note">{missing ? `${missing} ${missing === 1 ? 'item' : 'itens'} de ${SLOT_LABELS[wardrobeSlot].toLowerCase()} ainda não são seus.` : `Você tem todos os itens de ${SLOT_LABELS[wardrobeSlot].toLowerCase()}.`}</small>
        </section>
      </div>

      <section className="card rpg-shop" aria-label="Lojinha">
        <h2 className="rpg-window-title"><PixelIcon name="coin" size={36} />Lojinha
          <span className="rpg-aside">{shopOpen ? <span className="rpg-chip gold"><Coins size={18} aria-hidden="true" />{balance} Graninhas</span> : <span className="rpg-tag gold">Em breve</span>}</span>
        </h2>
        <p className="info-note">{shopOpen
          ? 'Troque Graninhas por itens visuais. Nada aqui dá XP, desconto ou vantagem, e não existe compra com dinheiro real. Toda compra é confirmada antes e não pode ser desfeita.'
          : 'A Lojinha abre em breve. Os preços já estão definidos, e nada aqui gasta Graninhas ainda. Os itens são só visuais: não dão XP, desconto nem vantagem.'}</p>
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
              <div className="rpg-shop-action">{shopAction(item)}</div>
            </article>
          ))}
        </div>
      </section>

      {confirming && (
        <Modal title="Confirmar compra" subtitle="Compras usam só Graninhas e não podem ser desfeitas." onClose={() => setConfirming(null)}>
          <div className="rpg-confirm">
            <div className="rpg-shop-preview"><ItemPreview item={confirming.item} state={state} scale={3} /></div>
            <div>
              <strong className="rpg-shop-name">{confirming.item.name}</strong>
              <div className="rpg-shop-meta"><span className={`rpg-rarity rarity-${confirming.item.rarity}`}>{RARITY_LABELS[confirming.item.rarity]}</span><span>{SLOT_LABELS[confirming.item.slot]}</span></div>
            </div>
          </div>
          <div className="rpg-stats">
            <div><span>Preço</span><strong>{confirming.item.price} Graninhas</strong></div>
            <div><span>Saldo depois</span><strong>{balance - (confirming.item.price ?? 0)} Graninhas</strong></div>
          </div>
          <p className="info-note">O item fica para sempre no seu guarda-roupa e já sai equipado.</p>
          <div className="confirm-actions">
            <Button variant="outline" onClick={() => setConfirming(null)} disabled={busy}>Cancelar</Button>
            <Button className="rpg-btn-gold" disabled={busy} onClick={async () => {
              const target = confirming
              const ok = await run(() => onPurchase(target.item, target.key))
              if (ok) setConfirming(null)
            }}>{busy ? 'Comprando…' : `Comprar por ${confirming.item.price}`}</Button>
          </div>
        </Modal>
      )}
    </>
  )
}
