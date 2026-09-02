import { createContext, useContext, useEffect, useState } from 'react'

const KEY = 'smart-inspect-settings'

const getDefaults = () => ({
  // Recommended stack: Google Vision (OCR) + Gemini / Groq (structuring)
  ocrEngine: 'vision',         // 'vision' | 'ocrspace'
  structuringEngine: 'gemini', // 'gemini' | 'groq'
  visionKey: import.meta.env.VITE_GOOGLE_VISION_API_KEY || import.meta.env.VITE_VISION_API_KEY || '',
  groqKey: import.meta.env.VITE_GROQ_API_KEY || '',
  groqModel: import.meta.env.VITE_GROQ_MODEL || 'groq/compound',
  ocrSpaceKey: import.meta.env.VITE_OCR_SPACE_API_KEY || 'helloworld',   // OCR.space public demo key — no-signup fallback
  geminiKey: import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_VISION_API_KEY || '',
  geminiModel: import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.6-flash',
  officerName: 'Inspector',
  region: '',
})

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const defaults = getDefaults()
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
      return {
        ...defaults,
        ...saved,
        // Prioritize explicit environment variables from .env over stale localStorage
        geminiModel: import.meta.env.VITE_GEMINI_MODEL || saved.geminiModel || defaults.geminiModel,
        groqModel: import.meta.env.VITE_GROQ_MODEL || saved.groqModel || defaults.groqModel,
        groqKey: import.meta.env.VITE_GROQ_API_KEY || saved.groqKey || defaults.groqKey,
        geminiKey: import.meta.env.VITE_GEMINI_API_KEY || saved.geminiKey || defaults.geminiKey,
        visionKey: import.meta.env.VITE_GOOGLE_VISION_API_KEY || import.meta.env.VITE_VISION_API_KEY || saved.visionKey || defaults.visionKey,
      }
    } catch {
      return defaults
    }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings))
  }, [settings])

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }))

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
