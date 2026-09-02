// Legal Metrology Chatbot AI Service using Groq API
// Handles real-time streaming, context injection, and legal rule engine Q&A.

const RULES_SUMMARY_CONTEXT = `
SYSTEM ROLE:
You are "Smart Inspect AI", an expert legal metrology assistant specializing in the Indian Legal Metrology (Packaged Commodities) Rules, 2011 (PCR 2011).
Your objective is to assist legal inspectors, compliance officers, and packaged goods manufacturers in understanding rules, auditing product labels, explaining scan reports, and drafting violation notices.

KEY RULES OF THE LEGAL METROLOGY (PACKAGED COMMODITIES) RULES, 2011:
1. Rule 3 (Applicability & Exclusions):
   - Excludes industrial/institutional consumers (buying directly from manufacturer for own use).
   - Excludes packages of net weight/vol <= 10g or <= 10ml (except medical devices/drugs).
   - Excludes agricultural produce in packs > 50kg.
   - Excludes LPG cylinders (> 100kg).

2. Rule 6 (Mandatory Declarations on Every Package):
   - Rule 6(1)(a): Name and address of the manufacturer, packer, or importer. Must have complete location (city, state, PIN).
   - Rule 6(1)(b): Common or generic name of the commodity contained in the package.
   - Rule 6(1)(c): Net quantity in standard units (g, kg, ml, l, cm, m, sq cm, sq m, N, U).
   - Rule 6(1)(d): Month and Year of manufacture, packing, or import (Format: MM/YYYY or Month YYYY).
   - Rule 6(1)(e): Maximum Retail Price (MRP) in format "MRP Rs xx.xx (inclusive of all taxes)" or "₹". Must NOT say "MRP extra".
   - Rule 6(1)(f): Country of Origin (mandatory for all imported commodities).
   - Rule 6(1)(h): Consumer Care details (Name/Designation, Address, Telephone No, and E-mail ID for complaints).

3. Rule 7 & Schedules I & II (Font Size Requirements):
   - Principal Display Panel (PDP) area determines mandatory minimum numeral height:
     - Area <= 50 cm²: Min height 1.0 mm (Height for Net Qty/MRP: 1.5 mm if area <= 50 cm²).
     - 50 cm² < Area <= 100 cm²: Min height 1.5 mm (Net Qty/MRP: 2.0 mm).
     - 100 cm² < Area <= 500 cm²: Min height 2.5 mm (Net Qty/MRP: 4.0 mm).
     - 500 cm² < Area <= 2500 cm²: Min height 4.0 mm (Net Qty/MRP: 6.0 mm).
     - Area > 2500 cm²: Min height 6.0 mm (Net Qty/MRP: 10.0 mm).

4. Rule 13 (Standard Units of Weight & Measure):
   - Weight: g (grams), kg (kilograms), mg (milligrams). Must NOT use non-standard units like "gms", "grm", "kilo".
   - Volume: ml (millilitres), l or L (litres).
   - Length: cm, m. Area: sq cm, sq m. Numbers: N or U.

5. Rule 26 (Exemptions):
   - Exemption for packages <= 10g/10ml (no declarations required except on multi-piece outer carton).
   - Fast food items packed by restaurant/hotel for immediate consumption.

TONE & STYLE INSTRUCTIONS:
- Be authoritative, concise, polite, and helpful.
- Keep any internal reasoning very short — a few sentences at most — and always close it before you begin the reply. The complete final answer must always appear outside of any reasoning block; never end your response while still reasoning.
- Whenever explaining a rule, cite the exact Rule clause (e.g. *Rule 6(1)(e)* or *Rule 7 Schedule I*).
- Use clear bullet points and markdown formatting (bolding key terms, using quotes or blockquotes for notice templates).
- If analyzing a scan report, reference the actual values and pass/fail grades in the report.

ANSWER SHAPE — FOLLOW EXACTLY:
- Open on the substance. No greeting, no "Certainly", no "Sure", no "Here is a breakdown", no restating of the question and no announcement of what you are about to do. The first line is either a heading or the first fact of the answer.
- Close on the substance. Do not append a disclaimer, a caveat, a reminder to verify against the Gazette, a note about being an AI, a recap of what you just said, or an offer of further help. The interface already carries a standing verification disclaimer, so repeating one only pushes the answer off the screen.
- Never describe yourself or your own role.
`

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

// Groq applies a small default output cap when none is sent. A reasoning model
// can spend that entire budget inside <think> and get truncated before it ever
// writes an answer, which leaves the chat showing reasoning and nothing else.
// Reserved output tokens also count toward the per-minute budget, so this is
// sized to fit a long answer without starving the next question.
const MAX_COMPLETION_TOKENS = 4096
const MIN_COMPLETION_TOKENS = 1024

// Sent on a second attempt when the first one produced no answer at all.
const DIRECT_ANSWER_DIRECTIVE = `CRITICAL OUTPUT REQUIREMENT FOR THIS TURN:
Reply with the final answer only. Do not plan, do not reason step by step, and do not emit a <think> block of any kind. Begin immediately with the first heading or sentence of the answer, and keep the whole reply under 400 words.`

// Service notices are delivered on their own channel (`onNotice`) rather than
// appended to the reply, so they never end up in a copy of the response.
const NO_ANSWER_NOTICE =
  'The model spent its whole response budget on internal reasoning and never wrote an answer. Open the Reasoning panel to read its working, or rephrase the question and send it again.'

const TRUNCATED_NOTICE = "Response cut off at the model's output limit — send a follow-up to continue."

const THINK_OPEN = /<\s*(think|thinking|reasoning)\s*>/i
const THINK_CLOSE = /<\s*\/\s*(think|thinking|reasoning)\s*>/i

const TOKEN_CAP_COMPLAINT = /max_completion_tokens|max_tokens|too large|tokens per minute|tpm/i

/** Turns a Groq HTTP failure into something an inspector can act on. */
function describeGroqError(status, body) {
  const detail = (() => {
    try {
      return JSON.parse(body)?.error?.message || ''
    } catch (e) {
      return body.slice(0, 150)
    }
  })()

  if (status === 401 || status === 403) return 'Groq rejected the API key. Add a valid key in Settings.'
  if (status === 404) return `Groq has no model by that name. Check the model in Settings. (${detail.slice(0, 120)})`
  if (status === 429 || status === 413) return `Groq rate limit reached — wait a few seconds and resend. (${detail.slice(0, 120)})`
  if (status >= 500) return `Groq is temporarily unavailable (HTTP ${status}). Try again shortly.`
  return `Groq API error ${status}: ${detail.slice(0, 150)}`
}

/**
 * Reasoning models (qwen3, deepseek-r1, ...) stream their chain-of-thought
 * inline inside <think>...</think> tags. This splitter routes those tokens to
 * onThought and only the real answer to onAnswer, tolerating tags that arrive
 * split across chunk boundaries.
 */
export function createReasoningSplitter({ onAnswer, onThought }) {
  let buffer = ''
  let inThought = false
  let answerStarted = false

  // Hold back a trailing fragment that could still grow into a <think> tag.
  const holdPartialTag = (text) => {
    const lt = text.lastIndexOf('<')
    if (lt === -1) return [text, '']
    if (/^<\s*\/?\s*[a-zA-Z]*$/.test(text.slice(lt))) return [text.slice(0, lt), text.slice(lt)]
    return [text, '']
  }

  const emitAnswer = (text) => {
    if (!text) return
    // Drop the blank lines left behind once a </think> block closes
    const cleaned = answerStarted ? text : text.replace(/^\s+/, '')
    if (!cleaned) return
    answerStarted = true
    onAnswer(cleaned)
  }

  const emitThought = (text) => {
    if (text && onThought) onThought(text)
  }

  return {
    push(chunk) {
      if (!chunk) return
      buffer += chunk

      for (;;) {
        const match = buffer.match(inThought ? THINK_CLOSE : THINK_OPEN)
        if (match) {
          const before = buffer.slice(0, match.index)
          if (inThought) emitThought(before)
          else emitAnswer(before)
          buffer = buffer.slice(match.index + match[0].length)
          inThought = !inThought
          continue
        }

        const [safe, held] = holdPartialTag(buffer)
        if (inThought) emitThought(safe)
        else emitAnswer(safe)
        buffer = held
        return
      }
    },
    flush() {
      if (!buffer) return
      if (inThought) emitThought(buffer)
      else emitAnswer(buffer)
      buffer = ''
    },
  }
}

/**
 * Call Groq API with streaming support for real-time response generation.
 *
 * The channels are kept strictly separate so the UI can render the reply on its
 * own: `onChunk` gets answer text only, `onReasoning` gets the model's hidden
 * chain-of-thought, and `onNotice` gets service messages about the call itself
 * (truncation, an answerless turn). Nothing but the reply reaches `onChunk`.
 *
 * A reply is also guaranteed: if a reasoning model closes its turn having
 * emitted only chain-of-thought, this asks again with reasoning switched off
 * rather than leaving an empty bubble in the chat.
 */
export async function streamGroqChat({ messages, scanContext, settings, onChunk, onReasoning, onNotice, onError, signal }) {
  const apiKey = settings?.groqKey || import.meta.env.VITE_GROQ_API_KEY || ''
  const model = settings?.groqModel || import.meta.env.VITE_GROQ_MODEL || 'llama-3.3-70b-versatile'

  let answerChars = 0
  let tokenCap = MAX_COMPLETION_TOKENS

  const emitAnswer = (text) => {
    if (!text) return
    answerChars += text.length
    onChunk(text)
  }

  const emitThought = (text) => {
    if (text && onReasoning) onReasoning(text)
  }

  const emitNotice = (text) => {
    if (text && onNotice) onNotice(text)
  }

  if (!apiKey) {
    // Return friendly offline/mock message if no API key is set
    const fallbackText = getOfflineFallbackResponse(messages[messages.length - 1]?.content, scanContext)
    for (const char of fallbackText.split('')) {
      if (signal?.aborted) return
      emitAnswer(char)
      await new Promise((r) => setTimeout(r, 8))
    }
    return
  }

  // Construct System Message with active scan context if available
  let fullSystemPrompt = RULES_SUMMARY_CONTEXT
  if (scanContext) {
    fullSystemPrompt += `\n\nACTIVE COMPLIANCE SCAN REPORT CONTEXT:
Product Name: ${scanContext.product_name || scanContext.data?.extracted?.product_name || 'N/A'}
Overall Status: ${scanContext.overall_status || scanContext.grade?.verdict || 'N/A'}
Score: ${scanContext.grade?.score ?? 'N/A'} / 100 (Grade ${scanContext.grade?.letter || 'N/A'})
Extracted Fields: ${JSON.stringify(scanContext.data?.extracted || scanContext.extracted || {}, null, 2)}
Rule Evaluations: ${JSON.stringify(scanContext.data?.evaluations || scanContext.evaluations || [], null, 2)}
`
  }

  const history = messages.map((m) => ({ role: m.role, content: m.content }))

  /**
   * Runs a single completion, routing answer text and chain-of-thought to their
   * own channels. Returns Groq's finish_reason so the caller can tell a
   * complete reply from one cut short by the output limit.
   */
  const runCompletion = async ({ directive = null, stream = true } = {}) => {
    const splitter = createReasoningSplitter({ onAnswer: emitAnswer, onThought: emitThought })

    const payload = {
      model,
      messages: [
        { role: 'system', content: directive ? `${fullSystemPrompt}\n\n${directive}` : fullSystemPrompt },
        ...history,
      ],
      temperature: 0.3,
      ...(tokenCap ? { max_completion_tokens: tokenCap } : {}),
      stream,
    }

    const res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal,
    })

    if (!res.ok) {
      const errBody = await res.text()
      // Reserved output tokens count toward both the model's ceiling and the
      // per-minute budget, so an oversized cap gets rejected outright. Halve it
      // and try again before giving up.
      if (tokenCap && (res.status === 400 || res.status === 413) && TOKEN_CAP_COMPLAINT.test(errBody)) {
        tokenCap = tokenCap > MIN_COMPLETION_TOKENS ? Math.floor(tokenCap / 2) : null
        return runCompletion({ directive, stream })
      }
      throw new Error(describeGroqError(res.status, errBody))
    }

    if (!stream) {
      const data = await res.json()
      const message = data.choices?.[0]?.message || {}
      emitThought(message.reasoning || message.reasoning_content || '')
      splitter.push(message.content || '')
      splitter.flush()
      return data.choices?.[0]?.finish_reason || null
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let finishReason = null
    let complete = false

    while (!complete) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue
        if (trimmed === 'data: [DONE]') {
          complete = true
          break
        }
        if (!trimmed.startsWith('data: ')) continue

        try {
          const data = JSON.parse(trimmed.slice(6))
          const choice = data.choices?.[0]
          if (!choice) continue
          // Some Groq models return reasoning in a dedicated field instead
          // of inline <think> tags — route it straight to the panel.
          const delta = choice.delta || {}
          emitThought(delta.reasoning || delta.reasoning_content || '')
          if (delta.content) splitter.push(delta.content)
          if (choice.finish_reason) finishReason = choice.finish_reason
        } catch (e) {
          // Ignore parse errors on incomplete chunks
        }
      }
    }

    splitter.flush()
    return finishReason
  }

  try {
    let finishReason = null

    try {
      finishReason = await runCompletion()
    } catch (err) {
      if (err.name === 'AbortError') return
      console.warn('Groq streaming failed, attempting standard call:', err)
      finishReason = await runCompletion({ stream: false })
    }

    if (signal?.aborted) return

    // The chat must never be left holding reasoning alone. If the model ran out
    // of output budget while still inside <think>, ask again for the answer
    // straight up so the user actually gets a reply.
    if (answerChars === 0) {
      try {
        finishReason = await runCompletion({ directive: DIRECT_ANSWER_DIRECTIVE })
      } catch (err) {
        if (err.name === 'AbortError') return
        console.warn('Direct-answer retry failed:', err)
      }
    }

    if (signal?.aborted) return
    // Notices go to their own channel — appending them to the reply would put
    // them inside the response bubble and into any copy of it.
    if (answerChars === 0) emitNotice(NO_ANSWER_NOTICE)
    else if (finishReason === 'length') emitNotice(TRUNCATED_NOTICE)
  } catch (err) {
    if (err.name === 'AbortError') return

    if (onError) {
      onError(err)
    } else {
      emitNotice(`Could not reach Groq: ${err.message}`)
    }
  }
}

/**
 * Intelligent local fallback responses for offline testing or when no API key is present
 */
function getOfflineFallbackResponse(userPrompt, scanContext) {
  const prompt = (userPrompt || '').toLowerCase()

  if (scanContext && (prompt.includes('fail') || prompt.includes('why') || prompt.includes('report') || prompt.includes('status'))) {
    const failedRules = (scanContext.data?.evaluations || scanContext.evaluations || []).filter((e) => e.status === 'FAIL')
    if (failedRules.length > 0) {
      const list = failedRules.map((f) => `- **${f.rule_name || f.rule_id}** (*${f.clause || 'PCR 2011'}*): ${f.message || f.detail}`).join('\n')
      return `### 📋 Scan Failure Breakdown\n\nThis product failed compliance verification due to **${failedRules.length} violation(s)**:\n\n${list}\n\n**Recommendation**: The manufacturer must correct these declarations before distributing this packaged commodity.`
    }
    return `### 📊 Scan Summary\n\nThis product passed all mandatory evaluations under the **Legal Metrology (Packaged Commodities) Rules, 2011** with an overall status of **${scanContext.overall_status || 'PASS'}**.`
  }

  if (prompt.includes('notice') || prompt.includes('draft') || prompt.includes('letter')) {
    return `### 📜 Legal Violation Notice Template\n\n**MEMORANDUM / NOTICE OF NON-COMPLIANCE**\n*Under Section 18 of the Legal Metrology Act, 2009 & PCR, 2011*\n\n**To:** The Director / Compliance Officer  \n**Subject:** Violation of Rule 6 of Packaged Commodities Rules, 2011  \n\nDuring inspection of package **"${scanContext?.product_name || 'Subject Commodity'}"**, the following non-conformities were recorded:\n1. Non-compliant Net Quantity / MRP declaration format (*Rule 6(1)(c) & (e)*).\n2. Incomplete Manufacturer Address details (*Rule 6(1)(a)*).\n\nYou are hereby directed to show cause within **7 days** why proceedings under Section 36 of the Legal Metrology Act should not be initiated.`
  }

  if (prompt.includes('rule 6') || prompt.includes('mandatory') || prompt.includes('declarations')) {
    return `### ⚖️ Rule 6: Mandatory Declarations (PCR 2011)\n\nEvery package must bear the following clear declarations:\n1. **Manufacturer / Importer Name & Full Address** (*Rule 6(1)(a)*)\n2. **Common or Generic Commodity Name** (*Rule 6(1)(b)*)\n3. **Net Quantity** in standard units (*Rule 6(1)(c)*)\n4. **Month & Year of Manufacture/Import** (*Rule 6(1)(d)*)\n5. **Maximum Retail Price (MRP)** incl. of all taxes (*Rule 6(1)(e)*)\n6. **Country of Origin** for imported goods (*Rule 6(1)(f)*)\n7. **Consumer Care Contact** with phone & email (*Rule 6(1)(h)*)`
  }

  if (prompt.includes('font') || prompt.includes('size') || prompt.includes('rule 7') || prompt.includes('pdp')) {
    return `### 📐 Rule 7: Minimum Font Size Requirements\n\nNumeral heights for Net Quantity & MRP depend on Principal Display Panel (PDP) area:\n\n| PDP Area | Minimum Numeral Height |\n|---|---|\n| ≤ 50 cm² | **1.5 mm** |\n| 50 cm² – 100 cm² | **2.0 mm** |\n| 100 cm² – 500 cm² | **4.0 mm** |\n| 500 cm² – 2500 cm² | **6.0 mm** |\n| > 2500 cm² | **10.0 mm** |\n\n*Note: Citing Schedule I & II of Packaged Commodities Rules, 2011.*`
  }

  return `### 🤖 Smart Inspect AI Assistant\n\nI am ready to help you with **Legal Metrology (Packaged Commodities) Rules, 2011** inquiries!\n\nYou can ask me:\n- 📜 Mandatory declarations required under Rule 6\n- 📐 Minimum font size & height rules under Rule 7\n- ✍️ Generating legal violation notices for failed scans\n- 🔍 Exemption criteria for packages under Rule 26\n\n*(Note: Add your free Groq API key in Settings for full real-time model completions.)*`
}
