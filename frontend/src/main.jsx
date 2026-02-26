import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import TestReveal from './TestReveal.jsx'

const isTest = window.location.hash === '#test-reveal'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isTest ? <TestReveal /> : <App />}
  </StrictMode>,
)
