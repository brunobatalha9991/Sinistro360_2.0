import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import { DataProvider } from './data/DataProvider.jsx'
import App from './App.jsx'
import { PublicTrackingPage } from './PublicTrackingPage.jsx'

// Link de acompanhamento público (a pedido do usuário): #/acompanhar/<token>
// nunca deve montar o DataProvider/login do app interno — ele carrega TODAS
// as coleções do sistema pra qualquer visitante (ver App.jsx/firebaseAdapter.js),
// o que contraria o próprio propósito de ter uma página pública restrita.
// Checado direto no hash, antes de qualquer coisa do app interno existir.
const hashMatch = /^#\/acompanhar\/(.+)$/.exec(window.location.hash);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {hashMatch ? (
      <PublicTrackingPage token={hashMatch[1]} />
    ) : (
      <DataProvider>
        <App />
      </DataProvider>
    )}
  </StrictMode>,
)
