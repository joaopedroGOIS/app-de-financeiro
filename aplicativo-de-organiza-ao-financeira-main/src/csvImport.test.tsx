import test from 'node:test'
import assert from 'node:assert/strict'
import {csvCents,csvDate,parseCSV,guessColumn} from './csvImport'
test('CSV brasileiro com BOM, aspas, ponto e vírgula e linhas internas',()=>assert.deepEqual(parseCSV('\uFEFFData;Descrição;Valor\r\n10/10/2026;"Mercado; \"\"Centro\"\"\nLoja";"1.234,56"'),[['Data','Descrição','Valor'],['10/10/2026','Mercado; "Centro"\nLoja','1.234,56']]))
test('CSV com vírgulas e tabulações',()=>{assert.equal(parseCSV('date,title,amount\n2026-10-10,Mercado,12.50')[1][2],'12.50');assert.equal(parseCSV('date\ttitle\tamount\n2026-10-10\tMercado\t12.50')[1][1],'Mercado')})
test('CSV malformado é rejeitado',()=>{for(const s of ['a;b\n"x;y','a;b\nx;y;z','a;b\n"x"z;y','a;b'])assert.throws(()=>parseCSV(s))})
test('centavos exatos e sinais',()=>{for(const [s,n] of [['R$ 1.234,56',123456],['12.50',1250],['-0,01',-1],['(42.10)',-4210],['10',1000]] as const)assert.equal(csvCents(s),n);for(const s of ['1.234','1e3','0','1,2,3','NaN','1000000001'])assert.throws(()=>csvCents(s))})
test('datas válidas e inválidas incluindo ano bissexto',()=>{assert.equal(csvDate('29/02/2024'),'2024-02-29');assert.equal(csvDate('2026-10-10'),'2026-10-10');for(const s of ['29/02/2025','31/04/2026','10/16/2026'])assert.throws(()=>csvDate(s))})
test('cabeçalhos em português e inglês',()=>{assert.equal(guessColumn(['Data','Descrição','Valor (R$)'],'title'),1);assert.equal(guessColumn(['date','title','amount'],'amount'),2)})
