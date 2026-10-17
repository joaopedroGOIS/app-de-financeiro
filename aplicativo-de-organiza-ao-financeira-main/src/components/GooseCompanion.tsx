import { useEffect, useRef } from 'react'
import { Feather } from 'lucide-react'

export function GooseCompanion() {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let cancelled = false
    let dispose: (() => void) | undefined
    const element = host.current
    if (!element) return
    import('./gooseScene').then(({ createGooseScene }) => {
      if (cancelled) return
      try { dispose = createGooseScene(element) }
      catch { element.dataset.graphics = 'fallback' }
    }).catch(() => { if (!cancelled) element.dataset.graphics = 'fallback' })
    return () => { cancelled = true; dispose?.() }
  }, [])

  return <section className="goose-companion" aria-label="Seu companheiro ganso">
    <div ref={host} className="goose-stage" tabIndex={0} role="img" aria-label="Ganso 3D interativo. Mova o ponteiro, toque ou use as setas para direcionar o olhar.">
      <svg className="goose-fallback" viewBox="0 0 200 220" aria-hidden="true">
        <ellipse cx="100" cy="202" rx="58" ry="9" fill="var(--primary-soft-strong)" />
        <path d="M75 174V199H56 M116 174V199H139" fill="none" stroke="var(--warning)" strokeWidth="12" strokeLinecap="round" />
        <ellipse cx="92" cy="149" rx="47" ry="40" fill="var(--surface-raised)" stroke="var(--border-strong)" strokeWidth="2" />
        <path d="M104 145Q127 125 119 76Q97 69 96 91L96 135" fill="var(--surface-raised)" stroke="var(--border-strong)" strokeWidth="2" />
        <ellipse cx="108" cy="64" rx="26" ry="31" fill="var(--surface-raised)" stroke="var(--border-strong)" strokeWidth="2" />
        <path d="M127 65L160 73L129 85Z" fill="var(--warning)" />
        <circle cx="117" cy="61" r="4" fill="var(--text)" />
        <path d="M94 106Q107 113 123 104" fill="none" stroke="var(--primary)" strokeWidth="13" />
        <path d="M114 110L130 141" stroke="var(--primary)" strokeWidth="12" />
        <path d="M60 143Q87 127 98 150Q83 175 63 163" fill="var(--surface-sunken)" stroke="var(--border)" strokeWidth="2" />
      </svg>
    </div>
    <div className="goose-copy">
      <span className="goose-kicker"><Feather size={15} aria-hidden="true" />SEU COMPANHEIRO</span>
      <h3>Uma companhia para cada passo.</h3>
      <p>Seu ganso acompanha essa jornada com você.</p>
      <small>Mova o ponteiro sobre ele. No celular, toque. Pelo teclado, use as setas.</small>
    </div>
  </section>
}