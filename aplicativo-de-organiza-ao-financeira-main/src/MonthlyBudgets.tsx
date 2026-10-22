import {useEffect,useState} from 'react'
import type {FormEvent} from 'react'
import {Target,Plus,Pencil,Trash2} from 'lucide-react'
import {api,currency,inputMoney,json,monthName,toCents} from './data'
import type {State} from './data'
import type {BudgetState,MonthlyBudget} from './budgets'
import {budgetRows,unbudgetedSpending} from './budgets'
import {MoneyInput} from './components/MoneyInput'
import {Badge,Button,Card,CardHeader,ConfirmDialog,InlineError,Modal,ProgressBar} from './ui'

export function MonthlyBudgets({month,state,onChanged}:{month:string;state:State;onChanged?:()=>void}) {
 const [data,setData]=useState<BudgetState|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
 const [editing,setEditing]=useState<MonthlyBudget|null|undefined>(undefined),[removing,setRemoving]=useState<MonthlyBudget|null>(null)
 const [category,setCategory]=useState(''),[value,setValue]=useState(''),[formError,setFormError]=useState(''),[revision,setRevision]=useState(0)
 useEffect(()=>{let active=true;setLoading(true);setError('');api<BudgetState>(`/budgets?month=${month}`).then(result=>{if(active)setData(result)}).catch(()=>{if(active)setError('Não foi possível carregar o orçamento. Seus registros e saldos continuam disponíveis.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[month,state.entries,revision])
 const rows=data?budgetRows(data):[],unplanned=data?unbudgetedSpending(data):0
 const options=[...new Set([...(state.categories?.filter(c=>c.type==='expense'&&!c.archivedAt).map(c=>c.name)??[]),...state.entries.filter(e=>e.type==='expense').map(e=>e.category),...(data?.budgets.map(b=>b.category)??[]),...(data?.spending.map(s=>s.category)??[])])].sort((a,b)=>a.localeCompare(b,'pt-BR'))
 const open=(item:MonthlyBudget|null)=>{setEditing(item);setCategory(item?.category??options[0]??'');setValue(item?inputMoney(item.limitCents):'');setFormError('')}
 const save=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setFormError('');try{await api('/budgets',json('POST',{month,category,limitCents:toCents(value)}));setEditing(undefined);setRevision(n=>n+1);onChanged?.()}catch{setFormError('Não foi possível salvar o limite. Confira o valor e tente novamente.')}finally{setBusy(false)}}
 const remove=async()=>{if(!removing)return;setBusy(true);try{await api(`/budgets/${removing.id}`,{method:'DELETE'});setRemoving(null);setRevision(n=>n+1);onChanged?.()}catch{setFormError('Não foi possível retirar o limite. Tente novamente.')}finally{setBusy(false)}}
 return <Card className="monthly-budget-panel">
  <CardHeader title="Seu plano do mês" description={`Orçamento por categoria · ${monthName(month)}`} icon={Target} action={!loading&&!error&&<Button size="sm" variant="secondary" disabled={!options.length} onClick={()=>open(null)}><Plus size={16}/>Definir limite</Button>}/>
  <p className="card-description">Planeje seus gastos sem reservar ou movimentar dinheiro. Os limites valem somente para este mês.</p>
  {loading?<p role="status">Carregando orçamento…</p>:error?<><InlineError>{error}</InlineError><Button variant="secondary" onClick={()=>setRevision(n=>n+1)}>Tentar novamente</Button></>:<>
   {!!rows.length&&<div className="budget-summary"><div><span>Limites definidos</span><strong>{currency(rows.reduce((s,r)=>s+r.limitCents,0))}</strong></div><div><span>Gasto nas categorias planejadas</span><strong>{currency(rows.reduce((s,r)=>s+r.spentCents,0))}</strong></div></div>}
   <div className="budget-category-list">{rows.map(row=><article className="budget-category" key={row.id}><div className="budget-category-top"><strong>{row.category}</strong><Badge tone={row.status==='exceeded'?'danger':row.status==='near'||row.status==='reached'?'warning':'success'}>{row.status==='exceeded'?'Acima do limite':row.status==='reached'?'Limite atingido':row.status==='near'?'Perto do limite':'Dentro do plano'}</Badge><button className="icon-button" aria-label={`Editar limite de ${row.category}`} onClick={()=>open(row)}><Pencil size={15}/></button><button className="icon-button" aria-label={`Retirar limite de ${row.category}`} onClick={()=>{setFormError('');setRemoving(row)}}><Trash2 size={15}/></button></div><p>{currency(row.spentCents)} <span>de {currency(row.limitCents)} planejados</span></p><ProgressBar value={row.percent} label={`Limite de ${row.category}`}/><small>{row.remainingCents<0?`${currency(-row.remainingCents)} acima do limite`:`Restam ${currency(row.remainingCents)} no limite`}</small></article>)}</div>
   {!rows.length&&<p>Comece com uma categoria que deseja acompanhar. Não é necessário planejar todas de uma vez.</p>}
   {!options.length&&<p>Crie uma categoria de gasto ou registre uma despesa para começar.</p>}
   {unplanned>0&&<p className="info-note">{currency(unplanned)} em gastos de categorias sem limite definido. Esses gastos não estão incluídos nos limites acima.</p>}
   <p className="card-description">Inclui despesas registradas e parcelas de cartão pelo mês de vencimento. Pagamentos de fatura e ajustes não são novos gastos. Renomear uma categoria não altera os rótulos históricos.</p>
  </>}
  {editing!==undefined&&<Modal title={editing?'Editar limite mensal':'Definir limite mensal'} onClose={()=>{if(!busy)setEditing(undefined)}}><form className="form" onSubmit={save}><p>{monthName(month)} · Este planejamento não concede XP ou Graninha.</p><label>Categoria<select required disabled={!!editing||busy} value={category} onChange={e=>setCategory(e.target.value)}>{options.map(c=><option key={c}>{c}</option>)}</select></label><label>Limite de gasto (R$)<MoneyInput required min="0.01" max="1000000000" value={value} onValueChange={setValue}/></label><p className="card-description">Salvar uma categoria já planejada atualiza seu limite neste mês.</p>{formError&&<InlineError>{formError}</InlineError>}<Button type="submit" disabled={busy}>{busy?'Salvando…':'Salvar limite'}</Button></form></Modal>}
  {removing&&<><ConfirmDialog title="Retirar limite mensal?" description={`Retirar o limite de ${removing.category} em ${monthName(month)}? Os gastos e saldos serão preservados. Você pode definir outro limite depois.`} confirmLabel={busy?'Retirando…':'Retirar limite'} onConfirm={()=>{if(!busy)void remove()}} onCancel={()=>{if(!busy)setRemoving(null)}}/>{formError&&<InlineError>{formError}</InlineError>}</>}
 </Card>
}
