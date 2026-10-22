/** Recovery tokens stay in memory and are never treated as the normal app session. */
export type RecoveryRedirect={kind:'none'}|{kind:'invalid'}|{kind:'update';accessToken:string}
export const RECOVERY_REDIRECT_URL='https://granae-cash.vercel.app/'
export function parseRecoveryRedirect(hash:string):RecoveryRedirect {
 if(hash==='#/recuperar-senha')return {kind:'invalid'}
 const params=new URLSearchParams(hash.replace(/^#/,''))
 if(params.has('error')||params.has('error_code'))return {kind:'invalid'}
 if(params.get('type')!=='recovery')return {kind:'none'}
 const token=params.get('access_token')
 return token&&token.length<=16384?{kind:'update',accessToken:token}:{kind:'invalid'}
}
export function passwordProblem(password:string,confirmation:string) {
 if(password.length<8||password.length>128)return 'Use uma senha de 8 a 128 caracteres.'
 if(password!==confirmation)return 'As senhas não coincidem.'
 return ''
}
export async function recoveryRequest(config:{url:string;key:string},email:string,fetcher:typeof fetch=fetch) {
 const response=await fetcher(`${config.url}/auth/v1/recover?redirect_to=${encodeURIComponent(RECOVERY_REDIRECT_URL)}`,{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({email:email.trim()})})
 if(!response.ok)throw new Error(response.status===429?'Aguarde alguns minutos antes de solicitar outro link.':'Não foi possível solicitar o link agora. Tente novamente mais tarde.')
}
export async function recoveryUpdate(config:{url:string;key:string},token:string,password:string,fetcher:typeof fetch=fetch) {
 const response=await fetcher(`${config.url}/auth/v1/user`,{method:'PUT',headers:{apikey:config.key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({password})})
 if(!response.ok) {
  if(response.status===401||response.status===403)throw Object.assign(new Error('Este link expirou ou não é mais válido. Solicite outro link.'),{expired:true})
  const body=await response.json().catch(()=>null)
  throw new Error(body?.error_code==='same_password'?'Escolha uma senha diferente da anterior.':'Não foi possível salvar a senha. Confira os requisitos e tente novamente.')
 }
 // Best-effort revocation of this recovery session. No admin credential is used.
 await fetcher(`${config.url}/auth/v1/logout?scope=local`,{method:'POST',headers:{apikey:config.key,Authorization:`Bearer ${token}`}}).catch(()=>undefined)
}
