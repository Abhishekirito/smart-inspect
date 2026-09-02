import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { SettingsProvider } from './context/SettingsContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { isAppShell } from './lib/platform.js'
import { initNative } from './lib/native.js'
import './index.css'

// The website gets clean paths from a real server. The Android build is served
// from https://localhost inside a WebView with nothing to rewrite deep paths, so
// it routes on the hash — a reload or a restored process then still resolves.
const Router = isAppShell ? HashRouter : BrowserRouter

// Status bar, keyboard behaviour and the hardware back button. No-op on the web.
initNative()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <AuthProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </AuthProvider>
    </Router>
  </React.StrictMode>
)
