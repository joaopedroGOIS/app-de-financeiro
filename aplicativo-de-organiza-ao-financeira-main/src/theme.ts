import { useCallback, useEffect, useState } from 'react'

/* ==========================================================================
   Sistema de temas do Granaê
   --------------------------------------------------------------------------
   Três modos: 'dark' (roxo), 'light' (azul) e 'system' (acompanha o
   dispositivo). O modo é persistido localmente para não haver flash de tema
   errado no carregamento e, quando há sessão, sincronizado com a conta para
   valer entre dispositivos.
   ========================================================================== */

export type ThemeMode = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'granae:theme'
export const DEFAULT_THEME_MODE: ThemeMode = 'dark'
export const THEME_MODES: ThemeMode[] = ['dark', 'light', 'system']

/** Cor da barra do navegador/telefone por tema resolvido. */
const META_THEME_COLOR: Record<ResolvedTheme, string> = { dark: '#111116', light: '#F4F7FC' }

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as string[]).includes(value)
}

export function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(stored) ? stored : DEFAULT_THEME_MODE
  } catch {
    return DEFAULT_THEME_MODE
  }
}

export function writeStoredMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    /* Em iframes com storage bloqueado o tema segue aplicado em memória. */
  }
}

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return mode
}

/** Aplica o tema resolvido no documento. Síncrono e barato: pode rodar a cada mudança. */
export function applyResolvedTheme(theme: ResolvedTheme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', META_THEME_COLOR[theme])
}

/** Observa a preferência de aparência do dispositivo (usado apenas no modo automático). */
export function subscribeSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (event: MediaQueryListEvent) => onChange(event.matches)
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }
  query.addListener(handler)
  return () => query.removeListener(handler)
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode())
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(readStoredMode()))

  const commit = useCallback((theme: ResolvedTheme) => {
    setResolved(theme)
    applyResolvedTheme(theme)
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    writeStoredMode(next)
    commit(resolveTheme(next))
  }, [commit])

  useEffect(() => {
    commit(resolveTheme(mode))
    if (mode !== 'system') return
    return subscribeSystemTheme(prefersDark => commit(prefersDark ? 'dark' : 'light'))
  }, [mode, commit])

  return { mode, resolved, setMode }
}
