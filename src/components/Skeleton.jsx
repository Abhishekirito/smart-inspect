// Skeleton placeholders shown while a screen's data is in flight.
//
// Each one mirrors the real layout it stands in for — same card chrome, same
// grid, same block sizes — so the page does not jump when the data lands. The
// shimmer itself is the `.skeleton` class in index.css, which also stops the
// sweep under `prefers-reduced-motion`.
//
// Accessibility: the wrapper carries `role="status"` and one screen-reader
// sentence; every tile inside is decorative and hidden from assistive tech.

/** A single placeholder tile. Size, radius and margins come from `className`. */
export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />
}

/** Wrapper that announces the wait once, instead of one label per tile. */
export function SkeletonScreen({ label, className = '', children }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      {children}
      {/* Last child on purpose: as the first, `space-y-*` on the wrapper would
          hand the topmost tile a margin the real layout does not have. */}
      <span className="sr-only">{label}</span>
    </div>
  )
}

/** Stack of text lines; the last one is short, the way a wrapped line ends. */
export function SkeletonLines({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/5' : i % 2 ? 'w-11/12' : 'w-full'}`} />
      ))}
    </div>
  )
}

/** Page title plus its one-line description, with an optional action button. */
function HeadingSkeleton({ action = false, wide = 'w-64' }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className={`h-7 ${wide} max-w-full`} />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {action && <Skeleton className="h-10 w-32 rounded-xl" />}
    </div>
  )
}

/** Mirrors <Stat> from ui.jsx: label, icon tile, big number, hint. */
function StatSkeleton() {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="mt-3 h-8 w-16" />
      <Skeleton className="mt-2 h-3 w-24" />
    </div>
  )
}

const BAR_HEIGHTS = ['h-[35%]', 'h-[68%]', 'h-[52%]', 'h-[86%]', 'h-[24%]']
const ROW_WIDTHS = ['w-[86%]', 'w-[64%]', 'w-[52%]', 'w-[38%]', 'w-[24%]', 'w-[16%]']

/** A charting card: heading, then a stand-in for the recharts canvas. */
function ChartCardSkeleton({ variant, subtitle = false }) {
  return (
    <div className="card p-5">
      <Skeleton className="h-5 w-40" />
      {subtitle && <Skeleton className="mt-2 h-3 w-52 max-w-full" />}

      {variant === 'donut' && (
        <>
          <div className="grid h-[220px] place-items-center">
            <Skeleton className="h-40 w-40 rounded-full" />
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-3 w-20" />)}
          </div>
        </>
      )}

      {variant === 'bars' && (
        <div className="mt-4 flex h-[204px] items-end gap-3 border-b border-slate-100 px-1">
          {BAR_HEIGHTS.map((h) => <Skeleton key={h} className={`w-full rounded-b-none rounded-t-md ${h}`} />)}
        </div>
      )}

      {variant === 'rows' && (
        <div className="mt-4 space-y-3">
          {ROW_WIDTHS.map((w) => (
            <div key={w} className="flex items-center gap-2">
              <Skeleton className="h-3 w-20 shrink-0" />
              <Skeleton className={`h-4 rounded-l-none rounded-r-md ${w}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Stand-in for the enforcement dashboard: stats, three charts, recent list. */
export function DashboardSkeleton() {
  return (
    <SkeletonScreen label="Loading dashboard…" className="space-y-6">
      <HeadingSkeleton action wide="w-72" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <StatSkeleton key={i} />)}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCardSkeleton variant="donut" />
        <ChartCardSkeleton variant="bars" />
        <ChartCardSkeleton variant="rows" subtitle />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="divide-y divide-slate-100">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="hidden h-6 w-24 rounded-full sm:block" />
              <Skeleton className="h-9 w-9 shrink-0 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonScreen>
  )
}

/** Stand-in for the history grid: search/filter bar plus scan cards. */
export function HistorySkeleton({ cards = 6 }) {
  return (
    <SkeletonScreen label="Loading inspection history…" className="min-w-0 space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-60 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>

      <div className="card flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <Skeleton className="h-10 min-w-0 flex-1 rounded-xl" />
        <div className="flex flex-wrap items-center gap-1.5">
          {['w-10', 'w-24', 'w-28', 'w-28', 'w-12'].map((w) => (
            <Skeleton key={w} className={`h-7 rounded-full ${w}`} />
          ))}
        </div>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="card flex min-w-0 items-start gap-3 p-3">
            <Skeleton className="h-16 w-16 shrink-0 rounded-lg sm:h-20 sm:w-20" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
                <Skeleton className="h-9 w-9 shrink-0 rounded-2xl" />
              </div>
              <Skeleton className="h-3 w-24" />
              <div className="flex items-center gap-2 pt-1">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </SkeletonScreen>
  )
}

/** Stand-in for a compliance report: verdict card, checklist, evidence. */
export function ReportSkeleton({ rows = 6 }) {
  return (
    <SkeletonScreen label="Loading compliance report…" className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-6 w-48" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Verdict card: grade, status chips, product name, score */}
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-5 border-b border-slate-100 p-6 sm:flex-row sm:items-center">
          <Skeleton className="h-20 w-20 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="space-y-2 sm:text-center">
            <Skeleton className="h-10 w-20 sm:mx-auto" />
            <Skeleton className="h-3 w-24 sm:mx-auto" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-4 w-28 max-w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Applicability banner + mandatory declaration checklist */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 bg-brand-50/50 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-56 max-w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        </div>
        <div className="space-y-2 border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
          <Skeleton className="h-5 w-64 max-w-full" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="grid gap-3 px-5 py-3 sm:grid-cols-12 sm:items-start">
              <div className="space-y-1.5 pr-3 sm:col-span-4">
                <Skeleton className="h-3.5 w-32 max-w-full" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="min-w-0 space-y-1.5 sm:col-span-6">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3 w-2/5" />
              </div>
              <div className="flex sm:col-span-2 sm:justify-end">
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Font size analysis */}
      <div className="card p-5">
        <Skeleton className="h-5 w-56 max-w-full" />
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Photographic evidence + structured JSON */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <Skeleton className="h-5 w-52 max-w-full" />
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <Skeleton className="mx-auto mb-2 h-3 w-24" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
        <div className="card p-5">
          <Skeleton className="h-5 w-56 max-w-full" />
          <div className="mt-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <SkeletonLines lines={9} />
          </div>
        </div>
      </div>

      <div className="grid place-items-center pb-6">
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>
    </SkeletonScreen>
  )
}

/**
 * Whole-app placeholder for the moment before the auth session resolves, when
 * neither the sidebar nor the page it frames has rendered yet. Mirrors
 * AppLayout: fixed sidebar from `lg`, sticky header, padded main.
 */
export function AppShellSkeleton() {
  return (
    <SkeletonScreen label="Loading your workspace…" className="flex h-full">
      <div className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex">
        <div className="flex items-center gap-3 px-2 pb-6">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <div className="space-y-1">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11 w-full rounded-xl" />)}
        </div>
        <div className="mt-8 rounded-xl bg-slate-50 p-3">
          <SkeletonLines lines={3} />
        </div>
        <div className="mt-auto border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2.5 px-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          <Skeleton className="mt-3 h-9 w-full rounded-xl" />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 lg:px-8">
          <Skeleton className="h-9 w-9 rounded-xl lg:hidden" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-9 w-32 rounded-xl" />
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="space-y-6">
            <HeadingSkeleton />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <StatSkeleton key={i} />)}
            </div>
            <div className="card p-5"><SkeletonLines lines={6} /></div>
          </div>
        </main>
      </div>
    </SkeletonScreen>
  )
}

/**
 * Placeholder for the "Extraction Complete" step while OCR and structuring are
 * still running, so the page holds the shape of the summary that is coming
 * instead of jumping when it lands.
 */
export function ScanExtractSkeleton() {
  return (
    <SkeletonScreen label="Extracting declarations from the label…" className="card animate-fade p-5 lg:p-6">
      <div className="mb-4 flex items-start gap-3">
        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {['Product', 'Net quantity', 'MRP', 'Manufacturer'].map((k) => (
          <div key={k} className="space-y-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-11 w-56 rounded-xl" />
      </div>
    </SkeletonScreen>
  )
}

/**
 * Placeholder for a reply that has been requested but has not streamed its
 * first token yet. Shaped like the assistant bubble it will be replaced by, and
 * deliberately empty of text — the status line beside it does the talking, and
 * nothing here can end up in a copied reply.
 */
export function ReplySkeleton({ compact = false }) {
  return (
    <div
      aria-hidden="true"
      className={`w-full rounded-2xl rounded-tl-none border border-slate-200 bg-white shadow-sm ${
        compact ? 'px-3.5 py-3 sm:px-4' : 'p-4 sm:p-5'
      }`}
    >
      <SkeletonLines lines={compact ? 2 : 3} />
    </div>
  )
}

/**
 * The app shell's very first frame, before the auth session has resolved and
 * before it is known whether the intro, the login form or the dashboard comes
 * next. Deliberately says nothing about the destination.
 */
export function AppLaunchSkeleton() {
  return (
    <SkeletonScreen
      label="Starting Smart Inspect…"
      className="grid min-h-full place-items-center bg-gradient-to-b from-white to-slate-50 px-6"
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-2xl" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
    </SkeletonScreen>
  )
}

/**
 * Placeholder for a centred auth card — used while a password-recovery link is
 * still being exchanged for a session, where the card itself is the whole page.
 */
export function AuthCardSkeleton({ fields = 2 }) {
  return (
    <SkeletonScreen
      label="Checking your reset link…"
      className="grid min-h-full place-items-center bg-gradient-to-b from-white to-slate-50 px-4 py-10"
    >
      <div className="card w-full max-w-md p-7 shadow-md">
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-44 max-w-full" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: fields }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ))}
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </SkeletonScreen>
  )
}
