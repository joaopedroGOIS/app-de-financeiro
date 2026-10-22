export type RecurringTemplate={id:string;title:string;category:string;amountCents:number;dueDay:number;startMonth:string;stoppedOn:string|null}
export type RecurringItem=RecurringTemplate&{dueDate:string;entryId:string|null;paidAmountCents:number|null;paidCategory?:string|null;paymentDate:string|null;status:'paid'|'reversed'|'overdue'|'pending'}
export type RecurringState={today:string;templates:RecurringTemplate[];items:RecurringItem[]}
/** Keep the original day: January 31 -> February 28/29 -> March 31. */
export function recurringDueDate(month:string,day:number) {
 if(!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)||!Number.isInteger(day)||day<1||day>31)return ''
 const last=new Date(`${month}-01T12:00:00Z`);last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0)
 return `${month}-${String(Math.min(day,last.getUTCDate())).padStart(2,'0')}`
}
