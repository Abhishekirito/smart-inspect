import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  ScanLine, CheckCircle2, XCircle, AlertTriangle, Gauge, TrendingUp, ArrowRight, Inbox,
} from 'lucide-react'
import { listScans } from '../lib/db.js'
import { Stat, GradeBadge, StatusBadge, EmptyState } from '../components/ui.jsx'
import { DashboardSkeleton } from '../components/Skeleton.jsx'

const STATUS_COLORS = { compliant: '#10b981', needs_review: '#f59e0b', non_compliant: '#ef4444', not_applicable: '#94a3b8' }
const FIELD_LABELS = {
  MANUFACTURER_PACKER_IMPORTER: 'Manufacturer', COMMON_GENERIC_NAME: 'Generic name',
  NET_QUANTITY: 'Net quantity', MONTH_YEAR_MFG_PACK_IMPORT: 'Mfg date',
  RETAIL_SALE_PRICE_MRP: 'MRP', CONSUMER_CARE_DETAILS: 'Consumer care',
  COUNTRY_OF_ORIGIN: 'Country of origin', DIMENSIONS_IF_RELEVANT: 'Dimensions', FONT_SIZE: 'Font size',
}

export default function Dashboard() {
  const [scans, setScans] = useState(null)
  useEffect(() => { listScans().then(setScans).catch(() => setScans([])) }, [])

  const s = useMemo(() => {
    if (!scans) return null
    const total = scans.length
    const by = { compliant: 0, needs_review: 0, non_compliant: 0, not_applicable: 0 }
    const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 }
    const violations = {}
    let scoreSum = 0, scored = 0
    for (const sc of scans) {
      by[sc.report.overall_status] = (by[sc.report.overall_status] || 0) + 1
      const gl = sc.report.grade.letter
      if (grades[gl] != null) grades[gl] += 1
      if (sc.report.grade.score != null) { scoreSum += sc.report.grade.score; scored += 1 }
      for (const f of sc.report.field_results) {
        if (f.status === 'fail') violations[f.field_id] = (violations[f.field_id] || 0) + 1
      }
    }
    const passRate = total ? Math.round(((by.compliant) / total) * 100) : 0
    const topViolations = Object.entries(violations)
      .map(([k, v]) => ({ name: FIELD_LABELS[k] || k, count: v }))
      .sort((a, b) => b.count - a.count).slice(0, 6)
    return { total, by, grades, avgScore: scored ? Math.round(scoreSum / scored) : 0, passRate, topViolations }
  }, [scans])

  if (!scans) return <DashboardSkeleton />

  if (scans.length === 0) return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-extrabold text-slate-800">Dashboard</h1>
      <EmptyState icon={Inbox} title="No scans yet">
        Run your first compliance scan to populate inspection stats, violation trends and grades.
        <div className="mt-4"><Link to="/app/scan" className="btn-primary">Scan a product</Link></div>
      </EmptyState>
    </div>
  )

  const statusData = Object.entries(s.by).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }))
  const gradeData = Object.entries(s.grades).map(([k, v]) => ({ name: k, count: v }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Enforcement Dashboard</h1>
          <p className="text-sm text-slate-400">Aggregate compliance across all scanned packaged commodities.</p>
        </div>
        <Link to="/app/scan" className="btn-primary"><ScanLine size={16} /> New scan</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={ScanLine} label="Total scans" value={s.total} color="brand" />
        <Stat icon={CheckCircle2} label="Compliant" value={s.by.compliant} color="emerald" hint={`${s.passRate}% pass rate`} />
        <Stat icon={XCircle} label="Non-compliant" value={s.by.non_compliant} color="red" />
        <Stat icon={Gauge} label="Avg score" value={s.avgScore} color="amber" hint="out of 100" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-5">
          <h3 className="mb-3 font-bold text-slate-800">Status distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}>
                {statusData.map((d) => <Cell key={d.name} fill={STATUS_COLORS[d.name]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-slate-500">
            {statusData.map((d) => (
              <span key={d.name} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[d.name] }} />
                {d.name.replace('_', ' ')} ({d.value})
              </span>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 font-bold text-slate-800">Grade distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={gradeData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#1f5ff5" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="mb-1 font-bold text-slate-800">Top violations</h3>
          <p className="mb-3 text-xs text-slate-400">Most frequently failed mandatory declarations.</p>
          {s.topViolations.length === 0 ? (
            <div className="grid h-[180px] place-items-center text-sm text-emerald-600">
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={18} /> No failures recorded</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={s.topViolations} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={96} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="font-bold text-slate-800">Recent inspections</h3>
          <Link to="/app/history" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {scans.slice(0, 6).map((sc) => (
            <Link key={sc.id} to={`/app/report/${sc.id}`} className="flex items-center gap-4 px-5 py-3 transition hover:bg-slate-50">
              <img src={sc.image} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-slate-200 object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-slate-700">{sc.productName}</div>
                <div className="text-xs text-slate-400">{new Date(sc.createdAt).toLocaleString()}</div>
              </div>
              <StatusBadge status={sc.report.overall_status} />
              <GradeBadge letter={sc.report.grade.letter} size="sm" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
