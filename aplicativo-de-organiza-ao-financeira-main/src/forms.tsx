import { useState } from 'react'
import type { FormEvent } from 'react'
import { Check, CircleAlert } from 'lucide-react'
import { categories, currency, dateToday, goalIcons, incomeCategories, inputMoney, toCents } from './data'
import type { Account, Asset, Entry, Goal } from './data'
import { Button, Segmented } from './ui'

/* ==========================================================================
   Formulários — mesmos campos e mesmas regras do servidor, novo visual.
   ========================================================================== */

function FormError({ error }: { error: string }) {
  if (!error) return null
  return <div className="error-message" role="alert"><CircleAlert size={16} />{error}</div>
}

type FormProps<T> = { initial: T | null; onSubmit: (body: unknown) => Promise<boolean>; error: string }

export function EntryForm({ initial, accounts, onSubmit, error }: FormProps<Entry> & { accounts: Account[] }) {
  const [type, setType] = useState<Entry['type']>(initial?.type ?? 'expense')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [value, setValue] = useState(initial ? inputMoney(Math.abs(initial.amountCents)) : '')
  const [adjustmentSign, setAdjustmentSign] = useState(initial?.amountCents && initial.amountCents < 0 ? -1 : 1)
  const [category, setCategory] = useState(initial?.category ?? 'Alimentação')
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? '')
  const [date, setDate] = useState(initial?.date ?? dateToday())
  const [note, setNote] = useState(initial?.note ?? '')
  const [pending, setPending] = useState(false)
  const changeType = (next: Entry['type']) => { setType(next); setCategory(next === 'income' ? 'Salário' : next === 'adjustment' ? 'Ajuste de saldo' : 'Alimentação') }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    await onSubmit({ type, title, amountCents: toCents(value) * (type === 'adjustment' ? adjustmentSign : 1), category, accountId, date, note })
    setPending(false)
  }
  return (
    <form className="form" onSubmit={submit}>
      <Segmented value={type} onChange={changeType} options={[{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Receita' }, { value: 'adjustment', label: 'Ajuste' }]} />
      <label>Descrição
        <input required maxLength={80} autoFocus placeholder="Ex.: Mercado da semana" value={title} onChange={event => setTitle(event.target.value)} />
      </label>
      <div className="form-row">
        <label>Valor (R$)
          <input required type="number" inputMode="decimal" min="0.01" max="1000000000" step="0.01" placeholder="0,00" value={value} onChange={event => setValue(event.target.value)} />
        </label>
        <label>Data
          <input required type="date" max={dateToday()} value={date} onChange={event => setDate(event.target.value)} />
        </label>
      </div>
      {type === 'adjustment' && (
        <label>Tipo de ajuste
          <select value={adjustmentSign} onChange={event => setAdjustmentSign(Number(event.target.value))}>
            <option value={1}>Somar ao saldo (+)</option>
            <option value={-1}>Subtrair do saldo (−)</option>
          </select>
        </label>
      )}
      <div className="form-row">
        <label>Conta
          <select required value={accountId} onChange={event => setAccountId(event.target.value)}>
            {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        <label>Categoria
          <select value={category} onChange={event => setCategory(event.target.value)}>
            {(type === 'expense' ? categories.map(c => c.name) : type === 'income' ? incomeCategories : ['Ajuste de saldo']).map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>
      <label>Observação <span className="optional">(opcional)</span>
        <input maxLength={300} placeholder="Algum detalhe importante?" value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <FormError error={error} />
      <Button type="submit" wide disabled={pending}>
        <Check size={17} />{pending ? 'Salvando...' : initial ? 'Salvar alterações' : 'Registrar movimentação'}
      </Button>
    </form>
  )
}

export function AccountForm({ initial, onSubmit, error }: FormProps<Account>) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<Account['type']>(initial?.type ?? 'corrente')
  const [opening, setOpening] = useState(initial ? inputMoney(initial.openingCents) : '0.00')
  const [reserve, setReserve] = useState(initial?.isReserve ?? false)
  const [description, setDescription] = useState(initial?.description ?? '')
  const [pending, setPending] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    await onSubmit({ name, type, ...(initial ? {} : { openingCents: toCents(opening) }), isReserve: reserve, description })
    setPending(false)
  }
  return (
    <form className="form" onSubmit={submit}>
      <label>Nome da conta
        <input required maxLength={60} autoFocus placeholder="Ex.: Conta do dia a dia" value={name} onChange={event => setName(event.target.value)} />
      </label>
      <div className="form-row">
        <label>Tipo
          <select value={type} onChange={event => setType(event.target.value as Account['type'])}>
            {(['corrente', 'poupança', 'dinheiro', 'investimento', 'outro'] as const).map(option => (
              <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
            ))}
          </select>
        </label>
        {!initial && (
          <label>Saldo inicial (R$)
            <input required type="number" step="0.01" value={opening} onChange={event => setOpening(event.target.value)} />
          </label>
        )}
      </div>
      <label>Descrição <span className="optional">(opcional)</span>
        <input maxLength={200} placeholder="Para que você usa esta conta?" value={description} onChange={event => setDescription(event.target.value)} />
      </label>
      <label className="check-field">
        <input type="checkbox" checked={reserve} onChange={event => setReserve(event.target.checked)} />
        <span className="check-field-text">
          <strong>Esta conta participa da Reserva Financeira</strong>
          <small>O saldo positivo dela entrará na reserva. Não será usado como dinheiro disponível para Sonhos.</small>
        </span>
      </label>
      <FormError error={error} />
      <Button type="submit" wide disabled={pending}>
        <Check size={17} />{pending ? 'Salvando...' : initial ? 'Salvar conta' : 'Criar conta'}
      </Button>
    </form>
  )
}

export function AssetForm({ initial, onSubmit, error }: FormProps<Asset>) {
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<Asset['kind']>(initial?.kind ?? 'asset')
  const [value, setValue] = useState(initial ? inputMoney(initial.amountCents) : '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [pending, setPending] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    await onSubmit({ name, kind, amountCents: toCents(value), note })
    setPending(false)
  }
  return (
    <form className="form" onSubmit={submit}>
      <Segmented value={kind} onChange={setKind} options={[{ value: 'asset', label: 'Bem / ativo' }, { value: 'liability', label: 'Dívida / passivo' }]} />
      <label>Nome
        <input required maxLength={70} autoFocus placeholder={kind === 'asset' ? 'Ex.: Veículo' : 'Ex.: Empréstimo'} value={name} onChange={event => setName(event.target.value)} />
      </label>
      <label>Valor (R$)
        <input required type="number" min="0.01" step="0.01" value={value} onChange={event => setValue(event.target.value)} />
      </label>
      <label>Observação <span className="optional">(opcional)</span>
        <input maxLength={200} value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <FormError error={error} />
      <Button type="submit" wide disabled={pending}>
        <Check size={17} />{pending ? 'Salvando...' : 'Salvar item'}
      </Button>
    </form>
  )
}

export function GoalForm({ initial, onSubmit, error }: FormProps<Goal>) {
  const [kind, setKind] = useState<Goal['kind']>(initial?.kind ?? 'meta')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [target, setTarget] = useState(initial ? inputMoney(initial.targetCents) : '')
  const [icon, setIcon] = useState(initial?.icon ?? '🎯')
  const [deadline, setDeadline] = useState(initial?.deadline ?? '')
  const [pending, setPending] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    await onSubmit({ title, kind, targetCents: toCents(target), icon, deadline: deadline || null })
    setPending(false)
  }
  return (
    <form className="form" onSubmit={submit}>
      <Segmented value={kind} onChange={setKind} options={[{ value: 'meta', label: 'Meta' }, { value: 'sonho', label: 'Sonho' }]} />
      <p className="form-description">
        {kind === 'sonho' ? 'Sonhos podem ter dificuldade analisada a partir do seu histórico financeiro.' : 'Metas ajudam você a acompanhar um objetivo concreto.'} Criar não gera recompensas.
      </p>
      <label>Nome do objetivo
        <input required maxLength={70} autoFocus placeholder="Ex.: Viagem dos sonhos" value={title} onChange={event => setTitle(event.target.value)} />
      </label>
      <div className="field">
        <span className="field-label">Escolha um símbolo</span>
        <div className="icon-picker">
          {goalIcons.map(option => (
            <button key={option} type="button" className={icon === option ? 'active' : ''} aria-pressed={icon === option} onClick={() => setIcon(option)}>{option}</button>
          ))}
        </div>
      </div>
      <div className="form-row">
        <label>Valor desejado (R$)
          <input required type="number" min="0.01" step="0.01" value={target} onChange={event => setTarget(event.target.value)} />
        </label>
        <label>Prazo <span className="optional">(opcional)</span>
          <input type="date" value={deadline} onChange={event => setDeadline(event.target.value)} />
        </label>
      </div>
      <FormError error={error} />
      <Button type="submit" wide disabled={pending}>
        <Check size={17} />{pending ? 'Salvando...' : initial ? 'Salvar objetivo' : 'Criar objetivo'}
      </Button>
    </form>
  )
}

export function ContributionForm({ goal, onSubmit, error }: { goal: Goal; onSubmit: (body: unknown) => Promise<boolean>; error: string }) {
  const [value, setValue] = useState('')
  const [date, setDate] = useState(dateToday())
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    await onSubmit({ amountCents: toCents(value), date, note })
    setPending(false)
  }
  return (
    <form className="form" onSubmit={submit}>
      <p className="form-description">Ainda faltam <strong>{currency(Math.max(0, goal.targetCents - goal.savedCents))}</strong> para este objetivo.</p>
      <div className="form-row">
        <label>Valor do progresso (R$)
          <input required type="number" min="0.01" max={inputMoney(goal.targetCents - goal.savedCents)} step="0.01" autoFocus value={value} onChange={event => setValue(event.target.value)} />
        </label>
        <label>Data
          <input required type="date" max={dateToday()} value={date} onChange={event => setDate(event.target.value)} />
        </label>
      </div>
      <label>Observação <span className="optional">(opcional)</span>
        <input maxLength={200} value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <p className="form-description">Este registro não movimenta contas nem usa automaticamente a Reserva. Se transferiu dinheiro de verdade, registre também a movimentação na conta correspondente.</p>
      <FormError error={error} />
      <Button type="submit" wide disabled={pending}>
        <Check size={17} />{pending ? 'Salvando...' : 'Registrar progresso'}
      </Button>
    </form>
  )
}
