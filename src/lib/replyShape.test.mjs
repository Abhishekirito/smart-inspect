// Checks for the reply splitter. No test framework in this project — run it with:
//   node src/lib/replyShape.test.mjs
import { splitReply, plainNote } from './replyShape.js'

let failures = 0
const check = (name, cond, extra = '') => {
  if (cond) {
    console.log(`ok    ${name}`)
    return
  }
  failures += 1
  console.log(`FAIL  ${name}${extra ? `\n      ${extra}` : ''}`)
}

// 1. The reported shape: filler opener, answer, trailing disclaimer.
const typical = `Certainly! Here's a detailed breakdown of Rule 6:

### ⚖️ Rule 6 — Mandatory Declarations

1. **Manufacturer name & address** (*Rule 6(1)(a)*)
2. **Net quantity** in standard units (*Rule 6(1)(c)*)

---

**Note:** While I am an AI assistant, final regulatory notices should be verified against official Gazette notifications.`
{
  const { lead, body, tail } = splitReply(typical)
  check('1 opener pulled out', lead.startsWith('Certainly!'), JSON.stringify(lead))
  check('1 body keeps heading', body.startsWith('### ⚖️ Rule 6'), JSON.stringify(body.slice(0, 40)))
  check('1 body keeps list', body.includes('Rule 6(1)(c)'))
  check('1 body has no opener', !/Certainly/i.test(body))
  check('1 body has no disclaimer', !/Gazette|AI assistant/i.test(body))
  check('1 body has no stray rule', !body.trimEnd().endsWith('---'))
  check('1 disclaimer captured', /Gazette/.test(tail), JSON.stringify(tail))
}

// 2. A drafted legal notice ends in a blockquote — must never be clipped.
const notice = `### 📜 Notice of Non-Compliance

> **To:** The Compliance Officer
> You are hereby directed to verify the declarations against the official Gazette notification and show cause within 7 days.`
{
  const { lead, body, tail } = splitReply(notice)
  check('2 blockquote kept in body', body.includes('show cause within 7 days'))
  check('2 nothing stripped', lead === '' && tail === '', JSON.stringify({ lead, tail }))
}

// 3. Tables untouched.
const table = `### 📐 Rule 7 Font Sizes

| PDP Area | Height |
|---|---|
| ≤ 50 cm² | **1.5 mm** |
| > 2500 cm² | **10.0 mm** |`
{
  const { lead, body, tail } = splitReply(table)
  check('3 table intact', body.includes('10.0 mm') && lead === '' && tail === '')
}

// 4. A reply that is *only* a disclaimer keeps everything in the bubble.
{
  const only = '**Note:** verify against official Gazette notifications before issuing.'
  const { body, tail } = splitReply(only)
  check('4 disclaimer-only reply untouched', tail === '' && body === only)
}

// 5. Mid-stream: filler alone stays put until real content lands.
{
  const mid = splitReply("Certainly! Here is the breakdown:")
  check('5 streaming filler stays put', mid.lead === '' && mid.tail === '')
}

// 6. Offers of further help are boilerplate too.
const offer = `Rule 26 exempts packages of net weight up to 10 g or 10 ml from the declaration requirements, other than the outer multi-piece carton.

Let me know if you would like the exemption list for fast-food packaging as well!`
{
  const { body, tail } = splitReply(offer)
  check('6 offer moved out', /Let me know/.test(tail) && !/Let me know/.test(body))
  check('6 answer intact', body.startsWith('Rule 26 exempts'))
}

// 7. Welcome banners render exactly as authored.
const welcome = `### 🤖 Smart Inspect Legal Co-Pilot
Welcome! I am your AI assistant specialized in **Legal Metrology (Packaged Commodities) Rules, 2011**.

Ask me anything about mandatory declarations, Rule 7 font sizes, exemption rules, or scan report analysis!`
{
  const { lead, body, tail } = splitReply(welcome)
  check('7 welcome untouched', lead === '' && tail === '' && body === welcome.trim(), JSON.stringify({ lead, tail }))
}

// 8. Code fences survive chunking; the opener is kept when dropping it would
// leave too little behind, but the disclaimer still goes.
const fenced = `Here's the validator:

\`\`\`js
const ok = /MRP/.test(label)
\`\`\`

**Disclaimer:** not legal advice.`
{
  const { body, tail } = splitReply(fenced)
  check('8 fence kept', body.includes('const ok = /MRP/.test(label)'))
  check('8 disclaimer out', /not legal advice/.test(tail))
}

// 9. plainNote flattens markdown to one quiet line.
{
  const flat = plainNote('**Note:**\n*verify* against the `Gazette`')
  check('9 plainNote flattens', flat === 'Note: verify against the Gazette', JSON.stringify(flat))
}

// 10. Empty / nullish input is safe.
check('10 empty safe', splitReply('').body === '' && splitReply(null).body === '')

// 11. Planning the model spoke out loud instead of wrapping in <think>.
const leaked = `Okay, the user is asking about Rule 26 exemptions. I should cite the clause and keep it short.

Let me structure this as a short list.

### 🔍 Rule 26 — Exemptions

- Packages of net weight up to **10 g / 10 ml** (*Rule 26(a)*)
- Fast food packed by a restaurant for immediate consumption (*Rule 26(b)*)

That should cover it — I've listed both limbs of the exemption.`
{
  const { lead, body, tail } = splitReply(leaked)
  check('11 planning pulled out', /the user is asking/i.test(lead), JSON.stringify(lead))
  check('11 both planning paragraphs out', /Let me structure/i.test(lead))
  check('11 body starts at the answer', body.startsWith('### 🔍 Rule 26'), JSON.stringify(body.slice(0, 30)))
  check('11 body keeps both bullets', body.includes('Rule 26(a)') && body.includes('Rule 26(b)'))
  check('11 sign-off pulled out', /That should cover it/i.test(tail), JSON.stringify(tail))
  check('11 body free of commentary', !/user is asking|should cover/i.test(body))
}

// 12. A legitimate answer opening with "So" is not treated as planning.
{
  const real = `So the net quantity declaration must appear on the principal display panel in standard units under *Rule 6(1)(c)*.

Non-standard abbreviations such as "gms" are not permitted (*Rule 13*).`
  const { lead, tail } = splitReply(real)
  check('12 real answer untouched', lead === '' && tail === '', JSON.stringify({ lead, tail }))
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
