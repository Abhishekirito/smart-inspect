// Grading: convert per-field pass/fail/warning into a 0-100 score, a letter
// grade (A–F) and a final PASS / FAIL verdict for the packaged commodity.
//
// Scoring model (weighted). fail = 0, warning = 0.5, pass = 1 of the field weight.
// not_applicable fields are dropped from the denominator.

const WEIGHTS = {
  MANUFACTURER_PACKER_IMPORTER: 15,
  COMMON_GENERIC_NAME: 10,
  NET_QUANTITY: 20,
  MONTH_YEAR_MFG_PACK_IMPORT: 12,
  RETAIL_SALE_PRICE_MRP: 20,
  CONSUMER_CARE_DETAILS: 10,
  COUNTRY_OF_ORIGIN: 5,
  DIMENSIONS_IF_RELEVANT: 3,
  FONT_SIZE: 5,
}

const CREDIT = { pass: 1, warning: 0.5, fail: 0, not_measured: null, not_applicable: null }

export function computeGrade(fieldResults) {
  let earned = 0
  let possible = 0
  let fails = 0
  let warnings = 0

  for (const r of fieldResults) {
    const w = WEIGHTS[r.field_id] ?? 0
    const credit = CREDIT[r.status]
    if (credit == null || w === 0) continue
    possible += w
    earned += w * credit
    if (r.status === 'fail') fails += 1
    if (r.status === 'warning') warnings += 1
  }

  const score = possible === 0 ? 0 : Math.round((earned / possible) * 100)

  let letter
  if (score >= 90) letter = 'A'
  else if (score >= 75) letter = 'B'
  else if (score >= 60) letter = 'C'
  else if (score >= 40) letter = 'D'
  else letter = 'F'

  // A single missing mandatory field means the pack is legally non-compliant,
  // regardless of score — reflect that in the verdict.
  const verdict = fails === 0 ? 'PASS' : 'FAIL'

  const label =
    verdict === 'PASS'
      ? warnings > 0
        ? 'Compliant with minor observations'
        : 'Fully compliant'
      : `${fails} mandatory declaration${fails > 1 ? 's' : ''} missing or invalid`

  return { score, letter, verdict, fails, warnings, label }
}

export const gradeColor = (letter) =>
  ({ A: 'emerald', B: 'lime', C: 'amber', D: 'orange', F: 'red', 'N/A': 'slate' }[letter] || 'slate')

export const statusMeta = {
  compliant: { label: 'Compliant', color: 'emerald' },
  needs_review: { label: 'Needs Review', color: 'amber' },
  non_compliant: { label: 'Non-Compliant', color: 'red' },
  not_applicable: { label: 'Not Applicable', color: 'slate' },
}
