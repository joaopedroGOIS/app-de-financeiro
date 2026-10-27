import { useEffect, useRef } from 'react'
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
  closeRef.current = onClose
  useEffect(() => {
    const timer = window.setTimeout(() => closeRef.current(), effect.level ? 6500 : 4500)
    return () => window.clearTimeout(timer)
  }, [effect.id, effect.level])
  return <aside className={`reward-celebration ${effect.level ? 'is-level-up' : ''}`} aria-label="Recompensa confirmada">
    <div className="reward-sparks" aria-hidden="true">{Array.from({ length: effect.level ? 12 : 6 }, (_, i) => <i key={i} style={{ '--spark-index': i } as React.CSSProperties} />)}</div>
    <span className="reward-emblem" aria-hidden="true">{effect.level ? <Gem size={30} /> : <Sparkles size={25} />}</span>
    <div className="reward-celebration-copy" role="status" aria-live="polite" aria-atomic="true">
      <strong>{effect.level ? `Você chegou ao nível ${effect.level}!` : 'Seu cuidado rendeu!'}</strong>
      <div className="reward-gains">
        {effect.xp > 0 && <span><Sparkles size={15} aria-hidden="true" />+{effect.xp} XP</span>}
        {effect.coins > 0 && <span className="reward-coins"><Coins size={15} aria-hidden="true" />+{effect.coins} Graninhas</span>}
      </div>
    </div>
    <button type="button" className="reward-dismiss" onClick={onClose} aria-label="Fechar recompensa"><X size={17}/></button>
  </aside>
}
