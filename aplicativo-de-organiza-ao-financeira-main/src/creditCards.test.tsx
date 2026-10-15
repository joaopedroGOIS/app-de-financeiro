import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { cardBills, cardOutstanding, cardExpenseEntries, emptyCardState, firstCardBill, installmentPreview } from './creditCards'
import type { CardState } from './creditCards'
import { netStats } from './data'
import type { State } from './data'
import { CreditCardsPage, CreditCardForm, CardPurchaseForm, CardPaymentForm } from './pages/CreditCards'
import { EntryRow } from './pages/Dashboard'

const card = { id:'card',name:'Meu cartão',lastFour:'1234',limitCents:100000,closingDay:20,dueDay:28,archivedAt:null }
const purchase = { id:'purchase',cardId:'card',title:'Notebook',category:'Compras',subcategory:'',amountCents:10000,date:'2026-10-10',installments:3,note:'' }
const state: CardState = { cards:[card],purchases:[purchase],installments:installmentPreview(10000,3,'2026-10',28).map(i=>({id:`i-${i.number}`,purchaseId:'purchase',cardId:'card',number:i.number,amountCents:i.amountCents,dueDate:i.dueDate,billMonth:i.dueDate.slice(0,7)})),payments:[] }
const noop = ()=>{}
const uiState: State = { user:{id:'u',name:'Ana',email:''},accounts:[{id:'a',name:'Conta',type:'corrente',openingCents:100000,balanceCents:100000,isReserve:false,description:''}],entries:[],archivedEntries:[],assets:[],goals:[],progress:{xp_total:0,level:1,graninha_balance:0,nextLevelXp:null},preferences:{theme:'dark'},stats:{reserveCents:0,netWorthCents:90000,streak:0,financialClass:null},creditCards:state,creditCardsEnabled:true }

test('fatura respeita fechamento, virada do ano e vencimento no mês seguinte',()=>{
  assert.equal(firstCardBill('',20,5),'')
  assert.equal(firstCardBill('2026-10-19',20,28),'2026-10')
  assert.equal(firstCardBill('2026-10-20',20,28),'2026-11')
  assert.equal(firstCardBill('2026-12-21',20,5),'2027-02')
  assert.equal(firstCardBill('2026-10-10',20,5),'2026-11')
  assert.equal(firstCardBill('2028-02-29',31,5),'2028-04')
})
test('parcelas preservam todos os centavos e ajustam meses curtos sem deslocar os meses seguintes',()=>{
  const items=installmentPreview(10000,3,'2028-01',31)
  assert.deepEqual(items.map(i=>i.amountCents),[3334,3333,3333])
  assert.deepEqual(items.map(i=>i.dueDate),['2028-01-31','2028-02-29','2028-03-31'])
  assert.equal(items.reduce((sum,i)=>sum+i.amountCents,0),10000)
  assert.equal(installmentPreview(100,1,'2027-02',31)[0].dueDate,'2027-02-28')
  assert.deepEqual(installmentPreview(2,3,'2026-10',28),[])
  assert.deepEqual(installmentPreview(100,0,'2026-10',28),[])
  assert.deepEqual(installmentPreview(100,3,'',28),[])
})
test('pagamento parcial reduz dívida e limite comprometido sem duplicar despesa',()=>{
  const data={...state,payments:[{id:'pay',cardId:'card',accountId:'a',billMonth:'2026-10',amountCents:2000,date:'2026-10-28',note:''}]}
  const bills=cardBills(data)
  assert.equal(bills[0].totalCents,3334)
  assert.equal(bills[0].remainingCents,1334)
  assert.equal(cardOutstanding(data),8000)
  assert.equal(cardExpenseEntries(data).reduce((sum,e)=>sum+e.amountCents,0),10000)
  const accounts=[{id:'a',opening_cents:100000,is_reserve:true}]
  const before=netStats(accounts,[],[],state)
  const after=netStats(accounts,[],[],data)
  assert.equal(before.netWorthCents,90000)
  assert.equal(after.netWorthCents,90000,'pagar dívida não altera patrimônio líquido')
  assert.equal(after.balances[0].balanceCents,98000)
  assert.equal(after.reserveCents,98000)
})
test('liquidação marca somente a fatura paga e mantém parcelas futuras na dívida',()=>{
  const data={...state,payments:[{id:'pay',cardId:'card',accountId:'a',billMonth:'2026-10',amountCents:3334,date:'2026-10-28',note:''}]}
  const entries=cardExpenseEntries(data)
  assert.equal(entries[0].settled,true)
  assert.equal(entries[1].settled,false)
  assert.equal(entries[0].date,'2026-10-28')
  assert.equal(entries[1].date,'2026-11-28')
  assert.match(entries[1].title,/2\/3/)
  assert.equal(cardOutstanding(data,'card'),6666)
  assert.equal(cardOutstanding(data,'other'),0)
})
test('tela exibe limite, parcelas, fatura e ação de registrar pagamento',()=>{
  const html=renderToStaticMarkup(<CreditCardsPage state={uiState} month="2026-10" setMonth={noop} onUpdated={async()=>{}} toast={noop}/>)
  assert.match(html,/Meu cartão/)
  assert.match(html,/R\$\s900,00/)
  assert.match(html,/Parcela 1\/3/)
  assert.match(html,/Registrar pagamento/)
  assert.match(html,/sem duplicar despesas/)
})
test('cadastro só pede identificação parcial e formulários mostram prévia e contas',()=>{
  const form=renderToStaticMarkup(<CreditCardForm initial={null} error="" onSubmit={async()=>{}}/>)
  assert.match(form,/Últimos 4 dígitos/)
  assert.doesNotMatch(form,/CVV|Número completo/)
  const buy=renderToStaticMarkup(<CardPurchaseForm card={card} availableCents={90000} categories={[{id:'cat',name:'Compras',type:'expense',archivedAt:null}]} subcategories={[]} error="" onSubmit={async()=>{}}/>)
  assert.match(buy,/Primeira fatura/)
  assert.match(buy,/Esta compra tem juros/)
  assert.match(buy,/Valor original, sem juros/)
  assert.match(buy,/Parcelas/)
  const pay=renderToStaticMarkup(<CardPaymentForm bill={cardBills(state)[0]} accounts={uiState.accounts} error="" onSubmit={async()=>{}}/>)
  assert.match(pay,/Conta de origem/)
  assert.match(pay,/Pagamentos parciais/)
})
test('lançamentos de cartão não oferecem edição de lançamento bancário',()=>{
  const html=renderToStaticMarkup(<EntryRow entry={cardExpenseEntries(state)[0]} account="Meu cartão" onEdit={noop} onRemove={noop}/>)
  assert.doesNotMatch(html,/aria-label="Editar|aria-label="Arquivar/)
  assert.match(html,/Em Cartões/)
})
test('sem migration a tela informa indisponibilidade e não permite criar cartão',()=>{
  const html=renderToStaticMarkup(<CreditCardsPage state={{...uiState,creditCardsEnabled:false,creditCards:emptyCardState()}} month="2026-10" setMonth={noop} onUpdated={async()=>{}} toast={noop}/>)
  assert.match(html,/Cartões em preparação/)
  assert.doesNotMatch(html,/Adicionar cartão/)
})
