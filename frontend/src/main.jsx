import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

const initialPath = window.location.pathname.endsWith('/')
  ? window.location.pathname
  : window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1)
const basename = initialPath.length > 1 ? initialPath.replace(/\/+$/, '') : ''

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter basename={basename}>
    <App />
  </BrowserRouter>
)
