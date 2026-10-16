import { useMemo, useState } from 'react'
import { Upload } from 'lucide-react'
import { api, currency, dateToday, json } from './data'
import type { State } from './data'
import { csvCents, csvDate, guessColumn, normalizeHeader, parseCSV } from './csvImport'
import type { ImportRow } from './csvImport'
import { Button, InlineError, Modal } from './ui'

type Result = {rows:{line:number;status:'ready'|'duplicate'|'imported'}[]}
export function CsvImport({state,onUpdated,initialCardId}: {state:State;onUpdated:()=>Promise<unknown>;initialCardId?:string}) {
  const [opened,setOpened]=useState(false), [table,setTable]=useState<string[][]>([]), [name,setName]=useState('')
  const [columns,setColumns]=useState<Record<string,number>>({}), [target,setTarget]=useState(initialCardId?`card:${initialCardId}`:`account:${state.accounts[0]?.id??''}`)
  const [defaultType,setDefaultType]=useState<'expense'|'income'>('expense'), [fallback,setFallback]=useState('Outros'), [positiveExpense,setPositiveExpense]=useState(true)
  const [month,setMonth]=useState(dateToday().slice(0,7)), [confirmed,setConfirmed]=useState(false)
  const [pasted,setPasted]=useState('')
  const [error,setError]=useState(''), [busy,setBusy]=useState(false), [result,setResult]=useState<Result|null>(null), [done,setDone]=useState(false)
  const [excluded,setExcluded]=useState<number[]>([]), [overrides,setOverrides]=useState<Record<number,string>>({})
  const card=target.startsWith('card:'), active=(state.categories??[]).filter(c=>!c.archivedAt)
  const invalidate=()=>{setResult(null);setDone(false);setConfirmed(false)}
  const preview=useMemo(()=>table.slice(1).map((cells,index)=>{
    const line=index+2, get=(field:string)=>cells[columns[field]]?.trim()??''
    try {
      if(columns.date<0||columns.title<0||columns.amount<0)throw new Error('Selecione as colunas obrigatórias.')
      const title=get('title'), typeText=normalizeHeader(get('type')), status=normalizeHeader(get('status'))
      if(status==='arquivada'||status==='arquivado')throw new Error('Registro arquivado; não será restaurado pela importação.')
      if(typeText && !['gasto','despesa','expense','receita','income'].includes(typeText))throw new Error('Tipo não importável: pagamentos, ajustes e transferências exigem registro próprio.')
      if(!title||title.length>80)throw new Error('Descrição deve ter de 1 a 80 caracteres.')
      if(card && /\b(?:parcela|parcelado|estorno|pagamento|credito de|crédito de)\b|\b\d{1,2}\s*\/\s*\d{1,2}\b/i.test(title))throw new Error('Possível parcela, estorno ou pagamento: confira manualmente em Cartões.')
      const signed=csvCents(get('amount'))
      const type:ImportRow['type']=typeText?(['receita','income'].includes(typeText)?'income':'expense'):card?'expense':positiveExpense?defaultType:signed<0?'expense':'income'
      if(card && (signed<0||type==='income'))throw new Error('Valor negativo ou crédito: estornos e pagamentos não são importados como compras.')
      const date=csvDate(get('date'));if(date>dateToday())throw new Error('Data futura não permitida.')
      const rawCategory=get('category'), category=overrides[line]??active.find(c=>c.type===type&&normalizeHeader(c.name)===normalizeHeader(rawCategory))?.name??fallback
      if(!active.some(c=>c.type===type&&c.name===category))throw new Error('Selecione uma categoria ativa compatível com o tipo.')
      return {line,row:{line,title,date,type,amountCents:Math.abs(signed),category,note:`Importado de CSV: ${name}`.slice(0,300)} as ImportRow,error:''}
    }catch(e){return {line,row:null,error:(e as Error).message}}
  }),[table,columns,card,positiveExpense,defaultType,active.map(c=>c.id).join(),fallback,overrides,name])
  const selected=preview.filter(p=>p.row&&!excluded.includes(p.line)).map(p=>p.row!)
  const ready=result?.rows.filter(r=>r.status==='ready').length??0
  const check=async(commit:boolean)=>{
    setBusy(true);setError('')
    try {
      const [destination,destinationId]=target.split(':')
      const response=await api<Result>('/imports/csv',json('POST',{destination,destinationId,rows:selected,commit,firstMonth:card?month:null}))
      setResult(response);if(commit){setDone(true);await onUpdated()}
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  const applyText=(text:string,filename:string)=>{
    const parsed=parseCSV(text);setTable(parsed);setName(filename);setExcluded([]);setOverrides({});invalidate()
    setColumns(Object.fromEntries((['date','title','amount','type','category','status'] as const).map(key=>[key,guessColumn(parsed[0],key)])))
  }
  const load=async(file?:File)=>{
    invalidate();setError('');setTable([]);setExcluded([]);setOverrides({})
    if(!file)return
    try {
      if(!/\.csv$/i.test(file.name)||file.size>2*1024*1024)throw new Error('Selecione um CSV de até 2 MB.')
      const buffer=await file.arrayBuffer();let text=new TextDecoder('utf-8').decode(buffer)
      if(text.includes('\uFFFD'))text=new TextDecoder('windows-1252').decode(buffer)
      applyText(text,file.name)
    }catch(e){setError((e as Error).message)}
  }
  return <>
    <Button variant="outline" onClick={()=>{setOpened(true);if(done){setDone(false);setTable([]);setResult(null);setError('');setPasted('')}if(initialCardId)setTarget(`card:${initialCardId}`)}}><Upload size={17}/>Importar CSV</Button>
    {opened&&<Modal wide title="Importar lançamentos de CSV" onClose={()=>{if(!busy)setOpened(false)}}>
      <div className="form csv-import">
        <p className="form-description">Escolha um arquivo, confira os dados e confirme a importação. O arquivo é lido neste navegador; somente os lançamentos selecionados são enviados ao Granaê.</p>
        <fieldset disabled={busy||done} className="csv-import-fields">
          <label>Arquivo CSV<input type="file" accept=".csv,text/csv" onChange={e=>void load(e.target.files?.[0])}/></label>
          <details><summary>Colar conteúdo CSV ou baixar modelo</summary><label>Conteúdo CSV<textarea rows={5} value={pasted} onChange={e=>setPasted(e.target.value)} placeholder="Data;Descrição;Valor;Tipo;Categoria"/></label><Button variant="secondary" onClick={()=>{setError('');try{if(pasted.length>2*1024*1024)throw new Error('Conteúdo muito grande.');applyText(pasted,'conteúdo colado')}catch(e){setTable([]);setError((e as Error).message)}}}>Preparar conteúdo colado</Button><a download="granae-modelo.csv" href={'data:text/csv;charset=utf-8,'+encodeURIComponent('\uFEFFData;Descrição;Valor;Tipo;Categoria\r\n'+dateToday()+';Compra de exemplo;25,90;Gasto;Outros\r\n')}>Baixar CSV de exemplo</a></details>
          <label>Destino dos lançamentos<select value={target} onChange={e=>{setTarget(e.target.value);invalidate()}}><option value="">Selecione</option>{state.accounts.map(a=><option key={a.id} value={`account:${a.id}`}>Conta · {a.name}</option>)}{state.creditCards?.cards.filter(c=>!c.archivedAt).map(c=><option key={c.id} value={`card:${c.id}`}>Cartão · {c.name}</option>)}</select></label>
          {card?<><p className="form-description">Cada linha será uma compra à vista no crédito, pelo valor total informado. Use apenas compras completas, sem parcelas, pagamentos, totais de fatura ou estornos. Juros já incluídos no CSV não serão somados novamente.</p><label>Fatura das compras importadas<input type="month" required value={month} onChange={e=>{setMonth(e.target.value);invalidate()}}/></label></>:<><label>Como interpretar os valores<select value={positiveExpense?'fixed':'signed'} onChange={e=>{setPositiveExpense(e.target.value==='fixed');invalidate()}}><option value="fixed">Usar tipo do CSV ou tipo padrão</option><option value="signed">Sem tipo no CSV: negativo é gasto, positivo é receita</option></select></label><label>Tipo padrão<select value={defaultType} onChange={e=>{setDefaultType(e.target.value as 'expense'|'income');invalidate()}}><option value="expense">Gasto</option><option value="income">Receita</option></select></label></>}
          {table.length>0&&<>
            <div className="form-row">{([['date','Coluna da data'],['title','Coluna da descrição'],['amount','Coluna do valor'],['type','Coluna do tipo (opcional)'],['category','Coluna da categoria (opcional)'],['status','Coluna da situação (opcional)']] as const).map(([key,label])=><label key={key}>{label}<select value={columns[key]??-1} onChange={e=>{setColumns({...columns,[key]:Number(e.target.value)});invalidate()}}><option value={-1}>Não selecionada</option>{table[0].map((h,i)=><option key={i} value={i}>{h||`Coluna ${i+1}`}</option>)}</select></label>)}</div>
            <label>Categoria quando não encontrada no CSV<select value={fallback} onChange={e=>{setFallback(e.target.value);invalidate()}}>{[...new Set(active.map(c=>c.name))].map(c=><option key={c}>{c}</option>)}</select></label>
            <p className="form-description">{preview.length} linhas · {selected.length} selecionadas. Desmarque o que não deseja importar. Datas: DD/MM/AAAA ou AAAA-MM-DD; valores: 1.234,56 ou 1234.56.</p>
            <div className="csv-preview" tabIndex={0} role="region" aria-label="Prévia dos lançamentos"><table><thead><tr><th>Importar</th><th>Data / descrição</th><th>Valor / tipo</th><th>Categoria / conferência</th></tr></thead><tbody>{preview.map(p=><tr key={p.line}><td><input type="checkbox" aria-label={`Importar linha ${p.line}`} disabled={!p.row} checked={!!p.row&&!excluded.includes(p.line)} onChange={e=>{setExcluded(e.target.checked?excluded.filter(n=>n!==p.line):[...excluded,p.line]);invalidate()}}/></td><td>{p.row?<>{p.row.date}<br/>{p.row.title}</>:`Linha ${p.line}`}</td><td>{p.row&&<>{currency(p.row.amountCents)}<br/>{p.row.type==='expense'?'Gasto':'Receita'}</>}</td><td>{p.row?<><select aria-label={`Categoria da linha ${p.line}`} value={p.row.category} onChange={e=>{setOverrides({...overrides,[p.line]:e.target.value});invalidate()}}>{active.filter(c=>c.type===p.row!.type).map(c=><option key={c.id}>{c.name}</option>)}</select><small>{result?.rows.find(r=>r.line===p.line)?.status==='duplicate'?'Duplicado — será ignorado':result?.rows.find(r=>r.line===p.line)?.status==='imported'?'Importado':''}</small></>:<span className="negative">{p.error}</span>}</td></tr>)}</tbody></table></div>
          </>}
        </fieldset>
        {error&&<InlineError>{error}</InlineError>}
        {result&&!done&&<p role="status">{ready} {ready===1?'novo lançamento':'novos lançamentos'} · {result.rows.length-ready} duplicados ignorados. A conferência compara destino, data, tipo, valor e descrição, inclusive com registros arquivados.</p>}
        {result&&!done&&ready>0&&<label className="check-field"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Conferi os lançamentos e o destino. {card?'São compras completas à vista no crédito.':'Não incluí compras já registradas no cartão, transferências ou pagamentos de fatura.'}</span></label>}
        {done?<p role="status">Importação concluída: {result?.rows.filter(r=>r.status==='imported').length} lançamentos salvos e {result?.rows.filter(r=>r.status==='duplicate').length} duplicados ignorados.</p>:<><Button disabled={busy||!selected.length||!target.split(':')[1]} variant="secondary" onClick={()=>void check(false)}>{busy?'Conferindo...':'Conferir duplicados no servidor'}</Button>{result&&ready>0&&<Button disabled={busy||!confirmed} onClick={()=>void check(true)}>{busy?'Importando...':`Confirmar importação de ${ready} ${ready===1?'lançamento':'lançamentos'}`}</Button>}</>}
        <p className="form-description">CSV não conecta sua conta ao banco nem sincroniza automaticamente. Se duas compras legítimas tiverem a mesma data, valor e descrição, registre a segunda manualmente após conferir.</p>
      </div>
    </Modal>}
  </>
}
