import {test} from 'node:test'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import {parseRecoveryRedirect,passwordProblem,recoveryRequest,recoveryUpdate,RECOVERY_REDIRECT_URL,recoveryRedirectUrl} from './recovery'
import {PasswordAccess} from './PasswordAccess'
import {firstStepStatus} from './FirstSteps'
import type {Account,Entry} from './data'
import {fetchAllPages,initializeRecovery,leaveRecovery,PAGE_SIZE,userIdFromToken} from './data'

test('recuperação reconhece somente links apropriados e trata erro, ausência de token e recarga',()=>{
 assert.deepEqual(parseRecoveryRedirect('#/movimentacoes'),{kind:'none'})
 assert.deepEqual(parseRecoveryRedirect('#access_token=normal&type=signup'),{kind:'none'})
 assert.deepEqual(parseRecoveryRedirect('#access_token=test-only-token&type=recovery'),{kind:'update',accessToken:'test-only-token'})
 for(const hash of ['#/recuperar-senha','#type=recovery','#error=access_denied&error_code=otp_expired'])assert.deepEqual(parseRecoveryRedirect(hash),{kind:'invalid'})
 assert.deepEqual(parseRecoveryRedirect('#type=recovery&access_token='+('a'.repeat(16385))),{kind:'invalid'})
})
test('nova senha exige tamanho consistente e confirmação',()=>{
 assert.match(passwordProblem('1234567','1234567'),/8 a 128/)
 assert.match(passwordProblem('a'.repeat(129),'a'.repeat(129)),/8 a 128/)
 assert.match(passwordProblem('senha-teste','outra-senha'),/não coincidem/)
 assert.equal(passwordProblem('senha-somente-teste','senha-somente-teste'),'')
})
test('pedido de link usa destino oficial, não envia sessão e trata limites sem enumerar contas',async()=>{
 const calls:{url:string;options?:RequestInit}[]=[]
 const fake=(async(url:RequestInfo|URL,options?:RequestInit)=>{calls.push({url:String(url),options});return new Response('{}',{status:200})}) as typeof fetch
 await recoveryRequest({url:'https://project.example',key:'public-test'},' user@example.test ',fake)
 assert.equal(new URL(calls[0].url).searchParams.get('redirect_to'),RECOVERY_REDIRECT_URL)
 assert.equal(calls[0].options?.method,'POST')
 assert.equal((calls[0].options?.headers as Record<string,string>).Authorization,undefined)
 assert.equal(JSON.parse(String(calls[0].options?.body)).email,'user@example.test')
 await assert.rejects(recoveryRequest({url:'https://project.example',key:'public-test'},'a@example.test',(async()=>new Response('{}',{status:429})) as typeof fetch),/Aguarde/)
})
test('link de recuperação volta para o mesmo site em que foi pedido',async()=>{
 assert.equal(recoveryRedirectUrl('https://app-de-financeiro.vercel.app'),'https://app-de-financeiro.vercel.app/')
 assert.equal(recoveryRedirectUrl('http://localhost:5173'),'http://localhost:5173/')
 assert.equal(recoveryRedirectUrl(''),RECOVERY_REDIRECT_URL)
 assert.equal(recoveryRedirectUrl('null'),RECOVERY_REDIRECT_URL)
 const calls:string[]=[]
 await recoveryRequest({url:'https://project.example',key:'public-test'},'a@example.test',(async(url:RequestInfo|URL)=>{calls.push(String(url));return new Response('{}',{status:200})}) as typeof fetch,'https://preview.example/')
 assert.equal(new URL(calls[0]).searchParams.get('redirect_to'),'https://preview.example/')
})
test('id do usuário vem do token sem consulta extra e cai para o servidor se o token for ilegível',()=>{
 const encode=(value:object)=>btoa(JSON.stringify(value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
 assert.equal(userIdFromToken(`h.${encode({sub:'5f1c2d3e-0000-4000-8000-00000000abcd',role:'authenticated'})}.s`),'5f1c2d3e-0000-4000-8000-00000000abcd')
 for(const token of [null,'','sem-pontos','a.%%%.c',`h.${encode({sub:''})}.s`,`h.${encode({sub:42})}.s`])assert.equal(userIdFromToken(token),null)
})
test('listas longas são lidas página por página, sem truncar em 1.000 linhas',async()=>{
 const source=Array.from({length:2503},(_,i)=>i)
 const requested:number[]=[]
 const all=await fetchAllPages(async(offset,limit)=>{requested.push(offset);return source.slice(offset,offset+limit)})
 assert.equal(all.length,2503)
 assert.deepEqual(requested,[0,1000,2000])
 const exact=await fetchAllPages(async(offset,limit)=>source.slice(0,2000).slice(offset,offset+limit))
 assert.equal(exact.length,2000)
 assert.equal(PAGE_SIZE,1000)
})
test('troca usa apenas o token de recuperação e encerra essa sessão, sem credencial administrativa',async()=>{
 const calls:{url:string;options?:RequestInit}[]=[]
 await recoveryUpdate({url:'https://project.example',key:'public-test'},'test-only-recovery','senha-somente-teste',(async(url:RequestInfo|URL,options?:RequestInit)=>{calls.push({url:String(url),options});return new Response('{}',{status:200})}) as typeof fetch)
 assert.equal(calls[0].options?.method,'PUT')
 assert.equal((calls[0].options?.headers as Record<string,string>).Authorization,'Bearer test-only-recovery')
 assert.equal(JSON.parse(String(calls[0].options?.body)).password,'senha-somente-teste')
 assert.match(calls[1].url,/logout\?scope=local/)
 let count=0
 await assert.rejects(recoveryUpdate({url:'https://project.example',key:'public-test'},'invalid-test','senha-somente-teste',(async()=>{count++;return new Response('{}',{status:401})}) as typeof fetch),(error:any)=>error.expired===true)
 assert.equal(count,1)
})
test('telas de recuperação não exibem formulário de senha sem link válido',()=>{
 const invalid=renderToStaticMarkup(<PasswordAccess initial="invalid" onClose={()=>{}} onComplete={()=>{}}/>)
 assert.match(invalid,/Precisamos de um novo link/);assert.doesNotMatch(invalid,/type="password"/)
 const update=renderToStaticMarkup(<PasswordAccess initial="update" onClose={()=>{}} onComplete={()=>{}}/>)
 assert.match(update,/Repita a nova senha/);assert.match(update,/autocomplete="new-password"/i)
})
test('guia deriva progresso de dados reais; ajustes e pagamentos de fatura não simulam primeiro gasto',()=>{
 const base={accounts:[] as Account[],entries:[] as Entry[]}
 assert.deepEqual(firstStepStatus(base,null),[false,false,null])
 const state={accounts:[{id:'a'} as Account],entries:[{type:'adjustment'},{type:'expense',cardPaymentId:'p'}] as Entry[]}
 assert.deepEqual(firstStepStatus(state,0),[true,false,false])
 state.entries.push({type:'expense',cardId:'card'} as Entry)
 assert.deepEqual(firstStepStatus(state,1),[true,true,true])
})


test('inicialização retira token da URL e permanece estável na montagem repetida do React',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'window')
 const visited:string[]=[]
 const fake={location:{hash:'#access_token=test-only-private&type=recovery',pathname:'/'},history:{replaceState:(_state:unknown,_title:string,url:string)=>{visited.push(url);fake.location.hash='#/recuperar-senha'}}}
 Object.defineProperty(globalThis,'window',{configurable:true,value:fake})
 try{assert.equal(initializeRecovery(),'update');assert.equal(initializeRecovery(),'update');assert.equal(visited.length,1);assert.equal(visited[0],'/#/recuperar-senha');assert.doesNotMatch(visited.join(''),/test-only-private/);leaveRecovery();fake.location.hash='#access_token=second-test&type=recovery';assert.equal(initializeRecovery(true),'update');assert.equal(visited[visited.length-1],'/#/recuperar-senha');leaveRecovery();fake.location.hash='#/visao-geral';assert.equal(initializeRecovery(true),null)}finally{if(original)Object.defineProperty(globalThis,'window',original);else Reflect.deleteProperty(globalThis,'window')}
})

