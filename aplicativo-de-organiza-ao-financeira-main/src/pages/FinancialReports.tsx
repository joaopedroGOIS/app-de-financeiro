import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { compact, currency, displayDate, monthName } from '../data'
import type { Entry } from '../data'
import { monthlyReport } from '../reports'
import { Card, CardHeader, EmptyState } from '../ui'

export function ReportDetails({ entries, title }: { entries: Entry[]; title: string }) {
  return <details className="report-details" open>
    <summary>{title} · {entries.length} lançamento(s)</summary>
    {entries.length ? <div className="report-table-scroll"><table>
      <caption className="sr-only">Lançamentos de {title}</caption>
      <thead><tr><th>Data</th><th>Descrição / categoria</th><th>Valor</th></tr></thead>
      <tbody>{[...entries].sort((a, b) => b.date.localeCompare(a.date)).map(entry => <tr key={entry.id}>
        <td>{displayDate(entry.date)}</td><td>{entry.title}<small>{entry.category}{entry.cardId ? ' · Cartão' : ''}</small></td>
        <td className={entry.type === 'income' ? 'positive' : 'negative'}>{entry.type === 'income' ? '+' : '−'}{currency(entry.amountCents)}</td>
      </tr>)}</tbody>
    </table></div> : <p>Nenhuma movimentação registrada neste mês.</p>}
  </details>
}

export function FinancialReports({ entries, month }: { entries: Entry[]; month: string }) {
  const [period, setPeriod] = useState(6)
  const [selected, setSelected] = useState<string | null>(null)
  const points = monthlyReport(entries, month, period)
  const max = Math.max(1, ...points.flatMap(point => [point.income, point.expenses]))
  const income = points.reduce((total, point) => total + point.income, 0)
  const expenses = points.reduce((total, point) => total + point.expenses, 0)
  const current = points.find(point => point.month === selected)
  const hasRecords = points.some(point => point.records.length > 0)

  return <Card className="span-8 financial-report">
    <CardHeader title="Receitas e despesas" description={`${monthName(points[0].month)} a ${monthName(month)}`} icon={BarChart3}
      action={<label className="report-period">Período<select value={period} onChange={event => { setPeriod(Number(event.target.value)); setSelected(null) }}>
        <option value={3}>3 meses</option><option value={6}>6 meses</option><option value={12}>12 meses</option>
      </select></label>} />
    <div className="report-totals">
      <div><span>Receitas no período</span><strong className="positive">{currency(income)}</strong></div>
      <div><span>Despesas no período</span><strong className="negative">{currency(expenses)}</strong></div>
      <div><span>Resultado no período</span><strong className={income - expenses < 0 ? 'negative' : 'positive'}>{currency(income - expenses)}</strong></div>
    </div>
    {hasRecords ? <>
      <div className="report-legend"><span><i className="report-income" />Receitas</span><span><i className="report-expense" />Despesas</span><small>Toque em um mês para ver os lançamentos</small></div>
      <div className="report-chart-scroll"><div className="report-chart" style={{ minWidth: period === 12 ? 650 : 340 }}>
        <div className="report-scale" aria-hidden="true"><span>{compact(max)}</span><span>{compact(max / 2)}</span><span>R$ 0</span></div>
        <div className="report-columns">{points.map(point => <button type="button" key={point.month} className="report-month" aria-pressed={selected === point.month}
          aria-label={`${monthName(point.month)}: receitas ${currency(point.income)}, despesas ${currency(point.expenses)}, resultado ${currency(point.result)}. Ver lançamentos.`}
          onClick={() => setSelected(point.month)}>
          <span className="report-bars" aria-hidden="true"><i className="report-income" style={{ height: `${point.income / max * 100}%` }} /><i className="report-expense" style={{ height: `${point.expenses / max * 100}%` }} /></span>
          <span>{monthName(point.month).split(' de ')[0].slice(0, 3)}<small>{point.month.slice(0, 4)}</small></span>
        </button>)}</div>
      </div></div>
      {current && <ReportDetails key={current.month} title={monthName(current.month)} entries={current.records} />}
      <details className="report-details"><summary>Ver valores de todos os meses</summary><div className="report-table-scroll"><table>
        <caption className="sr-only">Receitas, despesas e resultado por mês</caption>
        <thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Resultado</th></tr></thead>
        <tbody>{points.map(point => <tr key={point.month}><td>{monthName(point.month)}</td><td>{currency(point.income)}</td><td>{currency(point.expenses)}</td><td>{currency(point.result)}</td></tr>)}</tbody>
      </table></div></details>
    </> : <EmptyState icon={<BarChart3 size={26} />} title="Seu relatório começa aqui" text="Registre receitas e despesas para comparar os meses. Meses sem lançamentos não representam uma confirmação de saldo zero." />}
    <p className="report-note">Valores registrados por mês, incluindo lançamentos futuros e parcelas no vencimento. Ajustes e pagamentos de fatura não entram neste relatório. Resultado não é saldo disponível.</p>
  </Card>
}
