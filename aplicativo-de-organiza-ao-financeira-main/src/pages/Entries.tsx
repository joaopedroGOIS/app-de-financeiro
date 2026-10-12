import { Plus, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { currency } from '../data'
import { Button, Card, EmptyState } from '../ui'
import { EntryRow } from './Dashboard'
import type { PageProps } from './shared'

type EntryFilter = 'all' | 'income' | 'expense' | 'adjustment'

export function EntriesPage({ state, month, query, entryFilter, setQuery, setEntryFilter, monthPicker, go, open, editEntry, requestRemove }: PageProps & {
  month: string
  query: string
  entryFilter: EntryFilter
  setQuery: (value: string) => void
  setEntryFilter: (value: EntryFilter) => void
  monthPicker: ReactNode
}) {
  const monthEntries = state.entries.filter(entry => entry.date.slice(0, 7) === month)
  const income = monthEntries.filter(entry => entry.type === 'income').reduce((sum, entry) => sum + entry.amountCents, 0)
  const expenses = monthEntries.filter(entry => entry.type === 'expense').reduce((sum, entry) => sum + entry.amountCents, 0)
  const needle = query.toLocaleLowerCase('pt-BR')
  const filtered = monthEntries.filter(entry =>
    (entryFilter === 'all' || entry.type === entryFilter) &&
    `${entry.title} ${entry.category} ${state.accounts.find(account => account.id === entry.accountId)?.name ?? ''}`.toLocaleLowerCase('pt-BR').includes(needle))
  const openEntry = () => { if (!state.accounts.length) return go('accounts'); editEntry(null); open('entry') }
  const addButton = <Button onClick={openEntry}><Plus size={18} />Nova movimentação</Button>

  return (
    <>
      <div className="mini-stats">
        <div className="mini-stat"><span>Receitas no mês</span><strong className="positive">{currency(income)}</strong></div>
        <div className="mini-stat"><span>Despesas no mês</span><strong className="negative">{currency(expenses)}</strong></div>
        <div className="mini-stat"><span>Resultado do mês</span><strong className={income - expenses < 0 ? 'negative' : 'positive'}>{currency(income - expenses)}</strong></div>
      </div>

      <Card>
        <div className="list-header">
          <div className="card-header-text">
            <h3 className="card-title">Seu histórico</h3>
            <p className="card-description">Encontre tudo em um só lugar</p>
          </div>
          {monthPicker}
        </div>
        <div className="list-filters">
          <div className="search-field">
            <Search size={17} />
            <input aria-label="Buscar movimentações" placeholder="Buscar movimentação..." value={query} onChange={event => setQuery(event.target.value)} />
          </div>
          <div className="filter-tabs" role="group" aria-label="Filtrar movimentações">
            {([['all', 'Todas'], ['expense', 'Gastos'], ['income', 'Receitas'], ['adjustment', 'Ajustes']] as const).map(([key, label]) => (
              <button key={key} type="button" className={entryFilter === key ? 'active' : ''} aria-pressed={entryFilter === key} onClick={() => setEntryFilter(key)}>{label}</button>
            ))}
          </div>
        </div>
        {filtered.length ? (
          <div className="entry-list">
            {filtered.map(entry => (
              <EntryRow
                key={entry.id}
                entry={entry}
                account={state.accounts.find(account => account.id === entry.accountId)?.name ?? 'Conta'}
                onEdit={() => { editEntry(entry); open('entry') }}
                onRemove={() => requestRemove({ path: `/entries/${entry.id}`, title: 'Arquivar movimentação', description: `Arquivar “${entry.title}”? O registro fica preservado no histórico do servidor, mas deixa de compor seus saldos.` })}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Search size={26} />}
            title="Nada por aqui ainda"
            text={state.accounts.length ? 'Tente outro mês, limpe os filtros ou registre uma nova movimentação.' : 'Comece criando uma conta financeira.'}
            action={state.accounts.length ? addButton : <Button onClick={() => go('accounts')}>Criar conta</Button>}
          />
        )}
        <div className="list-bottom">{filtered.length} {filtered.length === 1 ? 'movimentação encontrada' : 'movimentações encontradas'}</div>
      </Card>
    </>
  )
}

export type { EntryFilter }
