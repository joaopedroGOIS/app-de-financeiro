import { CircleHelp, Landmark, Pencil, Plus, ShieldCheck, Trash2, Wallet } from 'lucide-react'
import { currency } from '../data'
import { Button, EmptyState } from '../ui'
import type { PageProps } from './shared'

export function AccountsPage({ state, go, open, editAccount, requestRemove }: PageProps) {
  const balance = state.accounts.reduce((sum, account) => sum + account.balanceCents, 0)
  const openAccount = () => { editAccount(null); open('account') }

  return (
    <>
      <div className="page-feature">
        <span className="feature-icon"><Landmark size={26} /></span>
        <div className="page-feature-text">
          <span className="feature-overline">SALDO TOTAL DAS CONTAS</span>
          <strong>{currency(balance)}</strong>
          <p>Soma dos saldos das suas contas, incluindo aquelas marcadas como reserva.</p>
        </div>
      </div>

      <div className="section-heading">
        <div>
          <h2>Suas contas</h2>
          <p>Os saldos incluem o valor inicial, as movimentações e os pagamentos de fatura.</p>
        </div>
        <span className="count-pill">{state.accounts.length} {state.accounts.length === 1 ? 'conta' : 'contas'}</span>
      </div>

      {state.accounts.length ? (
        <div className="tile-grid">
          {state.accounts.map(account => (
            <article className="tile" key={account.id}>
              <div className="tile-top">
                <span className={`tile-icon ${account.isReserve ? 'success' : ''}`}><Landmark size={21} /></span>
                <div className="tile-actions">
                  <button type="button" className="icon-button" onClick={() => { editAccount(account); open('account') }} aria-label={`Editar ${account.name}`} title="Editar"><Pencil size={16} /></button>
                  <button type="button" className="icon-button danger" onClick={() => requestRemove({ path: `/accounts/${account.id}`, title: 'Excluir conta', description: `Excluir a conta “${account.name}”? Contas com movimentações não podem ser excluídas, para preservar seu histórico.` })} aria-label={`Excluir ${account.name}`} title="Excluir"><Trash2 size={16} /></button>
                </div>
              </div>
              <span className="tile-type">{account.type}</span>
              <h3>{account.name}</h3>
              <strong className={`tile-balance ${account.balanceCents < 0 ? 'negative' : ''}`}>{currency(account.balanceCents)}</strong>
              {account.description && <p className="tile-description">{account.description}</p>}
              <div className="tile-footer">
                {account.isReserve ? <span className="reserve-tag"><ShieldCheck size={13} />Participa da reserva</span> : <span>Conta financeira</span>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Wallet size={30} />} title="Vamos criar sua primeira conta?" text="Cadastre uma conta para começar a registrar entradas e gastos." action={<Button onClick={openAccount}><Plus size={17} />Adicionar conta</Button>} />
      )}

      <div className="info-note">
        <CircleHelp size={19} />
        <p><strong>Como funciona o saldo?</strong> O valor inicial é definido ao criar a conta. Depois, receitas, gastos, ajustes e pagamentos de fatura alteram o saldo calculado. Para corrigir um saldo existente, registre um ajuste — assim o histórico é preservado.</p>
      </div>

      {!state.accounts.length && (
        <div className="info-note">
          <CircleHelp size={19} />
          <p>Precisa de ajuda? Comece pela conta que você usa no dia a dia e marque como reserva apenas o que realmente está guardado. Você pode <button type="button" className="text-action" onClick={() => go('wealth')}>ver reserva e patrimônio</button> a qualquer momento.</p>
        </div>
      )}
    </>
  )
}
