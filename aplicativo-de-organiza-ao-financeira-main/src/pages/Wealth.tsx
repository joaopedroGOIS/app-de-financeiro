import { ArrowRight, CircleHelp, Gem, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { currency } from '../data'
import { Button, EmptyState } from '../ui'
import type { PageProps } from './shared'

export function WealthPage({ state, go, open, editAsset, requestRemove }: PageProps) {
  const openAsset = () => { editAsset(null); open('asset') }

  return (
    <>
      <div className="wealth-grid">
        <article className="wealth-card reserve">
          <span className="wealth-card-icon"><ShieldCheck size={24} /></span>
          <small>RESERVA FINANCEIRA</small>
          <strong>{currency(state.stats.reserveCents)}</strong>
          <p>Soma dos saldos positivos das contas que você marcou explicitamente como reserva. Não é dinheiro disponível para Sonhos.</p>
          <button type="button" className="text-action" onClick={() => go('accounts')}>Gerenciar contas <ArrowRight size={15} /></button>
        </article>
        <article className="wealth-card property">
          <span className="wealth-card-icon"><Gem size={24} /></span>
          <small>PATRIMÔNIO LÍQUIDO REGISTRADO</small>
          <strong>{currency(state.stats.netWorthCents)}</strong>
          <p>Saldos de contas + bens cadastrados − dívidas cadastradas e saldo devedor dos cartões. Bens físicos não viram dinheiro disponível automaticamente.</p>
          <button type="button" className="text-action" onClick={() => { const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'; document.getElementById('wealth-items')?.scrollIntoView({ behavior }) }}>Ver bens e dívidas <ArrowRight size={15} /></button>
        </article>
      </div>

      <div className="info-note">
        <CircleHelp size={19} />
        <p><strong>Classe Financeira:</strong> aguardando critérios oficiais de classificação. Nenhuma classe arbitrária é atribuída ao seu saldo ou à sua reserva.</p>
      </div>

      <div className="section-heading" id="wealth-items">
        <div>
          <h2>Bens e dívidas</h2>
          <p>Registre itens fora das contas para acompanhar seu patrimônio.</p>
        </div>
        <Button onClick={openAsset}><Plus size={17} />Adicionar item</Button>
      </div>

      {state.assets.length ? (
        <div className="asset-list">
          {state.assets.map(asset => (
            <div className="asset-row" key={asset.id}>
              <span className={`asset-icon ${asset.kind === 'liability' ? 'liability' : ''}`}><Gem size={19} /></span>
              <div className="asset-row-body">
                <strong>{asset.name}</strong>
                <small>{asset.kind === 'asset' ? 'Bem / ativo' : 'Dívida / passivo'}{asset.note && ` · ${asset.note}`}</small>
              </div>
              <strong className={asset.kind === 'liability' ? 'negative' : ''}>{asset.kind === 'liability' ? '−' : ''}{currency(asset.amountCents)}</strong>
              <button type="button" className="icon-button" onClick={() => { editAsset(asset); open('asset') }} aria-label={`Editar ${asset.name}`} title="Editar"><Pencil size={16} /></button>
              <button type="button" className="icon-button danger" onClick={() => requestRemove({ path: `/assets/${asset.id}`, title: 'Excluir item', description: `Excluir “${asset.name}” do seu patrimônio?` })} aria-label={`Excluir ${asset.name}`} title="Excluir"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Gem size={30} />} title="Seu panorama começa aqui" text="Adicione seus bens e dívidas para ver um retrato mais completo do patrimônio." action={<Button variant="secondary" onClick={openAsset}><Plus size={17} />Adicionar item</Button>} />
      )}
    </>
  )
}
