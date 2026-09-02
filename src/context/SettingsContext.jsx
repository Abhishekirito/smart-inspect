import { createContext, useContext, useEffect, useState } from 'react'

const KEY = 'smart-inspect-settings'

// API keys are sourced ONLY from environment variables (set in .env locally or
// in the Vercel dashboard for production). They are never configurable via the
// UI and are never persisted to localStorage — Vercel's env var encryption
// handles security. Only non-sensitive preferences (officer name, region,
// engine choice) are stored in localStorage.
const ENV_KEYS = {
  visionKey: import.meta.env.VITE_GOOGLE_VISION_API_KEY || import.meta.env.VITE_VISION_API_KEY || '',
  groqKey: import.meta.env.VITE_GROQ_API_KEY || '',
  groqModel: import.meta.env.VITE_GROQ_MODEL || 'groq/compound',
  ocrSpaceKey: import.meta.env.VITE_OCR_SPACE_API_KEY || 'helloworld',
  geminiKey: import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_VISION_API_KEY || '',
  geminiModel: import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.6-flash',
}

const getDefaults = () => ({
  ocrEngine: 'vision',         // 'vision' | 'ocrspace'
  structuringEngine: 'gemini', // 'gemini' | 'groq'
  officerName: 'Inspector',
  region: '',
  ...ENV_KEYS,
})

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const defaults = getDefaults()
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
      return {
        ...defaults,
        // Only restore non-key preferences from localStorage
        ocrEngine: saved.ocrEngine || defaults.ocrEngine,
        officerName: saved.officerName || defaults.officerName,
        region: saved.region || defaults.region,
      }
    } catch {
      return defaults
    }
  })

  useEffect(() => {
    // Only persist non-sensitive preferences — never API keys
    const { ocrEngine, officerName, region } = settings
    localStorage.setItem(KEY, JSON.stringify({ ocrEngine, officerName, region }))
  }, [settings])

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }))

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
