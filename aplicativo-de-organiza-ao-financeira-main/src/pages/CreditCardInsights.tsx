import { useState } from 'react'
import { BarChart3, Eye, Search, ShoppingBag } from 'lucide-react'
import { compact, currency, displayDate, monthName } from '../data'
import type { CardBill, CardPurchase, CardState } from '../creditCards'
import { cardCommitmentForecast, filterCardPurchases } from '../creditCards'
import { Badge, Button, Card, CardHeader, EmptyState, Modal } from '../ui'

export function CardCommitments({ bills, month, today, selectMonth }: { bills: CardBill[]; month: string; today: string; selectMonth: (month: string) => void }) {
  const [count, setCount] = useState(6)
  const points = cardCommitmentForecast(bills, today.slice(0, 7), count)
  const maximum = Math.max(1, ...points.map(point => point.remainingCents))
  const remaining = points.reduce((sum, point) => sum + point.remainingCents, 0)
  const overdue = bills.filter(bill => bill.month < today.slice(0, 7)).reduce((sum, bill) => sum + bill.remainingCents, 0)
  const later = bills.filter(bill => bill.month > points[points.length - 1].month).reduce((sum, bill) => sum + bill.remainingCents, 0)
  return <Card className="card-commitments">
    <CardHeader title="Seus próximos compromissos" description="Valores ainda em aberto por mês de vencimento." icon={BarChart3}
      action={<label className="credit-forecast-period">Período<select value={count} onChange={event => setCount(Number(event.target.value))}><option value={6}>6 meses</option><option value={12}>12 meses</option></select></label>} />
    <div className="credit-forecast-total"><strong>{currency(remaining)}</strong><span>em aberto nos {count} meses exibidos</span></div>
    <div className="credit-forecast-scroll"><div className="credit-forecast-bars" style={{ minWidth: count === 12 ? 720 : 390 }}>
      {points.map(point => <button type="button" key={point.month} className="credit-forecast-month" aria-pressed={point.month === month}
        aria-label={`${monthName(point.month)}: ${currency(point.remainingCents)} em aberto, ${point.installments} parcela(s). Ver fatura.`} onClick={() => selectMonth(point.month)}>
        <strong title={currency(point.remainingCents)}>{point.remainingCents >= 1000000 ? `R$ ${compact(point.remainingCents)}` : currency(point.remainingCents)}</strong><span className="credit-forecast-track" aria-hidden="true"><i style={{ height: `${point.remainingCents / maximum * 100}%` }} /></span>
        <span>{monthName(point.month).split(' de ')[0]}<small>{point.month.slice(0, 4)}</small></span>
      </button>)}
    </div></div>
    <p className="card-description">Toque em um mês para abrir a fatura. Inclui apenas compras já registradas e desconta pagamentos; novas compras, juros e encargos futuros não estão previstos.</p>
    {(overdue > 0 || later > 0) && <p className="credit-forecast-outside">Fora do gráfico: {overdue > 0 && <span>{currency(overdue)} em meses anteriores. </span>}{later > 0 && <span>{currency(later)} depois do período exibido.</span>}</p>}
  </Card>
}

export function CardPurchaseHistory({ data, cardId, archived, onArchive, selectMonth }: { data: CardState; cardId: string; archived: boolean; onArchive: (purchase: CardPurchase) => void; selectMonth: (month: string) => void }) {
  const [query, setQuery] = useState(''), [category, setCategory] = useState('')
  const [kind, setKind] = useState<'all' | 'single' | 'installments'>('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const all = data.purchases.filter(purchase => purchase.cardId === cardId)
  const categories = [...new Set(all.map(purchase => purchase.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const filtered = filterCardPurchases(data.purchases, cardId, query, category, kind)
  const detail = all.find(purchase => purchase.id === detailId)
  const hasPayments = (purchase: CardPurchase) => data.installments.some(item => item.purchaseId === purchase.id
    && data.payments.some(payment => payment.cardId === cardId && payment.billMonth === item.billMonth))
  if (!all.length) return null
  return <Card>
    <CardHeader title="Compras do cartão" description="Pesquise compras e confira todas as suas parcelas." />
    <div className="credit-purchase-filters">
      <div className="search-field"><Search size={17} aria-hidden="true" /><input aria-label="Buscar compras do cartão" placeholder="Descrição, categoria ou observação..." value={query} onChange={event => setQuery(event.target.value)} /></div>
      <label>Categoria<select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas as categorias</option>{categories.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
      <label>Parcelamento<select value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="all">Todas as compras</option><option value="single">À vista no crédito</option><option value="installments">Parceladas</option></select></label>
    </div>
    <p className="credit-purchase-count" role="status">{filtered.length} de {all.length} compras · {currency(filtered.reduce((sum, purchase) => sum + purchase.amountCents, 0))} em valores totais de compra</p>
    {filtered.length ? <div className="entry-list">{filtered.map(purchase => <div className="entry-row credit-purchase-row" key={purchase.id}>
      <span className="entry-glyph"><ShoppingBag size={18} /></span><div className="entry-main"><strong>{purchase.title}</strong><span className="entry-meta">{displayDate(purchase.date)} · {purchase.category}{purchase.subcategory ? ` / ${purchase.subcategory}` : ''} · {purchase.installments === 1 ? 'À vista no crédito' : `${purchase.installments} parcelas`}</span></div>
      <strong>{currency(purchase.amountCents)}</strong><Button size="sm" variant="ghost" aria-label={`Ver compra ${purchase.title}`} onClick={() => setDetailId(purchase.id)}><Eye size={16} /><span>Detalhes</span></Button>
    </div>)}</div> : <EmptyState icon={<Search size={25} />} title="Nenhuma compra com esses filtros" text="Tente outra descrição, categoria ou tipo de parcelamento." action={<Button variant="secondary" onClick={() => { setQuery(''); setCategory(''); setKind('all') }}>Limpar filtros</Button>} />}
    <p className="card-description">Este total representa as compras encontradas, incluindo valores já pagos; não é o saldo devedor do cartão.</p>
    {detail && <Modal title="Detalhes da compra" onClose={() => setDetailId(null)}>
      <h3>{detail.title}</h3><p className="card-description">{displayDate(detail.date)} · {detail.category}{detail.subcategory ? ` / ${detail.subcategory}` : ''}</p>
      <dl className="credit-purchase-summary"><div><dt>Valor original</dt><dd>{currency(detail.amountCents - (detail.interestCents ?? 0))}</dd></div><div><dt>Juros registrados</dt><dd>{currency(detail.interestCents ?? 0)}</dd></div><div><dt>Total da compra</dt><dd>{currency(detail.amountCents)}</dd></div></dl>
      {detail.note && <p className="credit-purchase-note">{detail.note}</p>}
      <h4>Parcelas por fatura</h4><ul className="credit-purchase-installments">{data.installments.filter(item => item.purchaseId === detail.id).sort((a, b) => a.number - b.number).map(item => {
        const paid = data.payments.filter(payment => payment.cardId === cardId && payment.billMonth === item.billMonth).reduce((sum, payment) => sum + payment.amountCents, 0)
        const total = data.installments.filter(other => other.cardId === cardId && other.billMonth === item.billMonth).reduce((sum, other) => sum + other.amountCents, 0)
        const status = paid >= total ? 'Fatura paga' : paid > 0 ? 'Fatura parcialmente paga' : 'Fatura em aberto'
        return <li key={item.id}><div><strong>Parcela {item.number}/{detail.installments} · {currency(item.amountCents)}</strong><small>Vence em {displayDate(item.dueDate)}</small><Badge tone={paid >= total ? 'success' : 'warning'}>{status}</Badge></div><Button size="sm" variant="ghost" onClick={() => { selectMonth(item.billMonth); setDetailId(null) }}>Ver fatura</Button></li>
      })}</ul>
      {!archived && <div className="credit-purchase-correction"><h4>Corrigir um registro</h4><p className="card-description">Compras sem pagamentos nas faturas podem ser arquivadas e cadastradas novamente com os dados corretos. O registro original fica preservado no histórico do servidor.</p>
        {hasPayments(detail) ? <p className="card-description">Esta compra está em uma fatura com pagamento registrado. O arquivamento está bloqueado para preservar os saldos e pagamentos.</p> : <Button variant="outline" onClick={() => { setDetailId(null); onArchive(detail) }}>Arquivar registro incorreto</Button>}
      </div>}
    </Modal>}
  </Card>
}
