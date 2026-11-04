import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { EffectsPreviewPage } from './EffectsPreview'
import './styles.css'
import './styles/adventure.css'
import './styles/credit-card-insights.css'
import './styles/missions.css'
import './styles/budgets.css'
import './styles/recurring.css'
import './styles/access.css'
import './styles/identity.css'
import './styles/effects.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{new URLSearchParams(location.search).get('previa')==='efeitos'?<EffectsPreviewPage/>:<App/>}</React.StrictMode>
)
