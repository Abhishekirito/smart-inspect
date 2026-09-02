// Supabase-backed persistence for compliance scans. Each scan is stored as a row
// in the `scans` table: a few indexed columns for listing/filtering plus the full
// scan object in a `data` jsonb column. Row-level security scopes every query to
// the signed-in user (see the SQL in README.md), so no explicit user filtering is
// needed on reads — Postgres only returns rows where auth.uid() = user_id.
import { supabase } from './supabase.js'

export const uid = () =>
  's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

async function currentUserId() {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id ?? null
}

export async function saveScan(scan) {
  const user_id = await currentUserId()
  if (!user_id) throw new Error('You must be signed in to save a scan.')

  const row = {
    id: scan.id,
    user_id,
    created_at: new Date(scan.createdAt || Date.now()).toISOString(),
    product_name: scan.productName || null,
    overall_status: scan.report?.overall_status || null,
    grade: scan.report?.grade?.letter || null,
    data: scan,
  }

  const { error } = await supabase.from('scans').upsert(row)
  if (error) throw error
  return scan
}

export async function getScan(id) {
  const { data, error } = await supabase
    .from('scans')
    .select('data')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data?.data ?? null
}

export async function deleteScan(id) {
  const { error } = await supabase.from('scans').delete().eq('id', id)
  if (error) throw error
}

export async function clearAll() {
  const user_id = await currentUserId()
  if (!user_id) return
  const { error } = await supabase.from('scans').delete().eq('user_id', user_id)
  if (error) throw error
}

export async function listScans() {
  const { data, error } = await supabase
    .from('scans')
    .select('data')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map((r) => r.data).filter(Boolean)
}
