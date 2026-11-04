import { useRef, useState } from 'react'
import { Coins, Gem, Sparkles, Receipt } from 'lucide-react'
import { RewardCelebration } from './ActionEffects'
import { Toast } from './ui'

const examples = [
  {name:'Subir de nível',icon:Gem,xp:25,coins:10,level:8},
  {name:'Ganhar XP',icon:Sparkles,xp:5,coins:0,level:null},
  {name:'Ganhar Graninhas',icon:Coins,xp:0,coins:25,level:null},
  {name:'Salvar gasto',icon:Receipt,xp:0,coins:0,level:null},
]

export function EffectsPreview(){
  const [sample,setSample]=useState<{index:number;id:number}|null>(null)
  const counter=useRef(0)
  const buttons=useRef<(HTMLButtonElement|null)[]>([])
  const stage=useRef<HTMLDivElement>(null)
  const close=()=>{
    if(sample && stage.current?.contains(document.activeElement)) buttons.current[sample.index]?.focus()
    setSample(null)
  }
  return <section className="effects-preview" aria-label="Prévia das animações">
    <h2>Experimente as animações</h2><p>Escolha um efeito. Os valores são exemplos e não alteram sua conta.</p>
    <div className="effects-choices">{examples.map(({name,icon:Icon},index)=><button type="button" key={name} ref={el=>{buttons.current[index]=el}} aria-controls="effects-stage" onClick={()=>setSample({index,id:++counter.current})}><Icon size={18} aria-hidden="true"/>{name}</button>)}</div>
    <div className="effects-stage" id="effects-stage" ref={stage}>
      {!sample?<span>Seu efeito aparece aqui</span>:sample.index===3?<Toast key={sample.id} message="Gasto salvo · demonstração" tone="success" onClose={close}/>:<RewardCelebration key={sample.id} preview effect={{...examples[sample.index],id:sample.id}} onClose={close}/>}
    </div>
  </section>
}

export function EffectsPreviewPage(){
  const [dark,setDark]=useState(document.documentElement.dataset.theme!=='light')
  return <main className="identity-app effects-preview-page"><header><b>granaê.</b><button type="button" onClick={()=>{document.documentElement.dataset.theme=dark?'light':'dark';setDark(!dark)}}>{dark?'Usar tema claro':'Usar tema escuro'}</button></header>
    <EffectsPreview/><a href="./">Voltar ao Granaê →</a></main>
}
