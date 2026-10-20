import { MoneyInput } from './components/MoneyInput'
import { debtInstallments } from './debtInstallments'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Check, CircleAlert } from 'lucide-react'
import { currency, dateToday, goalIcons, inputMoney, toCents } from './data'
import type { Account, Asset, Entry, Goal, UserCategory, UserSubcategory } from './data'
import { Button, Segmented } from './ui'

/* ==========================================================================
   Formulários — mesmos campos e mesmas regras do servidor, novo visual.
   ========================================================================== */

function FormError({ error }: { error: string }) {
  if (!error) return null
  return <div className="error-message" role="alert"><CircleAlert size={16} />{error}</div>
}

type FormProps<T> = { initial: T | null; onSubmit: (body: unknown) => Promise<boolean>; error: string }

export function EntryForm({ initial, accounts, categories: userCategories, subcategories: userSubcategories, onSubmit, error }: FormProps<Entry> & { accounts: Account[]; categories: UserCategory[]; subcategories: UserSubcategory[] }) {
  const initialType = initial?.type ?? 'expense'
  const activeForType = userCategories.filter(item => item.type === initialType && !item.archivedAt)
  const [type, setType] = useState<Entry['type']>(initialType)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [value, setValue] = useState(initial ? inputMoney(Math.abs(initial.amountCents)) : '')
  const [adjustmentSign, setAdjustmentSign] = useState(initial?.amountCents && initial.amountCents < 0 ? -1 : 1)
  const [category, setCategory] = useState(initial?.category ?? activeForType[0]?.name ?? 'Alimentação')
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? '')
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? '')
  const [date, setDate] = useState(initial?.date ?? dateToday())
  const [note, setNote] = useState(initial?.note ?? '')
  const [pending, setPending] = useState(false)
  const categoryOptions = userCategories.filter(item => item.type === type && !item.archivedAt)
  const currentCategory = categoryOptions.find(item => item.name === category)
  const subcategoryOptions = currentCategory ? userSubcategories.filter(item => item.categoryId === currentCategory.id && !item.archivedAt) : []
  const legacyCategory = initial && type === initial.type && initial.category && !categoryOptions.some(item => item.name === initial.category) ? initial.category : ''
  const legacySubcategory = initial && type === initial.type && category === initial.category && initial.subcategory && !subcategoryOptions.some(item => item.name === initial.subcategory) ? initial.subcategory : ''
  const changeCategory = (name: string) => { setCategory(name); setSubcategory('') }
  const changeType = (next: Entry['type']) => {
    setType(next)
    const first = userCategories.find(item => item.type === next && !item.archivedAt)
    setCategory(first?.name ?? (next === 'income' ? 'Salário' : next === 'adjustment' ? 'Ajuste de saldo' : 'Alimentação'))
    setSubcategory('')
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    await onSubmit({ type, title, amountCents: toCents(value) * (type === 'adjustment' ? adjustmentSign : 1), category, subcategory, accountId, date, note })
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
          <MoneyInput required min="0.01" max="1000000000" placeholder="0,00" value={value} onValueChange={setValue} />
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
          <select required value={category} onChange={event => changeCategory(event.target.value)}>
            {legacyCategory && <option value={legacyCategory}>{legacyCategory} (histórica)</option>}
            {categoryOptions.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
          </select>
        </label>
      </div>
      {subcategoryOptions.length > 0 || legacySubcategory ? (
        <label>Subcategoria <span className="optional">(opcional)</span>
          <select value={subcategory} onChange={event => setSubcategory(event.target.value)}>
            <option value="">Sem subcategoria</option>
            {legacySubcategory && <option value={legacySubcategory}>{legacySubcategory} (histórica)</option>}
            {subcategoryOptions.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
          </select>
        </label>
      ) : null}
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
            <MoneyInput required value={opening} onValueChange={setOpening} />
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
  const [parcelled, setParcelled] = useState(!!initial?.installmentCount)
  const [installmentCount, setInstallmentCount] = useState(initial?.installmentCount ?? 7)
  const [firstDueDate, setFirstDueDate] = useState(initial?.firstDueDate ?? dateToday())
  const schedule = kind === 'liability' && parcelled ? debtInstallments(toCents(value), installmentCount, firstDueDate) : []
  const [pending, setPending] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    try { await onSubmit({ name, kind, amountCents: toCents(value), note, installmentCount: kind === 'liability' && parcelled ? installmentCount : null, firstDueDate: kind === 'liability' && parcelled ? firstDueDate : null }) }
    finally { setPending(false) }
  }
  return (
    <form className="form" onSubmit={submit}>
      <Segmented value={kind} onChange={setKind} options={[{ value: 'asset', label: 'Bem / ativo' }, { value: 'liability', label: 'Dívida / passivo' }]} />
      <label>Nome
        <input required maxLength={70} autoFocus placeholder={kind === 'asset' ? 'Ex.: Veículo' : 'Ex.: Empréstimo'} value={name} onChange={event => setName(event.target.value)} />
      </label>
      <label>{kind === 'liability' ? 'Valor total da dívida a pagar (R$)' : 'Valor (R$)'}
        <MoneyInput required min="0.01" max="1000000000" value={value} onValueChange={setValue} />
      </label>
      {kind === 'liability' && <>
        <p className="form-description">Informe o total a pagar, incluindo os juros já combinados, se houver. Não cadastre aqui uma dívida que já está nos seus cartões.</p>
        <label className="check-field"><input type="checkbox" checked={parcelled} onChange={event => setParcelled(event.target.checked)} /><span>Esta dívida será paga em parcelas mensais</span></label>
        {parcelled && <><div className="form-row"><label>Número de parcelas<input type="number" min={1} max={360} step={1} required value={installmentCount} onChange={event => setInstallmentCount(Number(event.target.value))} /></label><label>Primeiro vencimento<input type="date" min="1900-01-01" required value={firstDueDate} onChange={event => setFirstDueDate(event.target.value)} /></label></div>
          {schedule.length > 0 ? <details className="debt-schedule" open><summary>{installmentCount} parcelas · total {currency(toCents(value))}</summary><ul>{schedule.map(item => <li key={item.number}><span>{item.number}/{installmentCount} · {item.dueDate.split('-').reverse().join('/')}</span><strong>{currency(item.amountCents)}</strong></li>)}</ul></details> : <p className="form-description">Informe um valor, a quantidade de parcelas e uma data válidos. Cada parcela deve ter pelo menos R$ 0,01.</p>}
          <p className="form-description">O calendário organiza a dívida. As parcelas não debitam contas nem geram despesas automaticamente; o total entra uma única vez no patrimônio.</p>
        </>}
      </>}
      <label>Observação <span className="optional">(opcional)</span>
        <input maxLength={200} value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <FormError error={error} />
      <Button type="submit" wide disabled={pending || (kind === 'liability' && parcelled && !schedule.length)}>
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
          <MoneyInput required min="0.01" value={target} onValueChange={setTarget} />
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
  const [economyConfirmed,setEconomyConfirmed] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    await onSubmit({ amountCents: toCents(value), date, note, economyConfirmed })
    setPending(false)
  }
  return (
    <form className="form" onSubmit={submit}>
      <p className="form-description">Ainda faltam <strong>{currency(Math.max(0, goal.targetCents - goal.savedCents))}</strong> para este objetivo.</p>
      <div className="form-row">
        <label>Valor do progresso (R$)
          <MoneyInput required min="0.01" max={inputMoney(goal.targetCents - goal.savedCents)} autoFocus value={value} onValueChange={setValue} />
        </label>
        <label>Data
          <input required type="date" max={dateToday()} value={date} onChange={event => setDate(event.target.value)} />
        </label>
      </div>
      <label>Observação <span className="optional">(opcional)</span>
        <input maxLength={200} value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <p className="form-description">Este registro não movimenta contas nem usa automaticamente a Reserva. Se transferiu dinheiro de verdade, registre também a movimentação na conta correspondente.</p>
      <label className="check-field"><input type="checkbox" required checked={economyConfirmed} onChange={e=>setEconomyConfirmed(e.target.checked)}/><span>Confirmo que este aporte representa economia real e não foi contabilizado em outro objetivo.</span></label>
      <p className="form-description">A economia diária concede 5 XP uma vez por dia, independentemente do valor. Os marcos do objetivo seguem sua tabela de recompensas.</p>
      <FormError error={error} />
      <Button type="submit" wide disabled={pending}>
        <Check size={17} />{pending ? 'Salvando...' : 'Registrar progresso'}
      </Button>
    </form>
  )
}
