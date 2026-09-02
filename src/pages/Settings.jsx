import { useState } from 'react'
import { useSettings } from '../context/SettingsContext.jsx'
import { clearAll } from '../lib/db.js'
import {
  Cpu, User, Trash2, CheckCircle2, ScanText, Zap, Sparkles, ShieldCheck,
} from 'lucide-react'

const OCR_ENGINES = [
  { id: 'vision', name: 'Google Cloud Vision', icon: ScanText, desc: 'DOCUMENT_TEXT_DETECTION — high-accuracy OCR with word bounding boxes for the boundary overlay.', free: 'Free tier: 1,000 units/month' },
  { id: 'ocrspace', name: 'OCR.space (fallback)', icon: ScanText, desc: 'No-signup fallback. Used automatically if no Vision key is set.', free: 'Free demo key included' },
]

export default function Settings() {
  const { settings, update } = useSettings()
  const [saved, setSaved] = useState(false)
  const [cleared, setCleared] = useState(false)

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1600) }
  const set = (patch) => { update(patch); flash() }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-400">Pipeline: <b>Google Vision</b> (OCR + boxes) → <b>Gemini Flash</b> (structure into JSON) → deterministic rule engine.</p>
      </div>

      {/* OCR engine */}
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-2 font-bold text-slate-800"><Cpu size={18} /> OCR engine</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {OCR_ENGINES.map((p) => (
            <button key={p.id} onClick={() => set({ ocrEngine: p.id })}
              className={`rounded-xl border p-4 text-left transition ${settings.ocrEngine === p.id ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100' : 'border-slate-200 hover:border-slate-300'}`}>
              <p.icon size={18} className={settings.ocrEngine === p.id ? 'text-brand-600' : 'text-slate-400'} />
              <div className="mt-2 font-bold text-slate-700">{p.name}</div>
              <div className="mt-1 text-xs text-slate-500">{p.desc}</div>
              <div className="mt-2 text-[11px] font-semibold text-emerald-600">{p.free}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Structuring Engine */}
      <div className="card p-5">
        <div className="mb-2 flex items-center gap-2 font-bold text-slate-800"><Zap size={18} /> Structuring Engine Architecture</div>
        <p className="mb-4 text-xs text-slate-500">The pipeline automatically uses <b>Google Gemini Flash</b> as the primary LLM to extract JSON declarations, and seamlessly fails over to <b>Groq Cloud</b> if Gemini does not respond or encounters an error.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4 text-left">
            <div className="flex items-center justify-between">
              <Sparkles size={18} className="text-brand-600" />
              <span className="rounded bg-brand-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-brand-700">PRIMARY LLM</span>
            </div>
            <div className="mt-2 font-bold text-slate-700">Google Gemini Flash ({settings.geminiModel})</div>
            <div className="mt-1 text-xs text-slate-500">1M+ token context window. Handles large OCR label outputs with zero payload size limits.</div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-left">
            <div className="flex items-center justify-between">
              <Cpu size={18} className="text-amber-600" />
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-700">AUTO FALLBACK</span>
            </div>
            <div className="mt-2 font-bold text-slate-700">Groq Cloud ({settings.groqModel})</div>
            <div className="mt-1 text-xs text-slate-500">Ultra-fast inference fallback activated if Gemini key is missing, rate-limited, or fails.</div>
          </div>
        </div>
      </div>

      {/* API Status */}
      <div className="card p-5">
        <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 ring-1 ring-emerald-200">
          <ShieldCheck size={15} className="mt-0.5 shrink-0" />
          <span>API keys are securely managed via environment variables and are never exposed in the browser UI. Configure them in your <b>.env</b> file (local dev) or <b>Vercel Dashboard → Settings → Environment Variables</b> (production).</span>
        </div>
      </div>

      {/* Profile */}
      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-2 font-bold text-slate-800"><User size={18} /> Inspector profile</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Officer name</label>
            <input className="input" value={settings.officerName} onChange={(e) => update({ officerName: e.target.value })} onBlur={flash} />
          </div>
          <div>
            <label className="label">Region / zone</label>
            <input className="input" placeholder="e.g. Delhi NCR" value={settings.region} onChange={(e) => update({ region: e.target.value })} onBlur={flash} />
          </div>
        </div>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="font-bold text-slate-800">Clear all local data</div>
          <div className="text-sm text-slate-400">Permanently deletes every stored scan and report.</div>
        </div>
        <button className="btn-outline !border-red-200 !text-red-600 hover:!bg-red-50"
          onClick={async () => { if (confirm('Delete ALL scans?')) { await clearAll(); setCleared(true); setTimeout(() => setCleared(false), 1600) } }}>
          <Trash2 size={16} /> {cleared ? 'Cleared' : 'Clear data'}
        </button>
      </div>

      {saved && (
        <div className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg animate-fade">
          <CheckCircle2 size={16} className="text-emerald-400" /> Settings saved
        </div>
      )}
    </div>
  )
}
