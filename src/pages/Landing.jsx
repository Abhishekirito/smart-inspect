import { Link } from 'react-router-dom'
import {
  ShieldCheck, ScanLine, FileCheck2, Gauge, ArrowRight, UploadCloud,
  Sparkles, ClipboardCheck, LogIn, CheckCircle2, ScrollText, Cpu, LockKeyhole,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const WHY = [
  {
    icon: ScrollText,
    title: 'Every verdict cites a clause',
    body: 'Results map directly to the Legal Metrology (Packaged Commodities) Rules, 2011 — no black-box scoring. You always know which rule was applied and why.',
  },
  {
    icon: Cpu,
    title: 'AI extracts, rules decide',
    body: 'OCR + an LLM read the label and structure the declarations. A deterministic rule engine — not the AI — makes the pass/fail call, so outcomes are consistent and defensible.',
  },
  {
    icon: Gauge,
    title: 'Enforcement at a glance',
    body: 'Grades, pass rates and the most-failed declarations roll up into a dashboard so patterns across many inspections are obvious.',
  },
]

const HOW = [
  { icon: UploadCloud, title: 'Upload label images', body: 'Add up to 3 panels (front, back, side) of the same packaged commodity.' },
  { icon: Sparkles, title: 'AI extracts declarations', body: 'OCR reads the text; the model structures net quantity, MRP, manufacturer, dates and more.' },
  { icon: ClipboardCheck, title: 'Review & verify', body: 'Inspect and correct the extracted fields, then run the rule engine against PCR 2011.' },
  { icon: FileCheck2, title: 'Get a cited report', body: 'A graded, clause-referenced compliance report you can print, export or revisit anytime.' },
]

function Header() {
  const { session } = useAuth()
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 lg:px-8">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow">
          <ShieldCheck size={20} />
        </div>
        <div className="flex-1">
          <div className="text-base font-extrabold leading-none">Smart Inspect</div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-400">Legal Metrology · PCR 2011</div>
        </div>
        {session ? (
          <Link to="/app" className="btn-primary !py-2 !px-3 text-sm">
            Open app <ArrowRight size={16} />
          </Link>
        ) : (
          <>
            <Link to="/login" className="btn-ghost !py-2 !px-3 text-sm">Log in</Link>
            <Link to="/signup" className="btn-primary !py-2 !px-3 text-sm">Sign up</Link>
          </>
        )}
      </div>
    </header>
  )
}

export default function Landing() {
  const { session } = useAuth()
  const primaryTo = session ? '/app' : '/signup'

  return (
    <div className="min-h-full bg-gradient-to-b from-white to-slate-50">
      <Header />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 lg:px-8 lg:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="animate-fade">
            <span className="chip ring-1 ring-inset bg-brand-50 text-brand-700 ring-brand-200">
              <Sparkles size={14} /> AI-assisted compliance
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
              Verify packaged-commodity labels against the law in seconds.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-slate-500">
              Smart Inspect reads a product label, extracts every mandatory declaration, and checks
              it against the Legal Metrology (Packaged Commodities) Rules, 2011 — returning a graded,
              clause-cited compliance report.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to={primaryTo} className="btn-primary px-5 py-3 text-base">
                {session ? 'Open the app' : 'Get started free'} <ArrowRight size={18} />
              </Link>
              {!session && (
                <Link to="/login" className="btn-outline px-5 py-3 text-base">
                  <LogIn size={18} /> I already have an account
                </Link>
              )}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-400">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Clause-level citations</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Deterministic verdicts</span>
              <span className="inline-flex items-center gap-1.5"><LockKeyhole size={14} className="text-emerald-500" /> Your scans, private to you</span>
            </div>
          </div>

          {/* Mock report card */}
          <div className="animate-fade">
            <div className="card mx-auto max-w-sm p-5 shadow-md">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-slate-700">Compliance Report</div>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500 text-2xl font-extrabold text-white shadow">A</span>
              </div>
              <div className="mt-4 space-y-2.5">
                {[
                  ['Net quantity', 'pass'],
                  ['MRP declaration', 'pass'],
                  ['Manufacturer / packer', 'pass'],
                  ['Month & year of mfg.', 'warn'],
                  ['Consumer care details', 'pass'],
                ].map(([label, st]) => (
                  <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-600">{label}</span>
                    {st === 'pass' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 size={14} /> Pass</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">● Review</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-brand-50 p-3 text-[11px] leading-relaxed text-brand-700">
                Each line references the exact PCR 2011 clause behind the verdict.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What it is */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 lg:px-8">
          <h2 className="text-center text-2xl font-extrabold text-slate-900">What is Smart Inspect?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-500">
            A tool for inspectors, manufacturers and retailers to check whether a packaged commodity's
            label carries every declaration the law requires — before it reaches the market or an audit.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {WHY.map((w) => (
              <div key={w.title} className="card p-6">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200">
                  <w.icon size={20} />
                </div>
                <h3 className="mt-4 font-bold text-slate-800">{w.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to use */}
      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
        <h2 className="text-center text-2xl font-extrabold text-slate-900">How it works</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-500">
          Four steps from a photo of a label to a defensible compliance verdict.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {HOW.map((h, i) => (
            <div key={h.title} className="card relative p-6">
              <span className="absolute right-4 top-4 text-4xl font-extrabold text-slate-100">{i + 1}</span>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-900 text-white">
                <h.icon size={20} />
              </div>
              <h3 className="mt-4 font-bold text-slate-800">{h.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{h.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 lg:px-8">
        <div className="rounded-3xl bg-brand-600 px-6 py-12 text-center text-white shadow-lg lg:px-12">
          <ScanLine className="mx-auto mb-4 opacity-90" size={34} />
          <h2 className="text-2xl font-extrabold sm:text-3xl">Ready to inspect your first label?</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">
            Create a free account to run scans and keep your inspection history synced securely to your profile.
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <Link to={primaryTo} className="btn bg-white px-6 py-3 text-base text-brand-700 hover:bg-brand-50">
              {session ? 'Open the app' : 'Create free account'} <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-slate-400 lg:px-8">
          Smart Inspect · AI-Powered Legal Metrology (PCR 2011) Compliance Scanner
        </div>
      </footer>
    </div>
  )
}
