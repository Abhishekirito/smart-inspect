import { statusMeta } from '../lib/grading.js'
import { CheckCircle2, XCircle, AlertTriangle, MinusCircle, HelpCircle } from 'lucide-react'

const COLOR = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  lime: 'bg-lime-50 text-lime-700 ring-lime-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
}

export function Chip({ color = 'slate', children, className = '' }) {
  return <span className={`chip ring-1 ring-inset ${COLOR[color]} ${className}`}>{children}</span>
}

const FIELD_ICON = {
  pass: <CheckCircle2 size={16} className="text-emerald-600" />,
  fail: <XCircle size={16} className="text-red-600" />,
  warning: <AlertTriangle size={16} className="text-amber-600" />,
  not_applicable: <MinusCircle size={16} className="text-slate-400" />,
  not_measured: <HelpCircle size={16} className="text-slate-400" />,
}
export const FieldIcon = ({ status }) => FIELD_ICON[status] || FIELD_ICON.not_measured

export function StatusBadge({ status }) {
  const m = statusMeta[status] || { label: status, color: 'slate' }
  return <Chip color={m.color}>{m.label}</Chip>
}

const FIELD_COLOR = {
  pass: 'emerald', fail: 'red', warning: 'amber',
  not_applicable: 'slate', not_measured: 'slate',
}
export function FieldStatus({ status }) {
  const label = { pass: 'Pass', fail: 'Fail', warning: 'Warning', not_applicable: 'N/A', not_measured: 'Not measured' }[status] || status
  return <Chip color={FIELD_COLOR[status] || 'slate'}><FieldIcon status={status} />{label}</Chip>
}

export function GradeBadge({ letter, size = 'md' }) {
  const c = { A: 'bg-emerald-500', B: 'bg-lime-500', C: 'bg-amber-500', D: 'bg-orange-500', F: 'bg-red-500', 'N/A': 'bg-slate-400' }[letter] || 'bg-slate-400'
  const dim = size === 'lg' ? 'h-20 w-20 text-4xl' : size === 'sm' ? 'h-9 w-9 text-lg' : 'h-14 w-14 text-2xl'
  return (
    <div className={`grid place-items-center rounded-2xl font-extrabold text-white shadow ${c} ${dim}`}>
      {letter}
    </div>
  )
}

export function Stat({ icon: Icon, label, value, color = 'brand', hint }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ring-1 ring-inset ${COLOR[color]}`}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-2 text-3xl font-extrabold text-slate-800">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="card grid place-items-center px-6 py-16 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon size={26} />
      </div>
      <h3 className="text-base font-bold text-slate-700">{title}</h3>
      <div className="mt-1 max-w-sm text-sm text-slate-400">{children}</div>
    </div>
  )
}
