export type PageId = 'dashboard' | 'entries' | 'accounts' | 'wealth' | 'goals' | 'journey'
export type ModalKind = 'entry' | 'account' | 'asset' | 'goal' | 'contribution' | 'profile'

import type { Account, Asset, Entry, Goal, State } from '../data'

/** Contrato compartilhado entre o shell e as páginas: nada de lógica financeira aqui. */
export type PageProps = {
  state: State
  go: (page: PageId) => void
  open: (modal: ModalKind) => void
  editEntry: (entry: Entry | null) => void
  editAccount: (account: Account | null) => void
  editAsset: (asset: Asset | null) => void
  editGoal: (goal: Goal | null) => void
  contributeTo: (goal: Goal | null) => void
  /** Pede confirmação antes de qualquer exclusão/arquivamento. */
  requestRemove: (request: { path: string; title: string; description: string }) => void
  toast: (message: string, tone?: 'success' | 'error') => void
}
