import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Printer, Download, ShieldCheck, FileText,
  Building2, Package, CalendarClock,
} from 'lucide-react'
import { getScan } from '../lib/db.js'
import { FieldStatus, StatusBadge, GradeBadge, Chip } from '../components/ui.jsx'
import { ReportSkeleton } from '../components/Skeleton.jsx'
import ImageAnnotator from '../components/ImageAnnotator.jsx'

function downloadJSON(scan) {
  const blob = new Blob([JSON.stringify(scan, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `compliance-${scan.id}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Report() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [scan, setScan] = useState(undefined)

  useEffect(() => { getScan(id).then(setScan).catch(() => setScan(null)) }, [id])

  if (scan === undefined) return <ReportSkeleton />
  if (!scan) return (
    <div className="mx-auto max-w-lg card p-8 text-center">
      <p className="text-slate-500">Report not found.</p>
      <Link to="/app/history" className="btn-outline mt-4">Back to history</Link>
    </div>
  )

  const { report, structured, meta } = scan
  const g = report.grade
  const dt = new Date(scan.createdAt)

  return (
    <div className="mx-auto max-w-5xl space-y-5 print:max-w-none">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button className="btn-ghost !px-2" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
        <h1 className="text-xl font-extrabold text-slate-800">Compliance Report</h1>
        <div className="ml-auto flex gap-2">
          <button className="btn-outline" onClick={() => downloadJSON(scan)}><Download size={16} /> JSON</button>
          <button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> Print / PDF</button>
        </div>
      </div>

      {/* Header / verdict card */}
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-5 border-b border-slate-100 p-6 sm:flex-row sm:items-center">
          <GradeBadge letter={g.letter} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={report.overall_status} />
              {g.verdict && <Chip color={g.verdict === 'PASS' ? 'emerald' : 'red'}>{g.verdict}</Chip>}
              <span className="text-xs text-slate-400">Scan ID {scan.id}</span>
            </div>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-800 leading-tight break-words">{scan.productName}</h2>
            <p className="text-sm text-slate-500">{g.label}</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-extrabold text-slate-800">{g.score == null ? '—' : g.score}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">/ 100 score</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-slate-100 text-sm sm:grid-cols-4">
          {[
            [Building2, 'Officer', scan.officer || '—'],
            [Package, 'Region', scan.region || '—'],
            [CalendarClock, 'Scanned', dt.toLocaleString()],
            [FileText, 'Extraction', (scan.source || '—').replace(/\s*\(DOCUMENT_TEXT_DETECTION\)/i, '')],
          ].map(([Icon, k, v]) => (
            <div key={k} className="bg-white p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Icon size={13} /> {k}</div>
              <div className="mt-1 font-semibold text-slate-700 break-words text-xs sm:text-sm">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Applicability & Mandatory Declaration Checklist */}
      <div className="card overflow-hidden print:break-inside-avoid">
        {/* Applicability banner */}
        <div className="border-b border-slate-100 bg-brand-50/50 p-4 print:p-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-brand-600" size={18} />
            <div>
              <div className="text-sm font-bold text-slate-800">Applicability — {scan.report.applicability.rule_ref || 'Rule 3 / 26'}</div>
              <p className="text-xs sm:text-sm text-slate-600">{scan.report.applicability.note}</p>
            </div>
          </div>
        </div>

        {/* Mandatory Checklist Header */}
        <div className="border-b border-slate-100 px-5 py-3.5 print:px-4 print:py-2 bg-slate-50/50">
          <h3 className="font-bold text-slate-800">Mandatory Declaration Checklist</h3>
          <p className="text-xs text-slate-400">Every line cites the exact clause of the Packaged Commodities Rules, 2011.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {report.field_results.map((r) => (
            <div key={r.field_id} className="grid gap-3 px-5 py-3 sm:grid-cols-12 sm:items-start print:px-4 print:py-2 print:grid-cols-12">
              <div className="sm:col-span-4 print:col-span-4 pr-3">
                <div className="font-semibold text-slate-800 break-words leading-snug text-xs sm:text-sm">{r.label}</div>
                <div className="mt-0.5 text-[11px] text-slate-400 font-mono">{r.rule_ref}</div>
              </div>
              <div className="sm:col-span-6 print:col-span-6 min-w-0">
                <div className="text-xs sm:text-sm text-slate-600 leading-relaxed">{r.reason}</div>
                {r.extracted_value && (
                  <div className="mt-0.5 text-[11px] text-slate-400 break-words">
                    <span className="font-medium text-slate-500">Extracted:</span> "{r.extracted_value}"
                  </div>
                )}
              </div>
              <div className="sm:col-span-2 print:col-span-2 flex justify-start sm:justify-end print:justify-end">
                <FieldStatus status={r.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div className="card p-5">
        <h3 className="mb-3 font-bold text-slate-800">Font Size Analysis — Rule 7</h3>
        <div className="grid gap-4 sm:grid-cols-4 text-sm">
          <div><div className="label">Declared</div>{report.font_size_check.declared_quantity ?? '—'} {report.font_size_check.unit}</div>
          <div><div className="label">Applied table</div>{report.font_size_check.table} · {report.font_size_check.band}</div>
          <div><div className="label">Required min</div>{report.font_size_check.required_min_height_mm} mm{meta?.molded ? ' (molded)' : ''}</div>
          <div><div className="label">Measured</div>{report.font_size_check.measured_height_mm ?? 'not measured'}{report.font_size_check.measured_height_mm != null ? ' mm' : ''}</div>
        </div>
      </div>

      {/* Evidence + data */}
      <div className="grid gap-5 lg:grid-cols-2 print:grid-cols-1">
        <div className="card p-5 print:break-inside-avoid print:p-3">
          {(() => {
            const imagesList = scan.images && scan.images.length > 0 ? scan.images : [scan.image].filter(Boolean)
            return (
              <>
                <h3 className="mb-3 font-bold text-slate-800 print:mb-2 print:text-sm">
                  Photographic Evidence {imagesList.length > 1 ? `(${imagesList.length} Panels)` : ''}
                </h3>
                <div className={`grid gap-3 ${
                  imagesList.length === 3
                    ? 'grid-cols-1 sm:grid-cols-3 print:grid-cols-3'
                    : imagesList.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2 print:grid-cols-2'
                    : 'grid-cols-1'
                }`}>
                  {imagesList.map((imgSrc, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-center print:break-inside-avoid print:p-1">
                      <div className="mb-1 text-[11px] font-bold text-slate-700">
                        Panel {i + 1} {i === 0 ? '(Front)' : i === 1 ? '(Back)' : '(Side)'}
                      </div>
                      <ImageAnnotator
                        src={imgSrc}
                        words={(scan.words || []).filter((w) => (w.imageIndex || 1) === (i + 1))}
                        fields={structured}
                      />
                    </div>
                  ))}
                </div>
              </>
            )
          })()}
        </div>
        <div className="card p-5 print:hidden">
          <h3 className="mb-3 font-bold text-slate-800">Structured Declaration Data</h3>
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-700 ring-1 ring-slate-200">{JSON.stringify(structured, null, 2)}</pre>
        </div>
      </div>

      <p className="pb-6 text-center text-xs text-slate-400">
        Generated by Smart Inspect · Deterministic verdicts per Legal Metrology (Packaged Commodities) Rules, 2011. Engineering aid, not a legal opinion.
      </p>
    </div>
  )
}
