// Shape of an assistant reply: the answer itself, plus the boilerplate a model
// tends to wrap around it — an opening pleasantry ("Certainly! Here's a
// breakdown:") and a closing disclaimer ("Note: verify against the official
// Gazette notifications.").
//
// The transcript bubble shows `body` and nothing else, and Copy writes `body`,
// so a pasted reply is just the answer. `lead` and `tail` are rendered outside
// the bubble as small muted notes, so nothing the model said is lost.

const LEAD_MAX_CHARS = 240
const LEAD_MAX_TOTAL_CHARS = 480
const LEAD_MAX_CHUNKS = 2
const TAIL_MAX_CHARS = 700
const TAIL_MAX_CHUNK_CHARS = 420
const TAIL_MAX_CHUNKS = 3
const BODY_MIN_CHARS = 40

// Opening filler. Deliberately narrow: an opener is only dropped when it is a
// pleasantry, an announcement of what follows, or planning the model addressed
// to itself — never when it might carry an actual answer.
const LEAD_PATTERNS = [
  /^(certainly|sure|absolutely|of\s+course|great\s+question|good\s+question|excellent\s+question|no\s+problem|got\s+it|understood|happy\s+to\s+help|glad\s+to\s+help)\b/i,
  /^i(\s+am|'?m|'?d|'?ll|\s+will|\s+would)?\s*(be\s+)?(happy|glad|pleased|going\s+to|now)\b/i,
  /^let('?s|\s+us|\s+me)\s+(dive|get|begin|start|walk|take|break|look)\b/i,
  /^as\s+(your|the|an?)\b[^.\n]{0,80}\b(assistant|ai|co-?pilot|expert|specialist)\b/i,
  /^(here('?s|\s+is|\s+are)|below\s+(is|are)|the\s+following\s+(is|are)|what\s+follows\s+is)\b[\s\S]*:\s*$/i,
  // Chain-of-thought the model spoke out loud instead of wrapping in <think>
  /^(okay|ok|alright|right|so|hmm|well)\b[^.\n]{0,40}\b(the\s+user|i\s+(need|should|must|will|can|have)|let\s+me|we\s+(need|should))\b/i,
  /^the\s+(user|question)\s+(is\s+|has\s+)?(asking|asks|asked|wants|needs|seems)/i,
  /^i\s+(need|should|must|have)\s+to\b/i,
  /^let\s+me\s+(think|check|see|recall|structure|outline|organi[sz]e|make\s+sure)\b/i,
]

// Closing boilerplate: labelled notes, AI self-reference, "check with the
// authorities" caveats, offers of further help and sign-off commentary.
const TAIL_PATTERNS = [
  /^[^\w\n]{0,8}\**\s*(note|nb|disclaimer|important|caveat|reminder|please\s+note|legal\s+disclaimer)\b\s*\**\s*[:\-—]/i,
  /\b(as|being|i\s+am|i'?m)\s+(an?\s+)?ai\b/i,
  /\bai\s+(assistant|model|language\s+model|tool)\b/i,
  /\bthis\s+(is|does)\s+not\s+(constitute\s+)?(legal|professional)\s+advice\b/i,
  /\bnot\s+a\s+substitute\s+for\b/i,
  /\b(verify|verified|validate|cross-?check|confirm|consult|refer\s+to|check)\b[\s\S]{0,120}\b(gazette|official\s+notification|legal\s+(counsel|adviser|advisor|professional|expert)|controller\s+of\s+legal\s+metrology|department\s+of\s+legal\s+metrology|competent\s+authority)\b/i,
  /\b(let\s+me\s+know|feel\s+free|happy\s+to\s+(help|assist)|hope\s+this\s+helps|would\s+you\s+like\s+me\s+to)\b/i,
  /^(that|this)\s+(should\s+(cover|be|answer)|covers|answers|wraps|is\s+everything)\b/i,
  /\bi'?(ve|\s+have)\s+(covered|listed|included|structured|outlined|kept)\b/i,
]

const FENCE = /^```/
const HEADING = /^#{1,6}\s/
const RULE = /^([-*_])\1{2,}\s*$/
const LIST = /^([-*+]\s|\d+[.)]\s)/

function kindOf(line) {
  if (FENCE.test(line)) return 'fence'
  if (HEADING.test(line)) return 'heading'
  if (RULE.test(line)) return 'rule'
  if (line.startsWith('|')) return 'table'
  if (line.startsWith('>')) return 'quote'
  if (LIST.test(line)) return 'list'
  return 'para'
}

// Groups the reply into blank-line separated chunks, recording each one's slice
// of the source so the body can be cut out of the original text rather than
// re-serialised. Headings and horizontal rules always stand alone, so a filler
// paragraph tucked directly under a heading is still visible as its own chunk.
function chunkify(src) {
  const chunks = []
  let current = null
  let inFence = false
  let offset = 0

  const close = () => {
    if (current) chunks.push(current)
    current = null
  }

  for (const line of src.split('\n')) {
    const start = offset
    const end = start + line.length
    offset = end + 1
    const trimmed = line.trim()

    if (inFence) {
      current.end = end
      if (FENCE.test(trimmed)) {
        inFence = false
        close()
      }
      continue
    }

    if (!trimmed) {
      close()
      continue
    }

    const kind = kindOf(trimmed)

    if (kind === 'fence') {
      close()
      current = { kind, start, end }
      inFence = true
    } else if (kind === 'heading' || kind === 'rule') {
      close()
      chunks.push({ kind, start, end })
    } else if (!current || current.kind !== kind) {
      close()
      current = { kind, start, end }
    } else {
      current.end = end
    }
  }

  close()
  return chunks
}

const matchesAny = (patterns, text) => patterns.some((re) => re.test(text))

/**
 * Splits a reply into `{ lead, body, tail }`.
 *
 * Only plain paragraphs are ever treated as boilerplate — headings, lists,
 * tables, blockquotes and code blocks stay in the body, so a drafted legal
 * notice or a font-size table is never clipped. If the split would leave
 * nothing meaningful behind, the whole reply is returned as the body.
 */
export function splitReply(content) {
  const src = String(content ?? '').replace(/\r\n/g, '\n')
  const whole = { lead: '', body: src, tail: '' }
  if (!src.trim()) return whole

  const chunks = chunkify(src)
  if (chunks.length < 2) return whole

  // Walk back from the end for as long as the trailing paragraphs read like
  // boilerplate, swallowing a `---` separator once a note has been found.
  let end = chunks.length
  let tailStart = -1
  let tailChars = 0
  let taken = 0

  while (end > 0) {
    const chunk = chunks[end - 1]

    if (chunk.kind === 'rule') {
      if (!taken) break
      tailStart = chunk.start
      end -= 1
      continue
    }

    if (chunk.kind !== 'para' || taken >= TAIL_MAX_CHUNKS) break

    const text = src.slice(chunk.start, chunk.end).trim()
    if (text.length > TAIL_MAX_CHUNK_CHARS) break
    if (tailChars + text.length > TAIL_MAX_CHARS) break
    if (!matchesAny(TAIL_PATTERNS, text)) break

    tailStart = chunk.start
    tailChars += text.length
    taken += 1
    end -= 1
  }

  const bodyEnd = taken ? tailStart : src.length

  // The opener is the run of filler paragraphs at the top, looking past a
  // leading heading or two — never the last chunk, since that would empty the
  // bubble. A heading ends the run: that is where the answer starts.
  let leadStart = -1
  let leadEnd = -1
  let leadChars = 0
  let leadTaken = 0
  let skipped = 0

  for (let i = 0; i < end; i += 1) {
    const chunk = chunks[i]

    if (chunk.kind === 'heading' || chunk.kind === 'rule') {
      if (leadTaken || skipped >= 2) break
      skipped += 1
      continue
    }

    if (chunk.kind !== 'para' || i === end - 1 || leadTaken >= LEAD_MAX_CHUNKS) break

    const text = src.slice(chunk.start, chunk.end).trim()
    if (text.length > LEAD_MAX_CHARS || leadChars + text.length > LEAD_MAX_TOTAL_CHARS) break
    if (!matchesAny(LEAD_PATTERNS, text)) break

    if (leadStart === -1) leadStart = chunk.start
    leadEnd = chunk.end
    leadChars += text.length
    leadTaken += 1
  }

  let body
  if (leadTaken) {
    const head = src.slice(0, leadStart).trimEnd()
    const rest = src.slice(leadEnd, bodyEnd).replace(/^\s+/, '')
    body = (head ? `${head}\n${rest}` : rest).trim()
    // Dropping the opener must not gut the bubble; keep it if it does.
    if (body.length < BODY_MIN_CHARS) {
      leadTaken = 0
      body = src.slice(0, bodyEnd).trim()
    }
  } else {
    body = src.slice(0, bodyEnd).trim()
  }

  if (body.length < BODY_MIN_CHARS) return whole

  return {
    lead: leadTaken ? src.slice(leadStart, leadEnd).trim() : '',
    body,
    tail: taken ? src.slice(tailStart).trim() : '',
  }
}

/**
 * Flattens a boilerplate fragment to one quiet line of prose: markdown markers,
 * separators and line breaks removed. Used for the small notes that sit outside
 * the reply bubble, which should never compete with the answer itself.
 */
export function plainNote(text) {
  return String(text ?? '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^([-*_])\1{2,}\s*$/gm, '')
    .replace(/[*`_~]+/g, '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
