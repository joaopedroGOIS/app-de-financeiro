import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { api, json } from './data'
import type { UserCategory, UserSubcategory } from './data'
import { Button } from './ui'

const typeLabels: Record<UserCategory['type'], string> = {
  expense: 'Despesas',
  income: 'Receitas',
  adjustment: 'Ajustes',
}

function CategoryRow({ category, subcategories, onUpdated }: {
  category: UserCategory
  subcategories: UserSubcategory[]
  onUpdated: () => Promise<void>
}) {
  const [name, setName] = useState(category.name)
  const [subcategoryName, setSubcategoryName] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  useEffect(() => setName(category.name), [category.name])

  const run = async (action: () => Promise<unknown>) => {
    setError('')
    setPending(true)
    try {
      await action()
      await onUpdated()
      return true
    } catch (err) {
      setError((err as Error).message || 'Não foi possível atualizar a categoria.')
      return false
    } finally {
      setPending(false)
    }
  }
  const saveCategory = () => run(() => api(`/categories/${category.id}`, json('PATCH', { name, archived: false })))
  const archiveCategory = () => run(() => api(`/categories/${category.id}`, { method: 'DELETE' }))
  const restoreCategory = () => run(() => api(`/categories/${category.id}`, json('PATCH', { name, archived: false })))
  const addSubcategory = async (event: FormEvent) => {
    event.preventDefault()
    if (!subcategoryName.trim()) return
    if (await run(() => api('/subcategories', json('POST', { categoryId: category.id, name: subcategoryName.trim() })))) setSubcategoryName('')
  }

  return (
    <article className={`category-manager-item ${category.archivedAt ? 'is-archived' : ''}`}>
      <div className="category-manager-row">
        <label className="category-manager-name">Categoria
          <input maxLength={40} required value={name} disabled={!!category.archivedAt || pending} onChange={event => setName(event.target.value)} />
        </label>
        {!category.archivedAt && name.trim() !== category.name && (
          <Button size="sm" disabled={pending || !name.trim()} onClick={saveCategory}><Save size={14} />Salvar</Button>
        )}
        {category.archivedAt
          ? <Button variant="secondary" size="sm" disabled={pending} onClick={restoreCategory}><RotateCcw size={14} />Restaurar</Button>
          : <Button variant="ghost" size="sm" disabled={pending} onClick={archiveCategory}><Trash2 size={14} />Arquivar</Button>}
      </div>
      {category.archivedAt ? <p className="category-manager-hint">Arquivada. O histórico das movimentações foi preservado.</p> : (
        <>
          <div className="category-manager-subcategories">
            <strong>Subcategorias</strong>
            {subcategories.length ? subcategories.map(item => (
              <SubcategoryRow key={item.id} item={item} onUpdated={onUpdated} />
            )) : <span className="category-manager-hint">Nenhuma subcategoria cadastrada.</span>}
          </div>
          <form className="category-manager-add-subcategory" onSubmit={addSubcategory}>
            <input maxLength={40} aria-label={`Nova subcategoria de ${category.name}`} placeholder="Adicionar subcategoria" value={subcategoryName} onChange={event => setSubcategoryName(event.target.value)} />
            <Button type="submit" variant="secondary" size="sm" disabled={pending || !subcategoryName.trim()}><Plus size={14} />Adicionar</Button>
          </form>
        </>
      )}
      {error && <p className="category-manager-error" role="alert">{error}</p>}
    </article>
  )
}

function SubcategoryRow({ item, onUpdated }: { item: UserSubcategory; onUpdated: () => Promise<void> }) {
  const [name, setName] = useState(item.name)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  useEffect(() => setName(item.name), [item.name])
  const run = async (action: () => Promise<unknown>) => {
    setError('')
    setPending(true)
    try { await action(); await onUpdated(); return true }
    catch (err) { setError((err as Error).message || 'Não foi possível atualizar a subcategoria.'); return false }
    finally { setPending(false) }
  }
  return (
    <div className={`category-manager-subcategory ${item.archivedAt ? 'is-archived' : ''}`}>
      <input maxLength={40} aria-label="Nome da subcategoria" value={name} disabled={!!item.archivedAt || pending} onChange={event => setName(event.target.value)} />
      {!item.archivedAt && name.trim() !== item.name && <Button size="sm" variant="ghost" disabled={pending || !name.trim()} onClick={() => run(() => api(`/subcategories/${item.id}`, json('PATCH', { name, archived: false })))}><Save size={14} />Salvar</Button>}
      {item.archivedAt
        ? <Button size="sm" variant="ghost" aria-label={`Restaurar ${item.name}`} title="Restaurar subcategoria" disabled={pending} onClick={() => run(() => api(`/subcategories/${item.id}`, json('PATCH', { name, archived: false })))}><RotateCcw size={14} /></Button>
        : <Button size="sm" variant="ghost" aria-label={`Arquivar ${item.name}`} title="Arquivar subcategoria" disabled={pending} onClick={() => run(() => api(`/subcategories/${item.id}`, { method: 'DELETE' }))}><Trash2 size={14} /></Button>}
      {error && <span className="category-manager-error" role="alert">{error}</span>}
    </div>
  )
}

export function CategoryManager({ categories, subcategories, onUpdated }: {
  categories: UserCategory[]
  subcategories: UserSubcategory[]
  onUpdated: () => Promise<void>
}) {
  const [type, setType] = useState<UserCategory['type']>('expense')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const createCategory = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      await api('/categories', json('POST', { name: name.trim(), type }))
      setName('')
      await onUpdated()
    } catch (err) {
      setError((err as Error).message || 'Não foi possível criar a categoria.')
    } finally {
      setPending(false)
    }
  }
  const grouped = (['expense', 'income', 'adjustment'] as const).map(categoryType => ({
    type: categoryType,
    rows: categories.filter(category => category.type === categoryType),
  }))

  return (
    <section className="category-manager" aria-labelledby="category-manager-title">
      <div className="category-manager-heading">
        <h3 id="category-manager-title">Minhas categorias</h3>
        <p>Personalize categorias e subcategorias. Renomear ou arquivar não altera movimentações antigas.</p>
      </div>
      <form className="category-manager-create" onSubmit={createCategory}>
        <label>Tipo
          <select value={type} onChange={event => setType(event.target.value as UserCategory['type'])}>
            {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Nome da categoria
          <input required maxLength={40} placeholder="Ex.: Pet, Cursos, Bônus" value={name} onChange={event => setName(event.target.value)} />
        </label>
        <Button type="submit" disabled={pending || !name.trim()}><Plus size={16} />Adicionar</Button>
      </form>
      {error && <p className="category-manager-error" role="alert">{error}</p>}
      {grouped.map(group => (
        <div className="category-manager-group" key={group.type}>
          <h4>{typeLabels[group.type]}</h4>
          {group.rows.length ? group.rows.map(category => (
            <CategoryRow
              key={category.id}
              category={category}
              subcategories={subcategories.filter(item => item.categoryId === category.id)}
              onUpdated={onUpdated}
            />
          )) : <p className="category-manager-hint">Nenhuma categoria neste grupo.</p>}
        </div>
      ))}
      <p className="category-manager-hint"><Check size={14} />Cada usuário vê e altera apenas o próprio catálogo.</p>
    </section>
  )
}
