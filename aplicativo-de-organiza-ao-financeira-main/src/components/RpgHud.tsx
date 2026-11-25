import { Coins, Flame, Heart, ShieldCheck, Skull, Swords } from 'lucide-react'
import { cardBills, relevantCardBill } from '../creditCards'
import { currency, dateToday, displayDate, monthName } from '../data'
import type { State } from '../data'
import { levelProgress } from '../gamification'

/* ==========================================================================
   Camada RPG — apenas apresentação. Nenhum valor é calculado de forma nova:
   tudo vem do estado já confirmado pelo servidor (progresso, sequência,
   classe, contas e faturas). Pagar fatura nunca gera XP.
   ========================================================================== */

export function HeroHud({ state, onProfile }: { state: State; onProfile: () => void }) {
  const bar = levelProgress(state.progress)
  const { level, xp_total: xp, graninha_balance: coins } = state.progress
  const streak = state.stats.streak
  return (
    <section className="rpg-hud" aria-label="Seu personagem">
      <button type="button" className="rpg-hud-hero" onClick={onProfile} aria-label="Abrir perfil">
        <span className="rpg-hex" aria-hidden="true">{level}</span>
        <span className="rpg-hud-id">
          <strong>{state.user.name}</strong>
          <small>Nível {level} · <b>{state.stats.financialClass ?? 'Aguardando sincronização'}</b></small>
        </span>
      </button>
      <div className="rpg-hud-xp">
        <div className="rpg-bar-label"><span>Experiência</span><small>{bar.required ? `${bar.earned}/${bar.required} XP · total ${xp}` : `${xp} XP · ${bar.label}`}</small></div>
        <div className="rpg-track" role="progressbar" aria-label="Progresso de XP para o próximo nível" aria-valuenow={Math.round(bar.percent)} aria-valuemin={0} aria-valuemax={100}>
          <div className="rpg-fill xp" style={{ width: `${bar.percent}%` }} />
        </div>
        {!state.progress.curveVersion && <small className="rpg-note">A curva oficial de XP ainda não está configurada.</small>}
      </div>
      <div className="rpg-hud-chips">
        <span className={`rpg-chip fire ${streak ? '' : 'off'}`} title={`${streak} dias de sequência`} role="img" aria-label={`${streak} dias de sequência`}><Flame size={18} aria-hidden="true" /><span aria-hidden="true">{streak}</span></span>
        <span className="rpg-chip gold" title={`${coins} Graninhas`} role="img" aria-label={`${coins} Graninhas`}><Coins size={18} aria-hidden="true" /><span aria-hidden="true">{coins}</span></span>
      </div>
    </section>
  )
}

/** Vida do mês e escudo (reserva). Indicadores descritivos, sem regra de jogo nova. */
export function RpgAttributes({ state, month }: { state: State; month: string }) {
  const monthEntries = state.entries.filter(entry => entry.date.slice(0, 7) === month)
  const income = monthEntries.filter(entry => entry.type === 'income').reduce((sum, entry) => sum + entry.amountCents, 0)
  const expenses = monthEntries.filter(entry => entry.type === 'expense').reduce((sum, entry) => sum + entry.amountCents, 0)
  const hp = Math.max(0, income - expenses)
  const hpPercent = income ? hp / income * 100 : 0
  const balance = state.accounts.reduce((sum, account) => sum + account.balanceCents, 0)
  return (
    <section className="card rpg-attributes" aria-label={`Atributos de ${monthName(month)}`}>
      <h2 className="rpg-window-title"><Heart size={20} aria-hidden="true" />Atributos</h2>
      <div className="rpg-bar">
        <div className="rpg-bar-label"><span><Heart size={15} aria-hidden="true" />Vida do mês</span><small>{currency(hp)} de {currency(income)}</small></div>
        <div className={`rpg-track ${income && hpPercent < 25 ? 'low' : ''}`} role="progressbar" aria-label="Vida do mês" aria-valuenow={Math.round(hpPercent)} aria-valuemin={0} aria-valuemax={100}>
          <div className="rpg-fill hp" style={{ width: `${hpPercent}%` }} />
        </div>
        <small className="rpg-note">Receitas menos despesas do mês. Gastos são dano; receitas são cura.</small>
      </div>
      <div className="rpg-shield">
        <span className="rpg-shield-icon"><ShieldCheck size={22} aria-hidden="true" /></span>
        <div><span className="rpg-bar-label"><span>Escudo (reserva)</span></span><strong>{currency(state.stats.reserveCents)}</strong><small className="rpg-note">Classe atual: <b>{state.stats.financialClass ?? 'aguardando sincronização'}</b>. A classe vem da reserva, não do XP.</small></div>
      </div>
      <div className="rpg-stats">
        <div><span>Patrimônio líquido</span><strong>{currency(state.stats.netWorthCents)}</strong></div>
        <div><span>Saldo das contas</span><strong>{currency(balance)}</strong></div>
      </div>
    </section>
  )
}

export function BossBill({ state, onAttack }: { state: State; onAttack: () => void }) {
  const cards = state.creditCards
  if (!cards || !cards.cards.length) return null
  const today = dateToday()
  const bill = relevantCardBill(cardBills(cards), today)
  const card = bill && cards.cards.find(item => item.id === bill.cardId)
  if (!bill || !card) return null
  const slain = bill.remainingCents === 0
  const overdue = !slain && bill.dueDate < today
  const life = bill.totalCents ? bill.remainingCents / bill.totalCents * 100 : 0
  return (
    <section className={`card rpg-boss ${slain ? 'slain' : ''}`} aria-label="Chefe da fatura">
      <h2 className="rpg-window-title"><Skull size={20} aria-hidden="true" />Chefe da fatura
        <span className="rpg-aside">{slain ? <span className="rpg-tag mint">Derrotado</span> : overdue ? <span className="rpg-tag hp">Vencida</span> : `vence em ${displayDate(bill.dueDate)}`}</span>
      </h2>
      <div className="rpg-boss-body">
        <div className="rpg-boss-art" aria-hidden="true"><Skull size={54} strokeWidth={1.6} /></div>
        <div className="rpg-boss-info">
          <strong className="rpg-boss-name">{card.name} · fatura de {monthName(bill.month)}</strong>
          <small className="rpg-note">{bill.installments.length} parcelas nesta fatura. Pagamentos parciais são golpes; quitar derrota o chefe. Pagar fatura não gera XP.</small>
          <div className="rpg-bar">
            <div className="rpg-bar-label"><span>Vida do chefe</span><small>{currency(bill.remainingCents)} de {currency(bill.totalCents)}</small></div>
            <div className="rpg-track" role="progressbar" aria-label="Valor restante da fatura" aria-valuenow={Math.round(life)} aria-valuemin={0} aria-valuemax={100}><div className="rpg-fill hp" style={{ width: `${life}%` }} /></div>
          </div>
          <button type="button" className="btn btn-primary rpg-btn-gold" onClick={onAttack}><Swords size={17} aria-hidden="true" />{slain ? 'Ver cartões' : 'Atacar (pagar)'}</button>
        </div>
      </div>
    </section>
  )
}
