import { useState } from 'react'
import type { FormEvent } from 'react'
import { Archive, Check, CreditCard as CreditCardIcon, Plus, Pencil, ShoppingBag, Wallet } from 'lucide-react'
import { api, currency, dateToday, displayDate, inputMoney, json, monthName, monthShift, percent, toCents } from '../data'
import type { Account, State, UserCategory, UserSubcategory } from '../data'
import { cardBills, cardOutstanding, emptyCardState, firstCardBill, installmentPreview } from '../creditCards'
import type { CardBill, CreditCard } from '../creditCards'
import { Badge, Button, Card, CardHeader, EmptyState, InlineError, Modal, MonthPicker, ProgressBar } from '../ui'

type SaveForm = { error: string; onSubmit: (body: any, key: string) => Promise<void> }

export function CreditCardForm({ initial, error, onSubmit }: SaveForm & { initial: CreditCard | null }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [lastFour, setLastFour] = useState(initial?.lastFour ?? '')
  const [limit, setLimit] = useState(initial ? inputMoney(initial.limitCents) : '')
  const [closingDay, setClosingDay] = useState(initial?.closingDay ?? 20)
  const [dueDay, setDueDay] = useState(initial?.dueDay ?? 28)
  const [key] = useState(() => crypto.randomUUID())
  const [pending, setPending] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setPending(true); try { await onSubmit({ name, lastFour, limitCents:toCents(limit),closingDay,dueDay },key) } finally { setPending(false) } }
  return <form className="form" onSubmit={submit}>
    <label>Nome do cartão<input autoFocus required maxLength={60} placeholder="Ex.: Meu cartão principal" value={name} onChange={e=>setName(e.target.value)} /></label>
    <div className="form-row">
      <label>Limite total (R$)<input type="number" inputMode="decimal" min="0.01" max="1000000000" step="0.01" required value={limit} onChange={e=>setLimit(e.target.value)} /></label>
      <label>Últimos 4 dígitos (opcional)<input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="1234" value={lastFour} onChange={e=>setLastFour(e.target.value.replace(/\D/g,''))} /></label>
    </div>
    <div className="form-row">
      <label>Dia do fechamento<input type="number" min={1} max={31} step={1} required value={closingDay} onChange={e=>setClosingDay(Number(e.target.value))} /></label>
      <label>Dia do vencimento<input type="number" min={1} max={31} step={1} required value={dueDay} onChange={e=>setDueDay(Number(e.target.value))} /></label>
    </div>
    <p className="form-description">Compras no dia do fechamento entram na próxima fatura. Em meses mais curtos, usamos o último dia do mês. {initial && 'Alterações nas datas valem apenas para novas compras; parcelas existentes mantêm seus vencimentos.'}</p>
    {error && <InlineError>{error}</InlineError>}
    <Button type="submit" wide disabled={pending}>{pending ? 'Salvando...' : initial ? 'Salvar cartão' : 'Cadastrar cartão'}</Button>
  </form>
}

export function CardPurchaseForm({ card, availableCents, categories, subcategories, error, onSubmit }: SaveForm & { card: CreditCard; availableCents: number; categories: UserCategory[]; subcategories: UserSubcategory[] }) {
  const active = categories.filter(c=>c.type==='expense' && !c.archivedAt)
  const [title,setTitle] = useState(''), [value,setValue] = useState(''), [date,setDate] = useState(dateToday())
  const [count,setCount] = useState(1), [firstMonth,setFirstMonth] = useState('')
  const [category,setCategory] = useState(active[0]?.name ?? ''), [subcategory,setSubcategory] = useState(''), [note,setNote] = useState('')
  const [key] = useState(()=>crypto.randomUUID()), [pending,setPending] = useState(false)
  const first = firstMonth || firstCardBill(date,card.closingDay,card.dueDay)
  const total = toCents(value), preview = installmentPreview(total,count,first,card.dueDay)
  const parent = active.find(c=>c.name===category), subs = subcategories.filter(s=>s.categoryId===parent?.id && !s.archivedAt)
  const submit = async (event: FormEvent) => { event.preventDefault(); setPending(true); try { await onSubmit({cardId:card.id,title,amountCents:total,date,installments:count,firstMonth:first,category,subcategory,note},key) } finally { setPending(false) } }
  return <form className="form" onSubmit={submit}>
    <p className="form-description">{card.name} · Limite disponível: <strong>{currency(availableCents)}</strong>. O valor total da compra compromete o limite.</p>
    <label>Descrição<input autoFocus required maxLength={80} placeholder="Ex.: Compra no mercado" value={title} onChange={e=>setTitle(e.target.value)} /></label>
    <div className="form-row">
      <label>Valor total da compra (R$)<input type="number" inputMode="decimal" min="0.01" max={inputMoney(availableCents)} step="0.01" required value={value} onChange={e=>setValue(e.target.value)} /></label>
      <label>Data da compra<input type="date" required max={dateToday()} value={date} onChange={e=>{setDate(e.target.value);setFirstMonth('')}} /></label>
    </div>
    <div className="form-row">
      <label>Parcelas<input type="number" min={1} max={60} step={1} required value={count} onChange={e=>setCount(Number(e.target.value))} /></label>
      <label>Primeira fatura<input type="month" required value={first} min={date.slice(0,7)} max={monthShift(date.slice(0,7),12)} onChange={e=>setFirstMonth(e.target.value)} /></label>
    </div>
    <div className="form-row">
      <label>Categoria<select required value={category} onChange={e=>{setCategory(e.target.value);setSubcategory('')}}>{active.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label>
      {subs.length>0 && <label>Subcategoria<select value={subcategory} onChange={e=>setSubcategory(e.target.value)}><option value="">Sem subcategoria</option>{subs.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select></label>}
    </div>
    {!active.length && <InlineError>Crie uma categoria de gasto em Meu perfil antes de registrar a compra.</InlineError>}
    <label>Observação (opcional)<input maxLength={300} value={note} onChange={e=>setNote(e.target.value)} /></label>
    {preview.length>0 && <details className="card-installment-preview"><summary>{count===1 ? 'Compra à vista no crédito' : `${count} parcelas`} · primeira em {displayDate(preview[0].dueDate)}</summary><ul>{preview.map(p=><li key={p.number}>{p.number}/{count} · {displayDate(p.dueDate)} · {currency(p.amountCents)}</li>)}</ul></details>}
    <p className="form-description">Cada parcela entra nas despesas do mês do vencimento. O pagamento da fatura não será uma nova despesa. Se o banco usar outra primeira fatura, ajuste o mês acima.</p>
    {error && <InlineError>{error}</InlineError>}
    <Button type="submit" wide disabled={pending || !active.length || !preview.length || total>availableCents}>{pending?'Registrando...':'Registrar compra'}</Button>
  </form>
}

export function CardPaymentForm({ bill, accounts, error, onSubmit }: SaveForm & { bill: CardBill; accounts: Account[] }) {
  const [accountId,setAccountId] = useState(accounts[0]?.id ?? ''), [value,setValue] = useState(inputMoney(bill.remainingCents)), [date,setDate] = useState(dateToday()), [note,setNote] = useState('')
  const [key] = useState(()=>crypto.randomUUID()), [pending,setPending] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setPending(true); try { await onSubmit({cardId:bill.cardId,month:bill.month,accountId,amountCents:toCents(value),date,note},key) } finally { setPending(false) } }
  return <form className="form" onSubmit={submit}>
    <p className="form-description">Registre um pagamento que você já realizou. Saldo da fatura: <strong>{currency(bill.remainingCents)}</strong>. O valor sairá do saldo da conta selecionada e liberará limite no cartão.</p>
    <label>Conta de origem<select required value={accountId} onChange={e=>setAccountId(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {currency(a.balanceCents)}</option>)}</select></label>
    {!accounts.length && <InlineError>Adicione uma conta em Minhas contas para registrar o pagamento.</InlineError>}
    <div className="form-row"><label>Valor pago (R$)<input type="number" min="0.01" max={inputMoney(bill.remainingCents)} step="0.01" required value={value} onChange={e=>setValue(e.target.value)} /></label><label>Data do pagamento<input type="date" max={dateToday()} required value={date} onChange={e=>setDate(e.target.value)} /></label></div>
    <label>Observação (opcional)<input maxLength={300} value={note} onChange={e=>setNote(e.target.value)} /></label>
    <p className="form-description">Pagamentos parciais ficam registrados; o restante continua em aberto. Juros e encargos devem ser registrados como compras separadas.</p>
    {error && <InlineError>{error}</InlineError>}
    <Button type="submit" wide disabled={pending || !accounts.length}>{pending?'Registrando...':'Registrar pagamento'}</Button>
  </form>
}

export function CreditCardsPage({ state, onUpdated, toast, month, setMonth }: { state: State; onUpdated: ()=>Promise<unknown>; toast: (message:string,tone?:'success'|'error')=>void; month:string; setMonth:(month:string)=>void }) {
  const data = state.creditCards ?? emptyCardState()
  const [selectedId,setSelectedId] = useState(''), [showArchived,setShowArchived] = useState(false)
  const [modal,setModal] = useState<'create'|'edit'|'purchase'|'payment'|null>(null), [error,setError] = useState(''), [busy,setBusy] = useState(false)
  const [confirm,setConfirm] = useState<{path:string;message:string}|null>(null)
  const cards = data.cards.filter(c=>showArchived || !c.archivedAt), selected = cards.find(c=>c.id===selectedId) ?? cards[0]
  const bills = selected ? cardBills(data).filter(b=>b.cardId===selected.id) : []
  const bill = bills.find(b=>b.month===month), outstanding = selected ? cardOutstanding(data,selected.id) : 0
  const open = (kind: typeof modal) => { setError(''); setModal(kind) }
  const save = (path:string,method:string) => async (body:any,key:string) => {
    setError('')
    try { await api(path,{...json(method,body),headers:{'Idempotency-Key':key}}); await onUpdated(); setModal(null); toast('Registro salvo.') }
    catch (err) { setError((err as Error).message) }
  }
  const remove = async () => { if(!confirm)return; setBusy(true); try { await api(confirm.path,{method:'DELETE'});await onUpdated();setConfirm(null);toast('Registro atualizado.')} catch(err){toast((err as Error).message,'error')} finally {setBusy(false)} }
  if (state.creditCardsEnabled===false) return <EmptyState icon={<CreditCardIcon size={30}/>} title="Cartões em preparação" text="O cadastro de cartões será liberado assim que a atualização do banco de dados for concluída." />
  return <>
    <div className="section-heading"><div><h2>Seus cartões</h2><p>Limite, compras e faturas em um só lugar.</p></div><Button onClick={()=>open('create')}><Plus size={17}/>Adicionar cartão</Button></div>
    {data.cards.some(c=>c.archivedAt) && <label className="check-field"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/><span>Mostrar cartões arquivados</span></label>}
    {cards.length ? <>
      <div className="credit-card-tabs" role="group" aria-label="Selecionar cartão">{cards.map(c=><button type="button" key={c.id} className={`credit-card-tab ${selected?.id===c.id?'active':''}`} aria-pressed={selected?.id===c.id} onClick={()=>setSelectedId(c.id)}><CreditCardIcon size={18}/><span>{c.name}{c.lastFour ? ` · ${c.lastFour}`:''}{c.archivedAt?' · Arquivado':''}</span></button>)}</div>
      {selected && <>
        <Card className="credit-card-overview"><div className="section-heading"><div><h2>{selected.name}</h2><p>{selected.lastFour ? `Final ${selected.lastFour} · `:''}Fecha dia {selected.closingDay} · vence dia {selected.dueDay}</p></div>{!selected.archivedAt && <div className="credit-card-actions"><Button variant="ghost" size="sm" onClick={()=>open('edit')}><Pencil size={15}/>Editar</Button><Button variant="ghost" size="sm" onClick={()=>setConfirm({path:`/credit-cards/${selected.id}`,message:'Arquivar este cartão? É necessário quitar todas as faturas. O histórico será preservado.'})}><Archive size={15}/>Arquivar</Button></div>}</div>
          <div className="mini-stats"><div className="mini-stat"><span>Limite total</span><strong>{currency(selected.limitCents)}</strong></div><div className="mini-stat"><span>Comprometido, incluindo parcelas futuras</span><strong>{currency(outstanding)}</strong></div><div className="mini-stat"><span>Limite disponível</span><strong className="positive">{currency(Math.max(0,selected.limitCents-outstanding))}</strong></div></div>
          <ProgressBar value={percent(outstanding,selected.limitCents)} label="Limite comprometido" tone={outstanding>=selected.limitCents?'danger':''}/>
          {!selected.archivedAt && <Button onClick={()=>open('purchase')} disabled={outstanding>=selected.limitCents}><ShoppingBag size={17}/>Registrar compra</Button>}
        </Card>
        <Card><CardHeader title="Fatura" description="Despesas organizadas pelo mês do vencimento." action={<MonthPicker label={monthName(month)} onPrevious={()=>setMonth(monthShift(month,-1))} onNext={()=>setMonth(monthShift(month,1))}/>}/>
          {bills.length>0 && <label className="credit-bill-picker">Ir para uma fatura<select value={bill?month:''} onChange={e=>{if(e.target.value)setMonth(e.target.value)}}><option value="">Selecione o mês</option>{bills.map(b=><option key={b.month} value={b.month}>{monthName(b.month)} · {currency(b.remainingCents)} em aberto</option>)}</select></label>}
          {bill ? <>
            <div className="credit-bill-heading"><div><span>Vencimento em {displayDate(bill.dueDate)}</span><h3>{currency(bill.remainingCents)} em aberto</h3><small>Total {currency(bill.totalCents)} · pago {currency(bill.paidCents)}</small></div><Badge tone={!bill.remainingCents?'success':bill.dueDate<dateToday()?'danger':'warning'}>{!bill.remainingCents?'Paga':bill.dueDate<dateToday()?'Vencida':bill.paidCents?'Pagamento parcial':'Em aberto'}</Badge></div>
            <div className="entry-list">{bill.installments.map(item=>{const purchase=data.purchases.find(p=>p.id===item.purchaseId);return <div className="entry-row" key={item.id}><span className="entry-glyph"><ShoppingBag size={18}/></span><div className="entry-main"><strong>{purchase?.title}</strong><span className="entry-meta">{purchase?.category}{purchase?.subcategory?` · ${purchase.subcategory}`:''} · Parcela {item.number}/{purchase?.installments}</span></div><strong>{currency(item.amountCents)}</strong></div>})}</div>
            {bill.remainingCents>0 && !selected.archivedAt && <Button onClick={()=>open('payment')}><Wallet size={17}/>Registrar pagamento</Button>}
            {data.payments.some(p=>p.cardId===selected.id&&p.billMonth===month) && <><h3 className="credit-payments-title">Pagamentos registrados</h3>{data.payments.filter(p=>p.cardId===selected.id&&p.billMonth===month).map(p=><div className="entry-row" key={p.id}><Check size={18}/><div className="entry-main"><strong>{state.accounts.find(a=>a.id===p.accountId)?.name??'Conta'}</strong><span className="entry-meta">{displayDate(p.date)}{p.note?` · ${p.note}`:''}</span></div><strong className="positive">{currency(p.amountCents)}</strong><button type="button" className="icon-button" aria-label="Desfazer registro de pagamento" onClick={()=>setConfirm({path:`/card-payments/${p.id}`,message:'Desfazer este registro? O saldo voltará à conta de origem, a dívida será reaberta e o limite será recalculado. Nenhuma operação será realizada no banco ou na operadora do cartão.'})}><Archive size={16}/></button></div>)}</>}
          </> : <EmptyState icon={<CreditCardIcon size={26}/>} title="Sem compras nesta fatura" text="Selecione outro mês ou registre uma compra neste cartão."/>}
        </Card>
        {data.purchases.some(p=>p.cardId===selected.id) && <Card><CardHeader title="Compras do cartão" description="Valores totais das compras e parcelamento."/>{data.purchases.filter(p=>p.cardId===selected.id).map(p=><div className="entry-row" key={p.id}><div className="entry-main"><strong>{p.title}</strong><span className="entry-meta">{displayDate(p.date)} · {p.installments===1?'À vista no crédito':`${p.installments} parcelas`}</span></div><strong>{currency(p.amountCents)}</strong>{!selected.archivedAt && <button type="button" className="icon-button" aria-label={`Arquivar compra ${p.title}`} onClick={()=>setConfirm({path:`/card-purchases/${p.id}`,message:`Arquivar “${p.title}” e retirar suas parcelas das faturas? Compras em faturas com pagamentos registrados não podem ser arquivadas.`})}><Archive size={16}/></button>}</div>)}</Card>}
      </>}
    </> : <EmptyState icon={<CreditCardIcon size={30}/>} title="Seu primeiro cartão" text="Cadastre limite, fechamento e vencimento para acompanhar suas compras." action={<Button onClick={()=>open('create')}>Cadastrar cartão</Button>}/>}
    <div className="info-note"><CreditCardIcon size={20}/><p>Compras entram nas despesas do mês do vencimento de cada parcela. Pagamentos saem da conta de origem e reduzem a dívida, sem duplicar despesas. Parcelas futuras também comprometem o limite e o patrimônio. Evite registrar a mesma compra ou dívida novamente em Movimentações ou Bens e dívidas.</p></div>
    {(modal==='create'||modal==='edit') && <Modal title={modal==='create'?'Adicionar cartão':'Editar cartão'} onClose={()=>setModal(null)}><CreditCardForm initial={modal==='edit'?selected:null} error={error} onSubmit={save(modal==='edit'?`/credit-cards/${selected?.id}`:'/credit-cards',modal==='edit'?'PATCH':'POST')}/></Modal>}
    {modal==='purchase'&&selected && <Modal title="Compra no cartão" onClose={()=>setModal(null)}><CardPurchaseForm card={selected} availableCents={Math.max(0,selected.limitCents-outstanding)} categories={state.categories??[]} subcategories={state.subcategories??[]} error={error} onSubmit={save('/card-purchases','POST')}/></Modal>}
    {modal==='payment'&&bill && <Modal title="Registrar pagamento da fatura" onClose={()=>setModal(null)}><CardPaymentForm bill={bill} accounts={state.accounts} error={error} onSubmit={save('/card-payments','POST')}/></Modal>}
    {confirm && <Modal title="Confirmar alteração" onClose={()=>{if(!busy)setConfirm(null)}}><p>{confirm.message}</p><div className="confirm-actions"><Button variant="secondary" disabled={busy} onClick={()=>setConfirm(null)}>Cancelar</Button><Button disabled={busy} onClick={remove}>{busy?'Arquivando...':'Confirmar'}</Button></div></Modal>}
  </>
}
