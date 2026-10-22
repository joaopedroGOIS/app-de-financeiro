import {useEffect,useState} from 'react'
import {CheckCircle2,Compass} from 'lucide-react'
import {api,dateToday} from './data'
import type {State} from './data'
import {Button,Card,CardHeader,ProgressBar} from './ui'
export function firstStepStatus(state:Pick<State,'accounts'|'entries'>,budgetCount:number|null) {
 return [state.accounts.length>0,state.entries.some(e=>e.type!=='adjustment'&&!e.cardPaymentId),budgetCount===null?null:budgetCount>0]
}
export function FirstSteps({state,budgetRevision=0,onAccount,onEntry,onBudget}:{state:State;budgetRevision?:number;onAccount:()=>void;onEntry:()=>void;onBudget:()=>void}) {
 const storageKey=`granae:first-steps:${state.user.id}`
 const [hidden,setHidden]=useState(()=>{try{return localStorage.getItem(storageKey)==='hidden'}catch{return false}})
 const [budgetCount,setBudgetCount]=useState<number|null>(null),[budgetError,setBudgetError]=useState(false)
 const month=dateToday().slice(0,7)
 useEffect(()=>{let active=true;setBudgetCount(null);setBudgetError(false);api<{budgets:unknown[]}>(`/budgets?month=${month}`).then(data=>{if(active)setBudgetCount(data.budgets.length)}).catch(()=>{if(active)setBudgetError(true)});return()=>{active=false}},[month,budgetRevision,state.user.id])
 const changeHidden=(next:boolean)=>{setHidden(next);try{if(next)localStorage.setItem(storageKey,'hidden');else localStorage.removeItem(storageKey)}catch{/* This preference is optional. */}}
 if(hidden)return <div className="first-steps-toggle"><button type="button" className="text-action" onClick={()=>changeHidden(false)}><Compass size={16}/>Ver guia de primeiros passos</button></div>
 const status=firstStepStatus(state,budgetCount),done=status.filter(Boolean).length
 const steps=[{title:'Sua conta e o saldo inicial',text:'Cadastre a conta que usa no dia a dia. Informe o saldo atual ao criar; correções posteriores usam um ajuste.',action:status[0]?'Ver contas':'Criar primeira conta',onClick:onAccount},{title:'Sua primeira movimentação',text:'Registre uma receita ou despesa que realmente aconteceu. Compras já cadastradas no cartão também contam nesta etapa.',action:status[1]?'Ver movimentações':'Registrar movimentação',onClick:onEntry},{title:'Um limite para este mês',text:'Escolha uma categoria e defina quanto pretende gastar. O limite não retira dinheiro da conta.',action:'Ver orçamento',onClick:onBudget}]
 return <Card className="first-steps-panel"><CardHeader title={done===3?'Seu começo está organizado':'Primeiros passos no Granaê'} description="Um guia rápido, sem dados fictícios e sem recompensa por preencher etapas." icon={Compass}/><div className="first-steps-progress"><strong>{done}/3 etapas concluídas</strong><button type="button" className="text-action" onClick={()=>changeHidden(true)}>Ocultar neste aparelho</button></div><ProgressBar value={done/3*100} label="Etapas dos primeiros passos"/>
  <ol className="first-steps-list">{steps.map((step,index)=><li key={step.title}><span className={status[index]?'done':''}>{status[index]?<CheckCircle2 size={20}/>:index+1}</span><div><strong>{step.title}</strong><p>{step.text}</p>{index===2&&status[2]===null&&<small>{budgetError?'Não foi possível verificar os limites. Você pode abrir o orçamento para conferir.':'Verificando o orçamento…'}</small>}<Button size="sm" variant="secondary" onClick={step.onClick}>{step.action}</Button></div></li>)}</ol>
 </Card>
}
