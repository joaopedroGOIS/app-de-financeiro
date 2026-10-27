import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Coins, Gem, Sparkles, X } from 'lucide-react'
import type { Progress } from './data'

export type RewardEffect = { id: number; xp: number; coins: number; level: number | null }
type Snapshot = { user: { id: string }; progress: Progress }

// Only confirmed changes within the same signed-in session become celebrations.
export function confirmedRewardEffect(before: Snapshot | null, after: Snapshot): Omit<RewardEffect, 'id'> | null {
  if (!before || before.user.id !== after.user.id) return null
  const xp = Math.max(0, after.progress.xp_total - before.progress.xp_total)
  const coins = Math.max(0, after.progress.graninha_balance - before.progress.graninha_balance)
  const level = after.progress.level > before.progress.level ? after.progress.level : null
  return xp || coins || level ? { xp, coins, level } : null
}

export function enqueueRewardEffect(queue: RewardEffect[], next: RewardEffect): RewardEffect[] {
  if (queue.length < 4) return [...queue, next]
  const tail = queue[queue.length - 1]
  return [...queue.slice(0, -1), { ...tail, xp: tail.xp + next.xp, coins: tail.coins + next.coins,
    level: tail.level == null ? next.level : Math.max(tail.level, next.level ?? tail.level) }]
}

export function RewardCelebration({ effect, onClose }: { effect: RewardEffect; onClose: () => void }) {
  const closeRef = useRef(onClose)
  const [leaving, setLeaving] = useState(false)
  const duration = effect.level ? 6500 : 4500
  const kind = effect.level ? 'level' : effect.coins && !effect.xp ? 'coins' : 'xp'
  closeRef.current = onClose
  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), duration)
    return () => window.clearTimeout(timer)
  }, [effect.id, duration])
  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => closeRef.current(), 280)
    return () => window.clearTimeout(timer)
  }, [leaving])
  return <aside className={`reward-celebration reward-${kind} ${effect.level ? 'is-level-up' : ''} ${leaving ? 'is-leaving' : ''}`} style={{'--reward-duration':`${duration}ms`} as CSSProperties} aria-label="Recompensa confirmada">
    <div className="reward-aura" aria-hidden="true"/>
    <div className="reward-sparks" aria-hidden="true">{Array.from({ length: effect.level ? 18 : 10 }, (_, i) => {
      const angle = i * 2.39996
      const radius = 65 + i % 4 * 23
      return <i key={i} style={{ '--spark-index': i, '--spark-x': `${Math.cos(angle)*radius}px`, '--spark-y': `${Math.sin(angle)*radius}px` } as CSSProperties} />
    })}</div>
    <div className="reward-emblem-stage" aria-hidden="true"><span className="reward-orbit"/><span className="reward-orbit reward-orbit-second"/>
      <span className="reward-emblem">{effect.level ? <><Gem size={31}/><b>{effect.level}</b></> : kind==='coins' ? <Coins size={33}/> : <Sparkles size={32}/>}</span>
      <span className="reward-glint">✦</span><span className="reward-glint reward-glint-small">✦</span>
    </div>
    <div className="reward-celebration-copy" role="status" aria-live="polite" aria-atomic="true">
      <small className="reward-kicker">{effect.level ? 'NOVA CONQUISTA' : kind==='coins' ? 'RECOMPENSA RECEBIDA' : 'MAIS UM PASSO'}</small>
      <strong>{effect.level ? `Você chegou ao nível ${effect.level}!` : kind==='coins' ? 'Sua dedicação vale ouro.' : 'Sua evolução continua.'}</strong>
      <div className="reward-gains">
        {effect.xp > 0 && <span><Sparkles size={16} aria-hidden="true" /><b>+{effect.xp}</b> XP</span>}
        {effect.coins > 0 && <span className="reward-coins"><Coins size={16} aria-hidden="true" /><b>+{effect.coins}</b> Graninhas</span>}
      </div>
    </div>
    <button type="button" className="reward-dismiss" onClick={()=>setLeaving(true)} aria-label="Fechar recompensa"><X size={18}/></button>
    <span className="reward-lifetime" aria-hidden="true"/>
  </aside>
}
