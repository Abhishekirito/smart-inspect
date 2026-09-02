import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, Camera, Sparkles, FileCheck2, ArrowRight, ArrowLeft, CheckCircle2, LogIn,
} from 'lucide-react'
import { markOnboarded } from '../lib/onboarding.js'
import { useAppBack } from '../lib/native.js'
import { Skeleton } from '../components/Skeleton.jsx'

// First-launch intro for the installed app. The website keeps its marketing
// hero at "/" (Landing.jsx) — this is what the Android build opens on instead,
// and its only job is to get a new user signed in within a few taps: one idea
// per screen, no scrolling, and a Skip that goes straight to the login form.
//
// Each slide's artwork is a miniature of a real surface in the app rather than
// stock illustration, so the intro previews the product it is describing.

const SLIDES = [
  {
    icon: ShieldCheck,
    title: 'Compliance checks, in your pocket',
    body: 'Smart Inspect reads a packaged-commodity label and verifies every mandatory declaration against the Legal Metrology (Packaged Commodities) Rules, 2011.',
    tint: { tile: 'bg-brand-600 text-white', glow: 'bg-brand-200/60', chip: 'bg-brand-50 text-brand-700', label: 'PCR 2011' },
    rows: [['Net quantity', 'pass'], ['MRP declaration', 'pass'], ['Month & year of mfg.', 'review']],
  },
  {
    icon: Camera,
    title: 'Snap up to three panels',
    body: 'Photograph the front, back and side declaration panels of the same package. No forms to fill in — the label is the input.',
    tint: { tile: 'bg-slate-900 text-white', glow: 'bg-slate-300/60', chip: 'bg-slate-100 text-slate-600', label: 'Max 3' },
    rows: [['Panel 1 · Front', 'Added'], ['Panel 2 · Back', 'Added'], ['Panel 3 · Side', 'Optional']],
  },
  {
    icon: Sparkles,
    title: 'AI extracts, rules decide',
    body: 'OCR and a language model structure the declarations. A deterministic rule engine — not the AI — makes the pass or fail call, so verdicts stay consistent.',
    tint: { tile: 'bg-amber-500 text-white', glow: 'bg-amber-200/60', chip: 'bg-amber-50 text-amber-700', label: 'Extracting' },
    rows: [['Product', 'Toor Dal'], ['Net quantity', '1 kg'], ['MRP', 'pending']],
  },
  {
    icon: FileCheck2,
    title: 'Get a clause-cited verdict',
    body: 'A graded report that names the exact rule behind every line, saved to your history and ready to share or export.',
    tint: { tile: 'bg-emerald-600 text-white', glow: 'bg-emerald-200/60', chip: 'bg-emerald-50 text-emerald-700', label: 'Graded' },
    badge: 'A',
    rows: [['Rule 6 · Declarations', 'pass'], ['Rule 9 · Font size', 'pass'], ['Rule 13 · MRP', 'review']],
  },
]

const SWIPE_MIN_PX = 48

/** One line of the miniature card: a declaration and its verdict or value. */
function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <span className="min-w-0 truncate text-xs text-slate-600">{label}</span>
      {value === 'pass' ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-600">
          <CheckCircle2 size={13} /> Pass
        </span>
      ) : value === 'review' ? (
        <span className="shrink-0 text-[11px] font-semibold text-amber-600">● Review</span>
      ) : value === 'pending' ? (
        // Borrows the app's own loading tile, so the slide about extraction
        // looks like extraction actually in progress.
        <Skeleton className="h-3 w-14 shrink-0" />
      ) : (
        <span className="shrink-0 text-[11px] font-semibold text-slate-500">{value}</span>
      )}
    </div>
  )
}

/** Decorative miniature of a compliance card, with a soft brand glow behind. */
function SlideArt({ slide }) {
  const { icon: Icon, tint, rows, badge } = slide
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[19rem]">
      <div className={`absolute -inset-8 -z-10 rounded-full blur-3xl ${tint.glow}`} />
      <div className="card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className={`grid h-12 w-12 place-items-center rounded-2xl shadow-sm ${tint.tile}`}>
            <Icon size={24} />
          </div>
          {badge ? (
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500 text-xl font-extrabold text-white shadow">
              {badge}
            </span>
          ) : (
            <span className={`chip ${tint.chip}`}>{tint.label}</span>
          )}
        </div>
        <div className="mt-4 space-y-2">
          {rows.map(([label, value]) => <Row key={label} label={label} value={value} />)}
        </div>
      </div>
    </div>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const touchStartX = useRef(null)

  const slide = SLIDES[step]
  const last = step === SLIDES.length - 1

  // Skipping and finishing both count as seen: the intro is a one-time thing,
  // and `replace` keeps it out of the history so back never returns to it.
  const leave = (to) => {
    markOnboarded()
    navigate(to, { replace: true })
  }

  const goNext = () => (last ? leave('/signup') : setStep((s) => s + 1))

  // Returns whether it consumed the gesture, which is what Android back needs.
  const goPrev = () => {
    if (step === 0) return false
    setStep((s) => s - 1)
    return true
  }

  useAppBack(goPrev)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'ArrowRight' && !last) setStep((s) => s + 1)
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step, last])

  const onTouchStart = (e) => { touchStartX.current = e.touches[0]?.clientX ?? null }

  const onTouchEnd = (e) => {
    const from = touchStartX.current
    touchStartX.current = null
    if (from === null) return
    const dx = (e.changedTouches[0]?.clientX ?? from) - from
    if (Math.abs(dx) < SWIPE_MIN_PX) return
    // Swiping past the last slide must not sign anyone up by accident.
    if (dx < 0 && !last) setStep((s) => s + 1)
    if (dx > 0) goPrev()
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="group"
      aria-roledescription="carousel"
      aria-label="Introduction to Smart Inspect"
      className="flex min-h-full flex-col overflow-hidden bg-gradient-to-b from-white via-white to-brand-50 px-5 pb-safe pt-safe"
    >
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow">
          <ShieldCheck size={18} />
        </div>
        <div>
          <div className="text-sm font-extrabold leading-none text-slate-800">Smart Inspect</div>
          <div className="mt-0.5 text-[10px] font-medium text-slate-400">Legal Metrology · PCR 2011</div>
        </div>
        <button
          type="button"
          onClick={() => leave('/login')}
          className="ml-auto rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          Skip
        </button>
      </div>

      {/* Keyed on the step so each slide fades in (index.css stops the fade
          under prefers-reduced-motion). */}
      <div key={step} className="animate-fade flex flex-1 flex-col justify-center gap-7 py-8">
        <SlideArt slide={slide} />
        <div className="text-center">
          <h1 className="text-[1.6rem] font-extrabold leading-tight text-slate-900">{slide.title}</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-500">{slide.body}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-center gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              aria-current={i === step}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-brand-600' : 'w-1.5 bg-slate-300'}`}
            />
          ))}
        </div>
        <span aria-live="polite" className="sr-only">Step {step + 1} of {SLIDES.length}</span>

        {last ? (
          <div className="space-y-2.5">
            <button type="button" onClick={() => leave('/signup')} className="btn-primary w-full py-3.5 text-base">
              Create free account <ArrowRight size={18} />
            </button>
            <button type="button" onClick={() => leave('/login')} className="btn-ghost w-full py-3.5 text-base">
              <LogIn size={18} /> I already have an account
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            {step > 0 && (
              <button type="button" onClick={goPrev} aria-label="Previous step" className="btn-ghost !px-3.5 py-3.5">
                <ArrowLeft size={18} />
              </button>
            )}
            <button type="button" onClick={goNext} className="btn-primary flex-1 py-3.5 text-base">
              {step === 0 ? 'Get started' : 'Next'} <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

