import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

/** Colourblind-safe mode adds shape/hatching alongside hue. Applied before the
 *  first paint so the board never flashes in the wrong encoding. */
export const CB_KEY = 'pt-colorblind'
if (localStorage.getItem(CB_KEY) === '1') document.documentElement.classList.add('cb')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
