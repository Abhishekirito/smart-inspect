import { useRef, useState } from 'react'

// Overlays OCR word bounding boxes on the uploaded label image.
// `words` are pixel boxes {text,x,y,w,h} relative to the natural image size.
// `fields` is the structured object used to colour-code key declarations.

const FIELD_DEFS = [
  { key: 'mrp', label: 'MRP', color: '#e11d48', src: (f) => f?.mrp_raw },
  { key: 'qty', label: 'Net Qty', color: '#2563eb', src: (f) => f?.net_quantity_raw },
  { key: 'mfg', label: 'Manufacturer', color: '#7c3aed', src: (f) => f?.manufacturer_packer_importer },
  { key: 'date', label: 'Mfg Date', color: '#d97706', src: (f) => f?.mfg_date_raw },
  { key: 'care', label: 'Consumer Care', color: '#0d9488', src: (f) => f?.consumer_care_raw },
]

function classify(text, fields) {
  const t = (text || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (t.length < 2) return null
  for (const d of FIELD_DEFS) {
    const raw = (d.src(fields) || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    if (raw && raw.includes(t)) return d
  }
  return null
}

export default function ImageAnnotator({ src, words = [], fields }) {
  const imgRef = useRef(null)
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [showText, setShowText] = useState(true)
  const [showFields, setShowFields] = useState(true)

  const onLoad = (e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })
  const pct = (v, total) => (total ? (v / total) * 100 : 0)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <button onClick={() => setShowText((s) => !s)}
          className={`chip ring-1 ring-inset ${showText ? 'bg-slate-800 text-white ring-slate-800' : 'bg-white text-slate-500 ring-slate-300'}`}>
          Text boxes ({words.length})
        </button>
        <button onClick={() => setShowFields((s) => !s)}
          className={`chip ring-1 ring-inset ${showFields ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-500 ring-slate-300'}`}>
          Key fields
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          {FIELD_DEFS.map((d) => (
            <span key={d.key} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span className="h-3 w-3 rounded" style={{ background: d.color }} /> {d.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative inline-block max-w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 print:border-none print:bg-transparent">
        <img ref={imgRef} src={src} onLoad={onLoad} alt="scanned label" className="block max-h-[560px] print:max-h-[220px] w-auto max-w-full object-contain print:mx-auto" />
        {nat.w > 0 && words.map((w, i) => {
          const field = classify(w.text, fields)
          if (field && !showFields) return null
          if (!field && !showText) return null
          const color = field ? field.color : '#334155'

          // Check if OCR engine dimensions were orientation-swapped relative to browser EXIF rendering
          const isSwapped = w.pageWidth && w.pageHeight && nat.w && nat.h &&
            (Math.abs(w.pageWidth - nat.h) < Math.abs(w.pageWidth - nat.w))

          let leftPct, topPct, widthPct, heightPct
          if (isSwapped) {
            // 90-degree CW rotation correction for mobile photos
            leftPct = (w.y / w.pageHeight) * 100
            topPct = ((w.pageWidth - w.x - w.w) / w.pageWidth) * 100
            widthPct = (w.h / w.pageHeight) * 100
            heightPct = (w.w / w.pageWidth) * 100
          } else if (w.leftPct != null && w.topPct != null) {
            leftPct = w.leftPct
            topPct = w.topPct
            widthPct = w.widthPct
            heightPct = w.heightPct
          } else {
            leftPct = pct(w.x, nat.w)
            topPct = pct(w.y, nat.h)
            widthPct = pct(w.w, nat.w)
            heightPct = pct(w.h, nat.h)
          }

          return (
            <div key={i} title={w.text}
              className="absolute rounded-[2px] transition pointer-events-none print:hidden"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                border: `1.5px solid ${color}`,
                background: field ? color + '22' : '#33415511',
                boxShadow: field ? `0 0 0 1px ${color}55` : 'none',
              }}
            />
          )
        })}
      </div>
      {words.length === 0 && (
        <p className="mt-3 text-xs text-slate-400">
          No word-level boxes returned by this provider. Bounding boxes are available when the OCR.space engine is used.
        </p>
      )}
    </div>
  )
}
