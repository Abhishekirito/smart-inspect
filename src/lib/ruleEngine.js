// Deterministic Legal Metrology (Packaged Commodities) Rules, 2011 validator.
// AI extracts fields; THIS module decides pass/fail and cites the clause.
// Input: a `structured` object (see aiService schema) + optional `meta`.
// Output: { overall_status, field_results[], font_size_check, applicability, grade }

import rules from '../data/rulesEngine.json'
import { computeGrade } from './grading.js'

const VAGUE = ['minimum', 'not less than', 'average', 'about', 'approximately', 'approx']
const BANNED_COUNT = ['dozen', 'score', 'gross', 'great gross']
const SI_UNITS = ['g', 'kg', 'mg', 'ml', 'l', 'cm', 'mm', 'm', 'sqcm', 'sqm', 'sq.dm', 'n', 'u']
const DIMENSION_CATEGORIES = ['bed-sheet', 'bedsheet', 'saree', 'towel', 'dhoti', 'cable', 'wire', 'tyre', 'tire']

const S = (v) => (v == null ? '' : String(v)).trim()
const has = (v) => S(v).length > 0
const low = (v) => S(v).toLowerCase()

// Convert declared net quantity to grams or millilitres for threshold checks.
export function toBaseGramsOrMl(value, unit) {
  if (value == null || isNaN(value)) return null
  const u = low(unit)
  if (u === 'kg' || u === 'l') return value * 1000
  if (u === 'g' || u === 'ml') return value
  if (u === 'mg') return value / 1000
  return null // length / area / number — not weight/volume
}

// ---- Font size requirement (Rule 7, Tables I & II) --------------------------
export function fontRequirement({ value, unit, pdpAreaCm2 }) {
  const u = low(unit)
  const t1 = rules.font_size_rules.table_1_by_weight_or_volume
  const t2 = rules.font_size_rules.table_2_by_length_area_or_number
  const baseQ = toBaseGramsOrMl(value, unit)

  if (['g', 'kg', 'ml', 'l', 'mg'].includes(u) && baseQ != null) {
    const band = t1.bands.find(
      (b) => baseQ > b.min_g_or_ml && (b.max_g_or_ml == null || baseQ <= b.max_g_or_ml)
    ) || t1.bands[0]
    return { table: 'Table I (weight/volume)', ...band, key: `${baseQ} g/ml` }
  }
  // length / area / number → keyed by principal display panel area
  const area = pdpAreaCm2 || 0
  const band = t2.bands.find(
    (b) => area >= b.min_area_cm2 && (b.max_area_cm2 == null || area < b.max_area_cm2)
  ) || t2.bands[0]
  return { table: 'Table II (length/area/number)', ...band, key: `PDP ${area} cm²` }
}

// ---- Applicability: exclusions (Rule 3) & exemptions (Rule 26) --------------
function checkApplicability(st) {
  const baseQ = toBaseGramsOrMl(st.net_quantity_value, st.net_quantity_unit)
  const cat = low(st.commodity_category)
  const isCementFert = /cement|fertil/.test(cat)
  const buyer = low(st.buyer_type || 'retail')

  if (['industrial_consumer', 'institutional_consumer', 'industrial', 'institutional'].includes(buyer)) {
    return { status: 'excluded', code: 'EXCL_INDUSTRIAL_INSTITUTIONAL', rule_ref: 'Rule 3',
      note: 'Package meant for industrial/institutional consumer — Chapter II retail rules do not apply.' }
  }
  if (baseQ != null && baseQ > 25000 && !isCementFert) {
    return { status: 'excluded', code: 'EXCL_BULK', rule_ref: 'Rule 3',
      note: 'Net quantity exceeds 25 kg / 25 L — outside Chapter II (cement & fertilizer carve-out excepted).' }
  }
  if (baseQ != null && baseQ <= 10) {
    return { status: 'exempt', code: 'EXEMPT_ULTRA_SMALL', rule_ref: 'Rule 26',
      note: 'Net quantity ≤ 10 g/ml — fully exempt from these rules.' }
  }
  if (baseQ != null && baseQ > 10 && baseQ <= 20) {
    return { status: 'partial', code: 'PARTIAL_EXEMPT_SMALL', rule_ref: 'Rule 26',
      note: '10–20 g/ml — exempt except MRP and net quantity, which remain mandatory.',
      onlyFields: ['RETAIL_SALE_PRICE_MRP', 'NET_QUANTITY'] }
  }
  return { status: 'applicable', note: 'Full Chapter II retail-package requirements apply.' }
}

const R = (field_id, label, status, rule_ref, extracted_value, reason) =>
  ({ field_id, label, status, rule_ref, extracted_value: extracted_value ?? null, reason })

export default function evaluate(structured, meta = {}) {
  const st = structured || {}
  const applicability = checkApplicability(st)
  const results = []

  const allowed = (id) =>
    applicability.status === 'applicable' ||
    (applicability.status === 'partial' && applicability.onlyFields.includes(id))

  // helper to push a not_applicable stub for skipped fields under partial exemption
  const naIf = (id, label, ref) =>
    R(id, label, 'not_applicable', ref, null, 'Exempt for this pack size / category.')

  // 1. Manufacturer / packer / importer -- Rule 6(1)(a), 10
  if (allowed('MANUFACTURER_PACKER_IMPORTER')) {
    const v = st.manufacturer_packer_importer
    if (!has(v)) results.push(R('MANUFACTURER_PACKER_IMPORTER', 'Manufacturer/Packer/Importer', 'fail', 'Rule 6(1)(a), 10', v, 'Name & address of manufacturer/packer/importer not found.'))
    else if (st.has_full_address === false) results.push(R('MANUFACTURER_PACKER_IMPORTER', 'Manufacturer/Packer/Importer', 'warning', 'Rule 6(1)(a), 10', v, 'Name present but a complete postal address (city/state/PIN) could not be confirmed.'))
    else results.push(R('MANUFACTURER_PACKER_IMPORTER', 'Manufacturer/Packer/Importer', 'pass', 'Rule 6(1)(a), 10', v, 'Name and address present.'))
  } else results.push(naIf('MANUFACTURER_PACKER_IMPORTER', 'Manufacturer/Packer/Importer', 'Rule 6(1)(a)'))

  // 2. Common / generic name -- Rule 6(1)(b)
  if (allowed('COMMON_GENERIC_NAME')) {
    const v = st.common_generic_name
    results.push(has(v)
      ? R('COMMON_GENERIC_NAME', 'Common/Generic Name', 'pass', 'Rule 6(1)(b)', v, 'Commodity name declared.')
      : R('COMMON_GENERIC_NAME', 'Common/Generic Name', 'fail', 'Rule 6(1)(b)', v, 'Common or generic name of the commodity not found.'))
  } else results.push(naIf('COMMON_GENERIC_NAME', 'Common/Generic Name', 'Rule 6(1)(b)'))

  // 3. Net quantity -- Rule 6(1)(c), 11-13
  {
    const raw = st.net_quantity_raw
    const unit = low(st.net_quantity_unit)
    if (!has(raw)) results.push(R('NET_QUANTITY', 'Net Quantity', 'fail', 'Rule 6(1)(c), 11-13', raw, 'Net quantity declaration not found.'))
    else {
      const rl = low(raw)
      const banned = BANNED_COUNT.find((w) => rl.includes(w))
      const vague = VAGUE.find((w) => rl.includes(w))
      const badUnit = has(unit) && !SI_UNITS.includes(unit)
      if (banned) results.push(R('NET_QUANTITY', 'Net Quantity', 'fail', 'Rule 6(1)(c), 13', raw, `Uses banned count word "${banned}" — use symbol N or U instead.`))
      else if (vague) results.push(R('NET_QUANTITY', 'Net Quantity', 'fail', 'Rule 6(1)(c)', raw, `Contains prohibited qualifier "${vague}".`))
      else if (badUnit) results.push(R('NET_QUANTITY', 'Net Quantity', 'warning', 'Rule 6(1)(c), 13', raw, `Unit "${unit}" is not a recognised SI unit.`))
      else results.push(R('NET_QUANTITY', 'Net Quantity', 'pass', 'Rule 6(1)(c), 11-13', raw, 'Net quantity declared in standard units.'))
    }
  }

  // 4. Month & year of mfg/pack/import -- Rule 6(1)(d)
  if (allowed('MONTH_YEAR_MFG_PACK_IMPORT')) {
    const v = st.mfg_date_raw
    const isFood = /food|edible|snack|beverage|dairy|grocery/.test(low(st.commodity_type) + ' ' + low(st.commodity_category))
    if (!has(v) && isFood) results.push(R('MONTH_YEAR_MFG_PACK_IMPORT', 'Month/Year of Manufacture', 'not_applicable', 'Rule 6(1)(d)', v, 'Food article — this field is governed by FSSAI labelling, not PCR 2011.'))
    else if (!has(v)) results.push(R('MONTH_YEAR_MFG_PACK_IMPORT', 'Month/Year of Manufacture', 'fail', 'Rule 6(1)(d)', v, 'Month & year of manufacture/packing/import not found.'))
    else results.push(R('MONTH_YEAR_MFG_PACK_IMPORT', 'Month/Year of Manufacture', 'pass', 'Rule 6(1)(d)', v, 'Date of manufacture/packing declared.'))
  } else results.push(naIf('MONTH_YEAR_MFG_PACK_IMPORT', 'Month/Year of Manufacture', 'Rule 6(1)(d)'))

  // 5. MRP -- Rule 6(1)(e), 18
  {
    const v = st.mrp_raw
    if (!has(v)) results.push(R('RETAIL_SALE_PRICE_MRP', 'Maximum Retail Price', 'fail', 'Rule 6(1)(e), 18', v, 'MRP declaration not found.'))
    else {
      const vl = low(v)
      const hasCurrency = /(rs\.?|inr|₹|mrp)/.test(vl)
      const taxInclusive = st.mrp_tax_inclusive === true || /inclusive of all taxes|incl.*tax/.test(vl)
      if (!taxInclusive) results.push(R('RETAIL_SALE_PRICE_MRP', 'Maximum Retail Price', 'warning', 'Rule 6(1)(e), 2(m)', v, 'MRP present but the "inclusive of all taxes" wording could not be confirmed.'))
      else if (!hasCurrency) results.push(R('RETAIL_SALE_PRICE_MRP', 'Maximum Retail Price', 'warning', 'Rule 6(1)(e)', v, 'Price present but currency marker (Rs./₹) not detected.'))
      else results.push(R('RETAIL_SALE_PRICE_MRP', 'Maximum Retail Price', 'pass', 'Rule 6(1)(e), 18', v, 'MRP declared inclusive of all taxes.'))
    }
  }

  // 6. Dimensions -- Rule 6(1)(f) (conditional)
  {
    const cat = low(st.commodity_category)
    const relevant = DIMENSION_CATEGORIES.some((c) => cat.includes(c))
    const v = st.dimensions_raw
    if (!relevant) results.push(R('DIMENSIONS_IF_RELEVANT', 'Dimensions', 'not_applicable', 'Rule 6(1)(f)', v, 'Dimension declaration only required where size affects price/utility.'))
    else if (has(v)) results.push(R('DIMENSIONS_IF_RELEVANT', 'Dimensions', 'pass', 'Rule 6(1)(f), 14-15', v, 'Dimensions declared for a size-relevant commodity.'))
    else results.push(R('DIMENSIONS_IF_RELEVANT', 'Dimensions', 'warning', 'Rule 6(1)(f)', v, 'Size-relevant commodity but no dimensions declared.'))
  }

  // 7. Consumer care details -- Rule 6(2)
  if (allowed('CONSUMER_CARE_DETAILS')) {
    const v = st.consumer_care_raw
    results.push(has(v)
      ? R('CONSUMER_CARE_DETAILS', 'Consumer Care Details', 'pass', 'Rule 6(2)', v, 'Consumer care contact declared.')
      : R('CONSUMER_CARE_DETAILS', 'Consumer Care Details', 'fail', 'Rule 6(2)', v, 'Consumer care / complaint contact details not found.'))
  } else results.push(naIf('CONSUMER_CARE_DETAILS', 'Consumer Care Details', 'Rule 6(2)'))

  // 8. Country of origin -- imported goods only
  {
    const v = st.country_of_origin
    if (!st.is_imported) results.push(R('COUNTRY_OF_ORIGIN', 'Country of Origin', 'not_applicable', 'Rule 6 (amended)', v, 'Domestically manufactured — country of origin not mandatory.'))
    else if (has(v)) results.push(R('COUNTRY_OF_ORIGIN', 'Country of Origin', 'pass', 'Rule 6 (amended)', v, 'Country of origin declared for imported product.'))
    else results.push(R('COUNTRY_OF_ORIGIN', 'Country of Origin', 'fail', 'Rule 6 (amended)', v, 'Imported product missing country of origin.'))
  }

  // ---- Font size check (Rule 7) --------------------------------------------
  const req = fontRequirement({ value: st.net_quantity_value, unit: st.net_quantity_unit, pdpAreaCm2: meta.pdpAreaCm2 })
  const molded = !!meta.molded
  const requiredMin = molded ? req.min_height_mm_molded : req.min_height_mm_normal
  const measured = meta.measuredHeightMm
  const font_size_check = {
    declared_quantity: st.net_quantity_value ?? null,
    unit: st.net_quantity_unit ?? null,
    table: req.table,
    band: req.key,
    required_min_height_mm: requiredMin,
    measured_height_mm: measured ?? null,
    status: measured == null ? 'not_measured' : (measured >= requiredMin ? 'pass' : 'fail'),
  }
  if (measured != null) {
    results.push(R('FONT_SIZE', 'Font Size of Numerals', font_size_check.status, 'Rule 7',
      `${measured} mm`,
      font_size_check.status === 'pass'
        ? `Meets ${requiredMin} mm minimum (${req.table}).`
        : `Below ${requiredMin} mm minimum required (${req.table}).`))
  }

  // ---- Overall status + grade ----------------------------------------------
  if (applicability.status === 'excluded' || applicability.status === 'exempt') {
    return {
      overall_status: 'not_applicable',
      applicability,
      field_results: results,
      font_size_check,
      grade: { letter: 'N/A', score: null, label: applicability.note },
    }
  }

  const graded = results.filter((r) => r.status !== 'not_applicable')
  const anyFail = graded.some((r) => r.status === 'fail')
  const anyWarn = graded.some((r) => r.status === 'warning')
  const overall_status = anyFail ? 'non_compliant' : anyWarn ? 'needs_review' : 'compliant'
  const grade = computeGrade(results)

  return { overall_status, applicability, field_results: results, font_size_check, grade }
}
