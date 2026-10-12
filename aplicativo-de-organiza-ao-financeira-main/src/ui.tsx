import { useEffect, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, CircleAlert, Monitor, Moon, Sun, Target, TrendingUp, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { THEME_MODES, resolveTheme, subscribeSystemTheme } from './theme'
import type { ThemeMode } from './theme'

/* ==========================================================================
   Componentes visuais do Granaê
   --------------------------------------------------------------------------
   Nenhum componente usa cor fixa: tudo vem dos tokens de tema. Trocar o tema
   repinta a interface inteira sem recarregar a página.
   ========================================================================== */

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setWidth(element.clientWidth)
    update()
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(update)
      observer.observe(element)
      return () => observer.disconnect()
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return [ref, width] as const
}

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? 'brand-light' : ''}`}>
      <span className="brand-symbol"><TrendingUp size={21} strokeWidth={3} /></span>
      <span>grana<span className="brand-accent">ê</span><span className="brand-dot">.</span></span>
    </div>
  )
}

/** Cabeçalho compartilhado das páginas, para manter hierarquia e ações consistentes. */
export function PageHeading({ eyebrow, title, description, action, className = '' }: { eyebrow: string; title: string; description: string; action?: ReactNode; className?: string }) {
  return (
    <div className={`page-heading ${className}`.trim()}>
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="page-heading-actions">{action}</div>}
    </div>
  )
}

export function LoadingScreen({ message = 'Preparando seu espaço...' }: { message?: string }) {
  return (
    <main className="loading-screen" aria-busy="true">
      <Brand />
      <div className="loading-pulse" role="status" aria-live="polite">{message}</div>
    </main>
  )
}

export function InlineError({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`error-message ${className}`.trim()} role="alert">
      <CircleAlert size={16} aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'on-hero'
  size?: 'sm' | 'md' | 'lg'
  wide?: boolean
}

export function Button({ variant = 'primary', size = 'md', wide, className = '', type = 'button', ...rest }: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, size !== 'md' ? `btn-${size}` : '', wide ? 'btn-wide' : '', className].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...rest} />
}

export function IconButton({ label, icon: Icon, tone, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: LucideIcon; tone?: 'danger' }) {
  return <button type="button" className={`icon-button ${tone} ${className}`.trim()} aria-label={label} title={label} {...rest}><Icon size={17} /></button>
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`card ${className}`}>{children}</section>
}

export function CardHeader({ title, description, icon: Icon, action }: { title: string; description?: string; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="card-header">
      <div className="card-header-text">
        <h3 className="card-title">{title}</h3>
        {description && <p className="card-description">{description}</p>}
      </div>
      {Icon && !action && <span className="card-icon"><Icon size={19} /></span>}
      {action}
    </div>
  )
}

export type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'outline'
  | 'comum' | 'incomum' | 'rara' | 'extra-rara' | 'lendaria'

export function Badge({ tone = 'neutral', icon: Icon, children }: { tone?: BadgeTone; icon?: LucideIcon; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{Icon && <Icon size={13} />}{children}</span>
}

/** Raridade oficial derivada da dificuldade (documento mestre, seção 8). */
export const rarityOf = (difficulty?: string) => {
  const map: Record<string, { tone: BadgeTone; label: string }> = {
    'Fácil': { tone: 'comum', label: 'Comum' },
    'Moderada': { tone: 'incomum', label: 'Incomum' },
    'Difícil': { tone: 'rara', label: 'Rara' },
    'Muito difícil': { tone: 'extra-rara', label: 'Extra rara' },
    'Lendária': { tone: 'lendaria', label: 'Lendária' },
  }
  return difficulty ? map[difficulty] : undefined
}

export function ProgressBar({ value, tone = '', size = '', onHero = false, label }: { value: number; tone?: '' | 'success' | 'warning' | 'danger'; size?: '' | 'thin' | 'thick'; onHero?: boolean; label?: string }) {
  const width = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  return (
    <div className={`progress ${tone} ${size} ${onHero ? 'on-hero' : ''}`} role="progressbar" aria-label={label} aria-valuenow={Math.round(width)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${width}%` }} />
    </div>
  )
}

export function ProgressRing({ value, label, size = 64, strokeWidth = 6, children }: {
  value: number; label: string; size?: number; strokeWidth?: number; children?: ReactNode
}) {
  const boundedValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  const radius = 50 - strokeWidth / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - boundedValue / 100)
  return (
    <span
      className="progress-ring"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(boundedValue)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${Math.round(boundedValue)}%`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className="progress-ring-track" cx="50" cy="50" r={radius} strokeWidth={strokeWidth} />
        <circle
          className="progress-ring-value"
          cx="50"
          cy="50"
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="progress-ring-label">{children ?? `${Math.round(boundedValue)}%`}</span>
    </span>
  )
}

/** Cartão de objetivo compartilhado; os valores e progresso vêm sempre do estado real. */
export function GoalCard({ title, icon, kind, description, progress, actions, children, className = '', compact = false }: {
  title: string; icon?: ReactNode; kind?: ReactNode; description?: ReactNode; progress: number; actions?: ReactNode; children?: ReactNode; className?: string; compact?: boolean
}) {
  return (
    <article className={`goal-card ${compact ? 'compact' : ''} ${className}`.trim()}>
      <header className="goal-card-header">
        {icon && <span className="goal-card-icon" aria-hidden="true">{icon}</span>}
        <div className="goal-card-info">
          {kind && <div className="goal-card-kind">{kind}</div>}
          <h3>{title}</h3>
          {description && <div className="goal-card-description">{description}</div>}
        </div>
        <ProgressRing value={progress} label={`Progresso de ${title}`} size={compact ? 48 : 58} strokeWidth={5}>
          <span aria-hidden="true">{Math.round(Math.max(0, Math.min(100, progress)))}%</span>
        </ProgressRing>
        {actions && <div className="goal-card-actions">{actions}</div>}
      </header>
      {children && <div className="goal-card-content">{children}</div>}
    </article>
  )
}

/** Molde visual, sem estado de jogo embutido; só renderiza missões fornecidas pela aplicação. */
export function MissionCard({ title, description, icon: Icon = Target, status, progress, action, className = '' }: {
  title: string; description: string; icon?: LucideIcon; status?: ReactNode; progress?: number; action?: ReactNode; className?: string
}) {
  const boundedProgress = progress === undefined ? undefined : Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0))
  return (
    <article className={`mission-card ${className}`.trim()}>
      <span className="mission-card-icon"><Icon size={19} aria-hidden="true" /></span>
      <div className="mission-card-body">
        <div className="mission-card-heading">
          <h3>{title}</h3>
          {status && <span className="mission-card-status">{status}</span>}
        </div>
        <p>{description}</p>
        {boundedProgress !== undefined && (
          <div className="mission-card-progress">
            <ProgressBar value={boundedProgress} label={`Progresso da missão: ${title}`} size="thin" />
            <span>{Math.round(boundedProgress)}%</span>
          </div>
        )}
      </div>
      {action && <div className="mission-card-action">{action}</div>}
    </article>
  )
}

export type StatTone = '' | 'success' | 'danger' | 'warning' | 'info'

export type StatTrend = { direction: 'up' | 'down' | 'flat'; label: string; tone: 'good' | 'bad' | 'neutral' }

export function StatCard({ label, value, hint, icon: Icon, tone = '', trend, valueSmall = false }: {
  label: string; value: string; hint?: ReactNode; icon: LucideIcon; tone?: StatTone; trend?: StatTrend; valueSmall?: boolean
}) {
  return (
    <div className="stat-card">
      <div className="stat-head">
        <span className={`stat-icon ${tone}`}><Icon size={19} /></span>
        {trend && (
          <span className={`stat-trend ${trend.tone}`}>
            {trend.direction !== 'flat' && <TrendingUp size={13} style={trend.direction === 'down' ? { transform: 'scaleY(-1)' } : undefined} />}
            {trend.label}
          </span>
        )}
      </div>
      <span className="stat-label">{label}</span>
      <strong className={`stat-value ${valueSmall ? 'small' : ''}`}>{value}</strong>
      {hint && <small className="stat-hint">{hint}</small>}
    </div>
  )
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function Modal({ title, subtitle, onClose, children, wide = false, className = '', immersiveOnMobile = false }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean; className?: string; immersiveOnMobile?: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className={`modal-backdrop ${immersiveOnMobile ? 'immersive-on-mobile' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className={`modal ${wide ? 'wide' : ''} ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title}>
        <IconButton label="Fechar" icon={X} className="modal-close" onClick={onClose} />
        <h2>{title}</h2>
        {subtitle && <p className="modal-subtitle">{subtitle}</p>}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, description, confirmLabel, cancelLabel = 'Cancelar', onConfirm, onCancel }: {
  title: string; description: string; confirmLabel: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="confirm-body">
        <p className="card-description">{description}</p>
      </div>
      <div className="confirm-actions">
        <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

export function Toast({ message, tone, onClose }: { message: string; tone: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`toast ${tone}`} role="status">
      {tone === 'success' ? <Check size={18} /> : <X size={18} />}
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="Fechar aviso"><X size={15} /></button>
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string; icon?: LucideIcon }[]; value: T; onChange: (next: T) => void }) {
  return (
    <div className="segmented" role="group">
      {options.map(option => (
        <button key={option.value} type="button" className={value === option.value ? 'active' : ''} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.icon && <option.icon size={15} />}{option.label}
        </button>
      ))}
    </div>
  )
}

export function MonthPicker({ label, onPrevious, onNext }: { label: string; onPrevious: () => void; onNext: () => void }) {
  return (
    <div className="month-picker">
      <button type="button" onClick={onPrevious} aria-label="Mês anterior"><ChevronLeft size={17} /></button>
      <span>{label}</span>
      <button type="button" onClick={onNext} aria-label="Próximo mês"><ChevronRight size={17} /></button>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Gráficos (SVG próprio, sem dependências novas, pintados por tokens)
   -------------------------------------------------------------------------- */

export type EvolutionPoint = { key: string; label: string; value: number; formatted: string }

export function EvolutionChart({ data }: { data: EvolutionPoint[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const height = 220
  const padY = 16
  const values = data.map(point => point.value)
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  const span = max - min || 1
  const usable = height - padY * 2
  const step = data.length > 1 ? width / (data.length - 1) : 0
  const xAt = (index: number) => (data.length > 1 ? index * step : width / 2)
  const yAt = (value: number) => padY + ((max - value) / span) * usable
  const line = data.map((point, index) => `${index ? 'L' : 'M'}${xAt(index).toFixed(1)},${yAt(point.value).toFixed(1)}`).join(' ')
  const zeroY = yAt(0)
  const area = data.length > 1 ? `${line} L${xAt(data.length - 1).toFixed(1)},${zeroY.toFixed(1)} L${xAt(0).toFixed(1)},${zeroY.toFixed(1)} Z` : ''

  return (
    <div className="chart-wrap" ref={ref}>
      {width > 0 && (
        <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Evolução do resultado mensal nos últimos 6 meses">
          <defs>
            <linearGradient id="evolutionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--chart-area-from)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--chart-area-to)' }} />
            </linearGradient>
          </defs>
          {[max, (max + min) / 2, min].map((value, index) => (
            <line key={index} className="chart-gridline" x1={0} x2={width} y1={yAt(value)} y2={yAt(value)} />
          ))}
          {min < 0 && max > 0 && <line className="chart-baseline" x1={0} x2={width} y1={zeroY} y2={zeroY} />}
          {area && <path className="chart-area" d={area} />}
          <path className="chart-line" d={line} />
          {data.map((point, index) => (
            <circle key={point.key} className={`chart-dot ${point.value < 0 ? 'negative' : ''}`} cx={xAt(index)} cy={yAt(point.value)} r={4}>
              <title>{`${point.label}: ${point.formatted}`}</title>
            </circle>
          ))}
        </svg>
      )}
      <div className="chart-labels">
        {data.map(point => (
          <span className="chart-label" key={point.key}>
            <strong className={point.value < 0 ? 'negative' : ''}>{point.formatted}</strong>
            {point.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export type DonutSegment = { label: string; value: number; color: string }

export function DonutChart({ segments, centerValue, centerLabel }: { segments: DonutSegment[]; centerValue: string; centerLabel: string }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const radius = 52
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox="0 0 120 120" role="img" aria-label={`Distribuição de gastos: ${segments.map(s => `${s.label} ${Math.round((s.value / (total || 1)) * 100)}%`).join(', ')}`}>
        <circle className="donut-track" cx="60" cy="60" r={radius} />
        {total > 0 && segments.map(segment => {
          const length = (segment.value / total) * circumference
          const dash = <circle key={segment.label} cx="60" cy="60" r={radius} fill="none" stroke={segment.color} strokeWidth={15} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} strokeLinecap="butt" />
          offset += length
          return dash
        })}
      </svg>
      <div className="donut-center">
        <strong>{centerValue}</strong>
        <small>{centerLabel}</small>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Seletor de tema
   -------------------------------------------------------------------------- */

const THEME_COPY: Record<ThemeMode, { title: string; description: string; icon: LucideIcon }> = {
  dark: { title: 'Escuro — Roxo', description: 'Fundo quase preto com detalhes em roxo.', icon: Moon },
  light: { title: 'Claro — Azul', description: 'Fundo claro com detalhes em azul.', icon: Sun },
  system: { title: 'Automático', description: 'Acompanha a aparência do seu dispositivo.', icon: Monitor },
}

export function ThemeSelector({ mode, onChange }: { mode: ThemeMode; onChange: (next: ThemeMode) => void }) {
  const [, force] = useState(0)
  useEffect(() => {
    if (mode !== 'system') return
    return subscribeSystemTheme(() => force(count => count + 1))
  }, [mode])
  const activeResolved = resolveTheme(mode)
  return (
    <div className="theme-options" role="radiogroup" aria-label="Tema do aplicativo">
      {THEME_MODES.map(option => {
        const copy = THEME_COPY[option]
        const Icon = copy.icon
        const active = mode === option
        return (
          <button key={option} type="button" role="radio" aria-checked={active} className={`theme-option ${active ? 'active' : ''}`} onClick={() => onChange(option)}>
            <span className="theme-swatch"><Icon size={18} /></span>
            <span className="theme-option-body">
              <strong>{copy.title}</strong>
              <small>{option === 'system' ? `${copy.description} Agora: ${activeResolved === 'dark' ? 'escuro' : 'claro'}.` : copy.description}</small>
            </span>
            {active && <Check className="theme-option-check" size={17} />}
          </button>
        )
      })}
    </div>
  )
}

export function ThemeMenu({ mode, onChange }: { mode: ThemeMode; onChange: (next: ThemeMode) => void }) {
  const [open, setOpen] = useState(false)
  const [, force] = useState(0)
  const anchor = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => { if (!anchor.current?.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  useEffect(() => {
    if (mode !== 'system') return
    return subscribeSystemTheme(() => force(count => count + 1))
  }, [mode])
  const ActiveIcon = THEME_COPY[mode].icon
  return (
    <div className="menu-anchor" ref={anchor}>
      <IconButton label="Alterar tema" icon={ActiveIcon} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(value => !value)} />
      {open && (
        <div className="menu" role="menu" aria-label="Tema do aplicativo">
          <div className="menu-label">APARÊNCIA</div>
          {THEME_MODES.map(option => {
            const copy = THEME_COPY[option]
            const Icon = copy.icon
            return (
              <button key={option} type="button" role="menuitemradio" aria-checked={mode === option} className="menu-item" onClick={() => { onChange(option); setOpen(false) }}>
                <span className="menu-item-icon"><Icon size={16} /></span>
                <span className="menu-item-body">
                  <strong>{copy.title}</strong>
                  <small>{option === 'system' ? `${copy.description} Agora: ${resolveTheme(mode) === 'dark' ? 'escuro' : 'claro'}.` : copy.description}</small>
                </span>
                {mode === option && <Check className="menu-item-check" size={16} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
