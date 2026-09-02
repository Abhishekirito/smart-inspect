import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UploadCloud, ScanLine, Loader2, FileJson, ImageIcon, Type,
  Sparkles, AlertCircle, ChevronRight, RotateCcw, ShieldAlert,
  Eye, EyeOff, FileText, CheckCircle2, Sliders, ChevronDown, ChevronUp, X, Plus
} from 'lucide-react'
import { useSettings } from '../context/SettingsContext.jsx'
import { extractAll, fileToDataURL } from '../lib/aiService.js'
import evaluate from '../lib/ruleEngine.js'
import { saveScan, uid } from '../lib/db.js'
import ImageAnnotator from '../components/ImageAnnotator.jsx'
import { ScanExtractSkeleton } from '../components/Skeleton.jsx'

const FIELD_FORM = [
  ['product_name', 'Product name', 'text'],
  ['common_generic_name', 'Common / generic name', 'text'],
  ['manufacturer_packer_importer', 'Manufacturer / packer / importer', 'textarea'],
  ['net_quantity_raw', 'Net quantity (as printed)', 'text'],
  ['net_quantity_value', 'Net quantity value', 'number'],
  ['net_quantity_unit', 'Unit', 'text'],
  ['mrp_raw', 'MRP (as printed)', 'text'],
  ['mfg_date_raw', 'Month/year of manufacture', 'text'],
  ['consumer_care_raw', 'Consumer care details', 'textarea'],
  ['country_of_origin', 'Country of origin', 'text'],
  ['commodity_category', 'Commodity category', 'text'],
  ['commodity_type', 'Commodity type', 'text'],
]

function Section({ n, title, desc, children, done }) {
  return (
    <section className="card animate-fade p-5 lg:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-600 text-white'}`}>{n}</div>
        <div>
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
          {desc && <p className="text-sm text-slate-400">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export default function Scan() {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // {rawText, words, structured, source, warn, isMismatch, mismatchReason}
  const [structured, setStructured] = useState(null)
  const [meta, setMeta] = useState({ molded: false, measuredHeightMm: '', pdpAreaCm2: '', is_imported: false, buyer_type: 'retail' })
  const [showInspect, setShowInspect] = useState(false)
  const [inspectTab, setInspectTab] = useState('fields') // 'fields' | 'ocr' | 'physical'
  const [generatingReport, setGeneratingReport] = useState(false)

  const handleFiles = useCallback(async (fileList) => {
    if (!fileList || !fileList.length) return
    const incoming = Array.from(fileList)
    const updatedFiles = [...files, ...incoming].slice(0, 3)
    const updatedPreviews = await Promise.all(updatedFiles.map(fileToDataURL))

    setError('')
    setResult(null)
    setStructured(null)
    setShowInspect(false)
    setFiles(updatedFiles)
    setPreviews(updatedPreviews)
  }, [files])

  const removeFile = (idx) => {
    const updatedFiles = files.filter((_, i) => i !== idx)
    const updatedPreviews = previews.filter((_, i) => i !== idx)
    setFiles(updatedFiles)
    setPreviews(updatedPreviews)
    setResult(null)
    setStructured(null)
    setError('')
    setShowInspect(false)
  }

  const runExtract = async () => {
    if (!files.length) return
    setBusy(true); setError('')
    try {
      const r = await extractAll(files, settings)
      setResult(r)
      setStructured({ ...r.structured })
    } catch (e) {
      setError(e.message || 'Extraction failed.')
    } finally {
      setBusy(false)
    }
  }

  const setField = (k, v) => setStructured((s) => ({ ...s, [k]: v }))

  const runAnalyze = async () => {
    if (!structured || result?.isMismatch || generatingReport) return
    setGeneratingReport(true)
    setError('')
    try {
      const st = {
        ...structured,
        net_quantity_value: structured.net_quantity_value === '' || structured.net_quantity_value == null ? null : Number(structured.net_quantity_value),
        is_imported: meta.is_imported || !!structured.is_imported,
        buyer_type: meta.buyer_type,
      }
      const m = {
        molded: meta.molded,
        measuredHeightMm: meta.measuredHeightMm === '' ? null : Number(meta.measuredHeightMm),
        pdpAreaCm2: meta.pdpAreaCm2 === '' ? null : Number(meta.pdpAreaCm2),
      }
      const report = evaluate(st, m)
      const scan = {
        id: uid(),
        createdAt: Date.now(),
        officer: settings.officerName,
        region: settings.region,
        productName: st.product_name || st.common_generic_name || 'Unnamed product',
        image: previews[0] || null,
        images: previews,
        words: result.words,
        rawText: result.rawText,
        source: result.source,
        structured: st,
        meta: m,
        report,
      }
      await saveScan(scan)
      navigate(`/app/report/${scan.id}`)
    } catch (e) {
      setError(e.message || 'Failed to generate report. Please try again.')
      setGeneratingReport(false)
    }
  }

  const reset = () => { setFiles([]); setPreviews([]); setResult(null); setStructured(null); setError(''); setShowInspect(false); setGeneratingReport(false) }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">New Compliance Scan</h1>
        <p className="text-sm text-slate-400">Upload at most 3 label images (Front, Back & Side panels) of the same packaged commodity to extract and verify declarations.</p>
      </div>

      <Section n={1} title="Upload label images (Max 3)" desc="Upload front, back, or side panels of the SAME packaged commodity." done={previews.length > 0}>
        {previews.length === 0 ? (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition hover:border-brand-400 hover:bg-brand-50/40">
            <UploadCloud className="mb-3 text-slate-400" size={34} />
            <span className="text-sm font-semibold text-slate-600">Click to upload or drag images (at most 3)</span>
            <span className="mt-1 text-xs text-slate-400">JPG / PNG · Front panel, Back panel, or Side declaration panel</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          </label>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-4">
              {previews.map((src, i) => (
                <div key={i} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-2 text-center w-48 shadow-sm">
                  <div className="absolute top-3 left-3 rounded-md bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold text-white uppercase backdrop-blur-sm">
                    {i === 0 ? 'Panel 1 (Front)' : i === 1 ? 'Panel 2 (Back)' : 'Panel 3 (Side)'}
                  </div>
                  <button
                    className="absolute top-3 right-3 grid h-6 w-6 place-items-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 transition"
                    onClick={() => removeFile(i)}
                    title="Remove image"
                  >
                    <X size={14} />
                  </button>
                  <img src={src} alt={`Panel ${i + 1}`} className="h-44 w-full rounded-xl object-cover" />
                  <div className="mt-2 truncate text-xs font-semibold text-slate-700">{files[i]?.name}</div>
                  <div className="text-[10px] text-slate-400">{(files[i]?.size / 1024).toFixed(0)} KB</div>
                </div>
              ))}

              {files.length < 3 && (
                <label className="flex h-52 w-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-brand-400 hover:bg-brand-50/40">
                  <Plus className="mb-1 text-brand-600" size={28} />
                  <span className="text-xs font-bold text-brand-600">Add Next Panel</span>
                  <span className="mt-0.5 text-[10px] text-slate-400">{files.length === 1 ? 'Back Panel' : 'Side Panel'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                </label>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <div className="text-xs text-slate-500">
                <span><b>{files.length} of 3</b> images loaded</span>
                <span> · OCR: <b className="uppercase">{settings.ocrEngine === 'vision' ? 'Google Vision' : 'OCR.space'}</b></span>
                <span> · Structuring: <b>Gemini Flash</b></span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" onClick={runExtract} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  {busy ? 'Extracting…' : result ? 'Re-extract Data' : `Extract & Analyze (${files.length} Image${files.length > 1 ? 's' : ''})`}
                </button>
                <button className="btn-outline" onClick={reset}><RotateCcw size={16} /> Reset All</button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}

        {result?.isMismatch && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-800 ring-2 ring-red-300 animate-fade">
            <ShieldAlert size={22} className="mt-0.5 shrink-0 text-red-600" />
            <div>
              <div className="font-extrabold text-red-900 text-base">Different Commodities Detected!</div>
              <div className="mt-1 font-medium text-red-800">{result.mismatchReason}</div>
              <div className="mt-2 text-xs font-semibold text-red-700">
                The 2 uploaded images describe different products. Please remove one of the images or upload panels of the SAME packaged commodity.
              </div>
            </div>
          </div>
        )}

        {result?.isFallback && !result?.isMismatch && (
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-3.5 text-xs text-amber-800 ring-1 ring-amber-200">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <div className="font-bold text-amber-900">LLM Fallback Activated</div>
              <div className="mt-0.5 text-amber-700">{result.fallbackReason}</div>
              <div className="mt-1 text-[11px] font-medium text-amber-600">Primary Gemini Flash was unavailable, so structuring automatically used <b>{result.structuringSource}</b>.</div>
            </div>
          </div>
        )}

        {result && !result.isFallback && !result.isMismatch && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>AI Extraction completed via <b>{result.structuringSource}</b> ({result.fileCount || 1} panel{result.fileCount > 1 ? 's' : ''} verified as same commodity)</span>
          </div>
        )}
      </Section>

      {/* Extraction in flight: hold the shape of the summary that is coming.
          Also covers a re-extract, so section 2 never shows stale values. */}
      {busy && <ScanExtractSkeleton />}

      {/* Overview & Action Card (Visible when extraction is complete) */}
      {!busy && result && structured && (
        <Section n={2} title={result.isMismatch ? "Extraction Warning — Mismatch Detected" : "Extraction Complete — Ready to Generate Report"} desc="AI has processed and structured the label declarations." done={!result.isMismatch}>
          <div className="space-y-5">
            {/* Quick summary box */}
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Product</span>
                <div className="mt-1 font-bold text-slate-800 break-words leading-snug">{structured.product_name || structured.common_generic_name || '—'}</div>
              </div>
              <div>
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Net Quantity</span>
                <div className="mt-1 font-bold text-slate-800 break-words">{structured.net_quantity_raw || '—'}</div>
              </div>
              <div>
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">MRP</span>
                <div className="mt-1 font-bold text-slate-800 break-words">{structured.mrp_raw || '—'}</div>
              </div>
              <div>
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Manufacturer</span>
                <div className="mt-1 font-bold text-slate-800 break-words leading-snug">{structured.manufacturer_packer_importer || '—'}</div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button className="btn-outline flex items-center gap-2" onClick={() => setShowInspect(!showInspect)}>
                {showInspect ? <EyeOff size={16} /> : <Eye size={16} />}
                <span>{showInspect ? 'Hide Inspect Details' : 'Inspect Extracted Data'}</span>
                {showInspect ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              <button
                className={`btn-primary flex items-center gap-2 px-6 py-2.5 text-base shadow-sm ${result.isMismatch || generatingReport ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={runAnalyze}
                disabled={result.isMismatch || generatingReport}
                title={result.isMismatch ? 'Cannot generate report for mismatched product images' : generatingReport ? 'Saving scan and generating report...' : 'Generate compliance report'}
              >
                {generatingReport ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                <span>{generatingReport ? 'Generating Report…' : 'Generate Full Report'}</span>
                {!generatingReport && <ChevronRight size={18} />}
              </button>
            </div>

            {/* Inspect Collapsible / Tabbed Section */}
            {showInspect && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-fade space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                    <Sliders size={16} className="text-brand-600" />
                    <span>Inspect & Review Extracted Details</span>
                  </div>

                  {/* Inspect Tabs */}
                  <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs">
                    <button
                      className={`rounded-lg px-3 py-1.5 font-medium transition ${inspectTab === 'fields' ? 'bg-white font-bold text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      onClick={() => setInspectTab('fields')}>
                      Declarations Form
                    </button>
                    <button
                      className={`rounded-lg px-3 py-1.5 font-medium transition ${inspectTab === 'ocr' ? 'bg-white font-bold text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      onClick={() => setInspectTab('ocr')}>
                      Image & Raw Text
                    </button>
                    <button
                      className={`rounded-lg px-3 py-1.5 font-medium transition ${inspectTab === 'physical' ? 'bg-white font-bold text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      onClick={() => setInspectTab('physical')}>
                      Physical Parameters
                    </button>
                  </div>
                </div>

                {/* Tab 1: Form Fields */}
                {inspectTab === 'fields' && (
                  <div className="grid gap-4 sm:grid-cols-2 pt-2 animate-fade">
                    {FIELD_FORM.map(([k, label, type]) => (
                      <div key={k} className={type === 'textarea' ? 'sm:col-span-2' : ''}>
                        <label className="label">{label}</label>
                        {type === 'textarea' ? (
                          <textarea className="input min-h-[64px]" value={structured[k] ?? ''} onChange={(e) => setField(k, e.target.value)} />
                        ) : (
                          <input className="input" type={type} value={structured[k] ?? ''} onChange={(e) => setField(k, type === 'number' ? e.target.value : e.target.value)} />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 2: OCR Image & Text */}
                {inspectTab === 'ocr' && (
                  <div className="grid gap-5 lg:grid-cols-2 pt-2 animate-fade">
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <ImageIcon size={14} /> Detected Bounding Boxes ({previews.length} image{previews.length > 1 ? 's' : ''})
                      </div>
                      <div className="space-y-3">
                        {previews.map((p, i) => (
                          <div key={i} className="border border-slate-200 rounded-xl p-2 bg-slate-50">
                            <div className="text-[11px] font-bold text-slate-600 mb-1">Image {i + 1}: {files[i]?.name}</div>
                            <ImageAnnotator src={p} words={result.words.filter(w => (w.imageIndex || 1) === (i + 1))} fields={structured} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          <Type size={14} /> Combined Raw OCR Text
                        </div>
                        <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">{result.rawText || '(empty)'}</pre>
                      </div>
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          <FileJson size={14} /> Structured JSON
                        </div>
                        <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">{JSON.stringify(structured, null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 3: Physical & Legal Parameters */}
                {inspectTab === 'physical' && (
                  <div className="pt-2 animate-fade space-y-4">
                    <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                      <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Physical / Font-size Inputs (PCR 2011 · Rule 7)</div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <label className="label">Measured numeral height (mm)</label>
                          <input className="input" type="number" step="0.1" value={meta.measuredHeightMm} onChange={(e) => setMeta((m) => ({ ...m, measuredHeightMm: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">PDP area (cm²)</label>
                          <input className="input" type="number" value={meta.pdpAreaCm2} onChange={(e) => setMeta((m) => ({ ...m, pdpAreaCm2: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">Buyer type</label>
                          <select className="input" value={meta.buyer_type} onChange={(e) => setMeta((m) => ({ ...m, buyer_type: e.target.value }))}>
                            <option value="retail">Retail</option>
                            <option value="industrial_consumer">Industrial</option>
                            <option value="institutional_consumer">Institutional</option>
                          </select>
                        </div>
                        <div className="flex flex-col justify-end gap-2 pb-1">
                          <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input type="checkbox" checked={meta.molded} onChange={(e) => setMeta((m) => ({ ...m, molded: e.target.checked }))} /> Molded/embossed
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input type="checkbox" checked={meta.is_imported} onChange={(e) => setMeta((m) => ({ ...m, is_imported: e.target.checked }))} /> Imported product
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  )
}
