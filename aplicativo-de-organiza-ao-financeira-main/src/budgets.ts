export type MonthlyBudget = {id:string;category:string;limitCents:number}
export type BudgetState = {budgets:MonthlyBudget[];spending:{category:string;spentCents:number}[]}
export function budgetRows(state:BudgetState) {
 return state.budgets.map(budget=>{
  const spentCents=state.spending.filter(s=>s.category===budget.category).reduce((sum,s)=>sum+s.spentCents,0)
  const remainingCents=budget.limitCents-spentCents
  return {...budget,spentCents,remainingCents,percent:spentCents/budget.limitCents*100,status:remainingCents<0?'exceeded':remainingCents===0?'reached':spentCents>=budget.limitCents*.8?'near':'within'}
 })
}
export function unbudgetedSpending(state:BudgetState) {
 const categories=new Set(state.budgets.map(b=>b.category))
 return state.spending.filter(s=>!categories.has(s.category)).reduce((sum,s)=>sum+s.spentCents,0)
}
