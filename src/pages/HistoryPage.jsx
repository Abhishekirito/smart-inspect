import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Trash2, History as HistoryIcon, Filter } from 'lucide-react'
import { listScans, deleteScan } from '../lib/db.js'
import { StatusBadge, GradeBadge, EmptyState, Chip } from '../components/ui.jsx'
import { HistorySkeleton } from '../components/Skeleton.jsx'

const FILTERS = [
  ['all', 'All'], ['compliant', 'Compliant'], ['needs_review', 'Needs review'],
  ['non_compliant', 'Non-compliant'], ['not_applicable', 'N/A'],
]

export default function HistoryPage() {
  const [scans, setScans] = useState(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')

  const refresh = () => listScans().then(setScans).catch(() => setScans([]))
  useEffect(() => { refresh() }, [])

  const filtered = useMemo(() => {
    if (!scans) return []
    return scans.filter((s) => {
      if (filter !== 'all' && s.report.overall_status !== filter) return false
      if (q && !(`${s.productName} ${s.structured?.manufacturer_packer_importer || ''}`.toLowerCase().includes(q.toLowerCase()))) return false
      return true
    })
  }, [scans, q, filter])

  const remove = async (id, e) => {
    e.preventDefault(); e.stopPropagation()
    if (!confirm('Delete this scan permanently?')) return
    await deleteScan(id)
    refresh()
  }

  if (!scans) return <HistorySkeleton />

  return (
    <div className="space-y-5 min-w-0">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">Inspection History</h1>
        <p className="text-sm text-slate-400">{scans.length} scan{scans.length !== 1 ? 's' : ''} synced to your account.</p>
      </div>

      {scans.length === 0 ? (
        <EmptyState icon={HistoryIcon} title="No history yet">
          Scans you run will appear here with their grade and status.
          <div className="mt-4"><Link to="/app/scan" className="btn-primary">Run a scan</Link></div>
        </EmptyState>
      ) : (
        <>
          <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9 text-xs sm:text-sm" placeholder="Search product or manufacturer…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <Filter size={15} className="text-slate-400 shrink-0" />
              {FILTERS.map(([k, label]) => (
                <button key={k} onClick={() => setFilter(k)}
                  className={`chip ring-1 ring-inset text-xs whitespace-nowrap ${filter === k ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-500 ring-slate-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 min-w-0">
            {filtered.map((s) => (
              <Link key={s.id} to={`/app/report/${s.id}`} className="card group relative flex items-start gap-3 p-3 transition hover:shadow-md min-w-0 overflow-hidden">
                {s.image ? (
                  <img src={s.image} alt="" className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-lg border border-slate-200 object-cover" />
                ) : (
                  <div className="grid h-16 w-16 sm:h-20 sm:w-20 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-100 text-slate-400">
                    <HistoryIcon size={22} />
                  </div>
                )}
                <div className="min-w-0 flex-1 pr-5">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="font-bold text-slate-800 text-xs sm:text-sm leading-snug break-words" title={s.productName}>
                      {s.productName}
                    </div>
                    <div className="shrink-0">
                      <GradeBadge letter={s.report?.grade?.letter || 'N/A'} size="sm" />
                    </div>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400 break-words">{s.structured?.net_quantity_raw || '—'}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={s.report?.overall_status} />
                    <span className="text-[11px] text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button onClick={(e) => remove(s.id, e)} title="Delete"
                  className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100">
                  <Trash2 size={14} />
                </button>
              </Link>
            ))}
          </div>
          {filtered.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No scans match your filter.</p>}
        </>
      )}
    </div>
  )
}
