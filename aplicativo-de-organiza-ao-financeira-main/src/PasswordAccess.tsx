import {useRef,useState} from 'react'
import type {FormEvent} from 'react'
import {KeyRound} from 'lucide-react'
import {Brand,Button,InlineError} from './ui'
import {requestPasswordRecovery,updateRecoveredPassword} from './data'
import {passwordProblem} from './recovery'

export function PasswordAccess({initial='request',onClose,onComplete}:{initial?:'request'|'invalid'|'update';onClose:()=>void;onComplete:()=>void}) {
 const [step,setStep]=useState(initial),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false)
 const busy=useRef(false)
 const submit=async(e:FormEvent)=>{
  e.preventDefault();if(busy.current)return;setError('')
  if(step==='update'){const problem=passwordProblem(password,confirmation);if(problem){setError(problem);return}}
  busy.current=true;setPending(true)
  try{if(step==='update'){await updateRecoveredPassword(password);setPassword('');setConfirmation('');onComplete()}else{await requestPasswordRecovery(email);setSent(true)}}catch(err){setError((err as Error).message);if((err as {expired?:boolean}).expired){setPassword('');setConfirmation('');setStep('invalid')}}finally{busy.current=false;setPending(false)}
 }
 return <main className="access-layout"><section className="card access-card"><Brand/><span className="access-icon"><KeyRound size={25}/></span><h1>{step==='update'?'Defina sua nova senha':step==='invalid'?'Precisamos de um novo link':'Recuperar acesso'}</h1>
  {step==='invalid'&&<p>O link está incompleto, expirou ou já foi usado. Solicite outro e abra o link mais recente recebido por e-mail.</p>}
  {sent?<div role="status"><h2>Confira seu e-mail</h2><p>Se houver uma conta com esse e-mail, você receberá as instruções de recuperação. Verifique também a pasta de spam.</p><p>Se não chegar, aguarde alguns minutos antes de tentar novamente.</p><Button variant="secondary" onClick={onClose}>Voltar para entrar</Button></div>:<form className="form" onSubmit={submit}>
   {step==='update'?<><p>O link autoriza a troca da senha. Seus registros financeiros e conquistas serão preservados.</p><label>Nova senha<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" autoFocus value={password} onChange={e=>setPassword(e.target.value)} aria-describedby="password-requirements"/></label><small id="password-requirements">Use de 8 a 128 caracteres. Prefira uma senha longa e exclusiva.</small><label>Repita a nova senha<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label></>:<><p>Informe o e-mail usado no cadastro. Você receberá um link para escolher uma nova senha.</p><label>E-mail da conta<input type="email" required maxLength={255} autoComplete="email" autoFocus value={email} onChange={e=>setEmail(e.target.value)}/></label></>}
   {error&&<InlineError>{error}</InlineError>}<Button type="submit" disabled={pending}>{pending?'Aguarde…':step==='update'?'Salvar nova senha':'Enviar link de recuperação'}</Button><Button variant="ghost" disabled={pending} onClick={onClose}>Voltar para entrar</Button>
  </form>}
 </section></main>
}
