import { useState, useRef, useEffect, useMemo } from 'react'
import { Brain, ChevronDown, ShieldCheck, Bot, User, Copy, Check, AlertTriangle } from 'lucide-react'
import { splitReply, plainNote } from '../lib/replyShape.js'
import { ReplySkeleton } from './Skeleton.jsx'

// Shared chat rendering primitives used by both the floating ChatWidget and the
// full-page Assistant workspace, so both surfaces stay visually consistent.
//
// Layout rule: the response bubble contains the answer and nothing else — no
// reasoning, no "Certainly, here's a breakdown" opener, no trailing "verify
// against the Gazette" disclaimer, no status, notice, timestamp or copy control.
// All of those are siblings of the bubble, so selecting it — or pressing Copy —
// yields only the answer text.

const INLINE_SPLIT = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g

export function formatInlineMarkdown(text) {
  if (text === undefined || text === null) return null
  return String(text)
    .split(INLINE_SPLIT)
    .map((part, i) => {
      if (!part) return null
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.92em] font-semibold text-brand-700">
            {part.slice(1, -1)}
          </code>
        )
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} className="italic text-slate-600">{part.slice(1, -1)}</em>
      }
      return part
    })
}

function splitTableRow(line) {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
}

const TABLE_DIVIDER = /^\|?[\s:|-]+\|[\s:|-]*$/

// Groups raw markdown text into renderable blocks. Multi-line constructs (code
// fences, tables, blockquotes) need this — a per-line pass cannot handle them.
function parseBlocks(content) {
  const lines = content.split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const raw = lines[i]
    const trimmed = raw.trim()

    // Fenced code block (may be unterminated while still streaming)
    if (trimmed.startsWith('```')) {
      const code = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i])
        i += 1
      }
      i += 1
      blocks.push({ type: 'code', text: code.join('\n') })
      continue
    }

    // Markdown table: header row followed by a |---|---| divider
    const next = lines[i + 1]?.trim()
    if (trimmed.startsWith('|') && next && next.includes('-') && TABLE_DIVIDER.test(next)) {
      const header = splitTableRow(trimmed)
      i += 2
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitTableRow(lines[i].trim()))
        i += 1
      }
      blocks.push({ type: 'table', header, rows })
      continue
    }

    // Consecutive blockquote lines collapse into one notice box
    if (trimmed.startsWith('>')) {
      const quote = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''))
        i += 1
      }
      blocks.push({ type: 'quote', text: quote.join('\n') })
      continue
    }

    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
      i += 1
      continue
    }

    blocks.push({ type: 'line', text: trimmed })
    i += 1
  }

  return blocks
}

export function RenderMarkdown({ content, compact = false }) {
  if (!content) return null
  const blocks = parseBlocks(content)

  return (
    <div className={`text-slate-700 ${compact ? 'space-y-2 text-sm leading-relaxed' : 'space-y-2.5 text-sm leading-relaxed'}`}>
      {blocks.map((block, idx) => {
        if (block.type === 'code') {
          return (
            <pre
              key={idx}
              className="my-2 overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100"
            >
              {block.text}
            </pre>
          )
        }

        if (block.type === 'table') {
          return (
            <div key={idx} className="my-2.5 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {block.header.map((h, hi) => (
                      <th key={hi} className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-bold text-slate-700">
                        {formatInlineMarkdown(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, ri) => (
                    <tr key={ri} className="even:bg-slate-50/60">
                      {row.map((cell, ci) => (
                        <td key={ci} className="border-b border-slate-100 px-3 py-2 align-top text-slate-600 last:border-r-0">
                          {formatInlineMarkdown(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={idx}
              className="my-2.5 whitespace-pre-wrap rounded-xl border-l-4 border-brand-500 bg-brand-50/70 p-3 font-mono text-xs leading-relaxed text-brand-950 shadow-sm"
            >
              {block.text}
            </blockquote>
          )
        }

        if (block.type === 'hr') {
          return <hr key={idx} className="my-3 border-slate-200" />
        }

        const trimmed = block.text
        if (!trimmed) return <div key={idx} className="h-1" />

        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={idx}
              className={`flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-brand-700 ${compact ? 'mb-1 mt-3' : 'mb-2 mt-4'}`}
            >
              <ShieldCheck size={14} className="shrink-0 text-brand-600" />
              {trimmed.slice(4)}
            </h4>
          )
        }

        if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          return (
            <h3
              key={idx}
              className={
                compact
                  ? 'mb-1.5 mt-3 text-sm font-bold text-slate-900'
                  : 'mb-2 mt-4 border-b border-slate-100 pb-1 text-base font-bold text-slate-900'
              }
            >
              {trimmed.replace(/^#+\s*/, '')}
            </h3>
          )
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              <span className="min-w-0">{formatInlineMarkdown(trimmed.slice(2))}</span>
            </div>
          )
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="mt-0.5 text-xs font-semibold text-brand-600">{numMatch[1]}.</span>
              <span className="min-w-0">{formatInlineMarkdown(numMatch[2])}</span>
            </div>
          )
        }

        return <p key={idx} className="break-words">{formatInlineMarkdown(trimmed)}</p>
      })}
    </div>
  )
}

/**
 * Collapsible disclosure for a reasoning model's chain-of-thought.
 * Collapsed by default so the visible answer stays clean; the user can open it
 * to inspect how the model arrived at the response. Rendered outside the reply
 * bubble so it never lands in a copy of the reply.
 */
function ReasoningPanel({ text, isActive = false, compact = false }) {
  const [open, setOpen] = useState(false)
  if (!text || !text.trim()) return null

  const words = text.trim().split(/\s+/).length

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition hover:bg-slate-100"
      >
        <Brain size={compact ? 12 : 14} className={`shrink-0 ${isActive ? 'animate-pulse text-brand-600' : 'text-slate-400'}`} />
        <span className={`min-w-0 flex-1 truncate font-semibold ${compact ? 'text-[11px]' : 'text-xs'} ${isActive ? 'text-brand-700' : 'text-slate-500'}`}>
          {isActive ? 'Thinking…' : `Reasoning · ${words} word${words === 1 ? '' : 's'}`}
        </span>
        <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:inline">
          {open ? 'Hide' : 'Show'}
        </span>
        <ChevronDown size={compact ? 12 : 14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="max-h-56 overflow-y-auto border-t border-slate-200 bg-slate-50/70 px-3 py-2.5">
          <p className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-500">
            {text.trim()}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Copies one reply. Bound to the raw message text rather than to the rendered
 * DOM, so the clipboard never picks up the timestamp, the reasoning panel or
 * this button's own label.
 */
function CopyReplyButton({ text, compact = false }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (e) {
      return // Clipboard blocked (insecure context / denied permission)
    }
    setCopied(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), 2000)
  }

  const iconSize = compact ? 12 : 14

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy the response text"
      className="flex shrink-0 items-center gap-1.5 font-medium transition hover:text-slate-700"
    >
      {copied ? (
        <>
          <Check size={iconSize} className="text-emerald-600" />
          <span className="font-bold text-emerald-600">Copied</span>
        </>
      ) : (
        <>
          <Copy size={iconSize} />
          <span>{compact ? 'Copy' : 'Copy response'}</span>
        </>
      )}
    </button>
  )
}

/**
 * One line of quiet prose for the boilerplate a model wraps around its answer.
 * Deliberately small and low-contrast: it sits outside the bubble, is never part
 * of a copied reply, and must not compete with the answer for attention.
 */
function AsideNote({ text, compact = false }) {
  const flat = plainNote(text)
  if (!flat) return null

  return (
    <p className={`px-1 italic leading-snug text-slate-400 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
      {flat}
    </p>
  )
}

/**
 * One turn in the transcript: the avatar plus a column holding the reply bubble
 * and its siblings — reasoning disclosure, opener/disclaimer asides, stream
 * status, service notice and the timestamp/copy row. Only the answer itself goes
 * inside the bubble.
 *
 * `message` is `{ role, content, reasoning?, notice?, timestamp }`.
 */
export function ChatTurn({ message, isStreaming = false, compact = false }) {
  const isUser = message.role === 'user'
  const Avatar = isUser ? User : Bot

  // A user's own words are never reshaped; only model replies carry boilerplate.
  const { lead, body, tail } = useMemo(
    () => (isUser ? { lead: '', body: message.content, tail: '' } : splitReply(message.content)),
    [isUser, message.content],
  )

  const waiting = !isUser && !message.content && isStreaming

  const status = message.reasoning
    ? (compact ? 'Reasoning…' : 'Reasoning through the rules…')
    : (compact ? 'Connecting…' : 'Connecting to Groq LLM…')

  const avatarClass = `grid shrink-0 place-items-center rounded-xl shadow-sm ${
    compact ? 'h-8 w-8' : 'h-9 w-9'
  } ${isUser ? 'bg-slate-200 text-slate-700' : 'bg-brand-600 text-white'}`

  const bubbleClass = `min-w-0 max-w-full rounded-2xl text-sm shadow-sm ${
    compact ? 'px-3.5 py-3 sm:px-4' : 'p-4 sm:p-5'
  } ${
    isUser
      ? 'rounded-tr-none bg-slate-900 font-medium text-white'
      : 'rounded-tl-none border border-slate-200 bg-white text-slate-800'
  }`

  return (
    <div
      className={`flex ${compact ? 'gap-2 sm:gap-2.5' : 'gap-2.5 sm:gap-4'} ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isUser && (
        <div className={avatarClass}>
          <Avatar size={compact ? 16 : 18} />
        </div>
      )}
      {/* Bubble + chrome share this column so the chrome stays outside the bubble */}
      <div
        className={`flex min-w-0 flex-col gap-1.5 sm:max-w-[85%] ${
          compact ? 'max-w-[calc(100%-2.75rem)]' : 'max-w-[calc(100%-3rem)]'
        } ${isUser ? 'items-end' : 'items-start'}`}
      >
        {!isUser && <ReasoningPanel text={message.reasoning} isActive={waiting} compact={compact} />}

        {!isUser && <AsideNote text={lead} compact={compact} />}

        {body && (
          <div className={bubbleClass}>
            {isUser ? (
              <p className="whitespace-pre-wrap break-words leading-relaxed">{body}</p>
            ) : (
              <RenderMarkdown content={body} compact={compact} />
            )}
          </div>
        )}

        {!isUser && <AsideNote text={tail} compact={compact} />}

        {waiting && (
          <>
            <ReplySkeleton compact={compact} />
            <div className="flex items-center gap-2 px-0.5 text-xs font-medium text-brand-700">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-brand-600" />
              <span className="italic">{status}</span>
            </div>
          </>
        )}

        {message.notice && (
          <div
            className={`flex w-full items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 ${
              compact ? 'text-[11px]' : 'text-xs'
            } leading-relaxed text-amber-900`}
          >
            <AlertTriangle size={compact ? 12 : 14} className="mt-0.5 shrink-0 text-amber-600" />
            <span className="min-w-0">{message.notice}</span>
          </div>
        )}

        {(message.content || message.notice) && (
          <div className={`flex items-center gap-3 px-0.5 ${compact ? 'text-[10px]' : 'text-xs'} text-slate-400`}>
            <span>{message.timestamp}</span>
            {/* Bound to the bubble's text, so a copy is the answer alone */}
            {body && !isUser && <CopyReplyButton text={body} compact={compact} />}
          </div>
        )}
      </div>

      {isUser && (
        <div className={avatarClass}>
          <Avatar size={compact ? 16 : 18} />
        </div>
      )}
    </div>
  )
}
