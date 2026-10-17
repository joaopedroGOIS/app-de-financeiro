export const normalizeHeader = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

/** RFC-style quoted cells, including newlines and escaped quotes. No spreadsheet execution. */
export function parseCSV(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '')
  const first = text.split(/\r?\n/)[0]
  const counts: Record<string,number>={';':0,',':0,'\t':0};let inQuote=false
  for(let i=0;i<first.length;i++){if(first[i]==='"'){if(inQuote&&first[i+1]==='"')i++;else inQuote=!inQuote}else if(!inQuote&&first[i] in counts)counts[first[i]]++}
  const delimiter = Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0]
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false
  for (let i=0; i<text.length; i++) {
    const c=text[i]
    if (quoted) { if(c==='"') { if(text[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true} } else cell+=c; continue }
    if(c==='"' && !cell && !closed){quoted=true;continue}
    if(c===delimiter){row.push(cell);cell='';closed=false;continue}
    if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';closed=false;continue}
    if(closed && c.trim())throw new Error('CSV inválido: confira as aspas e o separador.')
    cell+=c
  }
  if(quoted)throw new Error('CSV inválido: há aspas sem fechamento.')
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row)
  if(rows.length<2)throw new Error('O arquivo precisa de cabeçalho e pelo menos um lançamento.')
  if(rows.length>501)throw new Error('Importe até 500 linhas por arquivo.')
  if(rows.some(r=>r.length!==rows[0].length))throw new Error('As linhas possuem quantidades diferentes de colunas.')
  return rows
}

export function csvCents(raw: string): number {
  let s=raw.trim().replace(/^R\$\s*/, '').replace(/\s/g,'')
  if(/^\(.*\)$/.test(s))s='-'+s.slice(1,-1)
  if(s.includes(',')) { if(!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(s))throw new Error('Valor inválido');s=s.replace(/\./g,'').replace(',','.') }
  if(!/^-?\d+(?:\.\d{1,2})?$/.test(s))throw new Error('Valor inválido; use centavos com duas casas.')
  const negative=s.startsWith('-');s=s.replace(/^-/,'');const [a,b='']=s.split('.')
  const cents=BigInt(a)*100n+BigInt(b.padEnd(2,'0'))
  if(cents===0n||cents>100000000000n)throw new Error('Valor fora do limite permitido.')
  return Number(cents)*(negative?-1:1)
}

export function csvDate(raw: string): string {
  const s=raw.trim(), br=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s)
  const iso=br?`${br[3]}-${br[2]}-${br[1]}`:s
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||!Number.isFinite(Date.parse(iso+'T12:00:00Z'))||new Date(iso+'T12:00:00Z').toISOString().slice(0,10)!==iso)throw new Error('Data inválida; use DD/MM/AAAA ou AAAA-MM-DD.')
  return iso
}

export type ImportRow = { line: number; title: string; date: string; amountCents: number; type: 'expense'|'income'; category: string; note: string }
export const columnAliases = {date:['data','date','data da compra'],title:['descricao','description','title','historico','estabelecimento'],amount:['valor','valor (r$)','amount'],type:['tipo','type'],category:['categoria','category'],status:['situacao','status']}
export function guessColumn(headers: string[], field: keyof typeof columnAliases) { return headers.findIndex(h=>columnAliases[field].includes(normalizeHeader(h))) }
