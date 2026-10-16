import { useState } from 'react'
import { CalendarCheck } from 'lucide-react'
import { api, currency, dateToday, json } from './data'
import type { State } from './data'
import { Button, Card, CardHeader, InlineError, Modal } from './ui'

const routines=[
  {kind:'no_expense_day',title:'Hoje não tive gastos',text:'Confirme que registrou tudo e não teve gastos hoje. Esse hábito é alternativo ao registro diário: juntos valem no máximo 5 XP por dia.'},
  {kind:'weekly_review_completed',title:'Revisar esta semana',text:'Confira as receitas e despesas da semana, incluindo parcelas de cartão. Confirme depois de revisar seus registros.'},
  {kind:'monthly_review_completed',title:'Revisar este mês',text:'Confira as receitas e despesas do mês, incluindo parcelas de cartão. Confirme depois de revisar seus registros.'},
]
export function FinancialRoutines({state,onUpdated}:{state:State;onUpdated:()=>Promise<void>}) {
  const [selected,setSelected]=useState<typeof routines[number]|null>(null), [pending,setPending]=useState(false), [error,setError]=useState('')
  const today=dateToday(), week=new Date(`${today}T12:00:00Z`)
  week.setUTCDate(week.getUTCDate()-((week.getUTCDay()+6)%7))
  const start=selected?.kind==='weekly_review_completed'?week.toISOString().slice(0,10):selected?.kind==='monthly_review_completed'?today.slice(0,7)+'-01':today
  const entries=state.entries.filter(e=>e.date>=start&&e.date<=today&&e.type!=='adjustment')
  const income=entries.filter(e=>e.type==='income').reduce((s,e)=>s+e.amountCents,0), expenses=entries.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amountCents,0)
  const complete=async()=>{
    if(!selected)return
    setPending(true);setError('')
    try {await api('/routines',json('POST',{kind:selected.kind}));setSelected(null);await onUpdated()}
    catch(err){setError((err as Error).message)} finally {setPending(false)}
  }
  return <Card><CardHeader title="Sua rotina financeira" description="Revise seus registros e acompanhe sua constância" icon={CalendarCheck}/>
    <p className="card-description">A primeira receita ou despesa registrada no dia conclui o hábito diário. Mais lançamentos não multiplicam essa recompensa.</p>
    <div className="routine-actions">{routines.map(item=><Button key={item.kind} variant="secondary" disabled={!state.gamification?.configVersion} onClick={()=>{setSelected(item);setError('')}}>{item.title}</Button>)}</div>
    {selected&&<Modal title={selected.title} onClose={()=>{if(!pending)setSelected(null)}}>
      <p>{selected.text}</p><p>Período: {start} a {today}</p>
      <div className="info-note"><p>Receitas: <strong>{currency(income)}</strong><br/>Despesas: <strong>{currency(expenses)}</strong><br/>Saldo do período: <strong>{currency(income-expenses)}</strong></p></div>
      <ul className="reward-history">{entries.map(e=><li key={e.id}><div><strong>{e.title}</strong><small>{e.date} · {e.category}</small></div><strong>{currency(e.amountCents)}</strong></li>)}</ul>
      {error&&<InlineError>{error}</InlineError>}
      <Button wide disabled={pending} onClick={complete}>{pending?'Confirmando...':selected.kind==='no_expense_day'?'Confirmo que não tive gastos hoje':'Revisei minhas movimentações'}</Button>
    </Modal>}
    {!selected&&error&&<InlineError>{error}</InlineError>}
  </Card>
}
