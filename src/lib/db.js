// Supabase-backed persistence for compliance scans. Each scan is stored as a row
// in the `scans` table: a few indexed columns for listing/filtering plus the full
// scan object in a `data` jsonb column. Row-level security scopes every query to
// the signed-in user (see the SQL in README.md), so no explicit user filtering is
// needed on reads — Postgres only returns rows where auth.uid() = user_id.
//
// Images are offloaded to a Supabase Storage bucket (`scan-images`) so the JSONB
// column stays lightweight (~5 KB per scan instead of ~3 MB). Each user's images
// live under `{user_id}/{scan_id}/` with RLS ensuring per-user isolation.
import { supabase } from './supabase.js'

export const uid = () =>
  's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

const BUCKET = 'scan-images'

async function currentUserId() {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id ?? null
}

// ---- Storage helpers --------------------------------------------------------

/** Check if a string is a data URL (base64-encoded image). */
function isDataUrl(s) {
  return typeof s === 'string' && s.startsWith('data:image/')
}

/** Upload a single data-URL image to Storage. Returns the storage path. */
async function uploadImage(userId, scanId, index, dataUrl) {
  const mime = dataUrl.slice(5, dataUrl.indexOf(';'))
  const ext = mime.split('/')[1] || 'png'
  const b64 = dataUrl.split(',')[1]
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const path = `${userId}/${scanId}/panel_${index}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: true })

  if (error) {
    console.warn(`[db] Image upload failed for ${path}:`, error.message)
    return null // Fall back to keeping data URL inline
  }
  return path
}

/** Generate a signed (time-limited) public URL for a stored image. */
async function getSignedUrl(path) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600) // 1-hour expiry
  if (error) {
    console.warn(`[db] Signed URL failed for ${path}:`, error.message)
    return null
  }
  return data?.signedUrl ?? null
}

/**
 * Strip data-URL images from a scan object and upload them to Storage.
 * Returns a copy of the scan with data URLs replaced by storage paths
 * (prefixed with `storage://` so we can detect them on read).
 */
async function offloadImages(userId, scan) {
  const out = { ...scan }
  let idx = 0

  // Handle scan.image (single / legacy)
  if (isDataUrl(out.image)) {
    const path = await uploadImage(userId, scan.id, idx++, out.image)
    out.image = path ? `storage://${path}` : out.image
  }

  // Handle scan.images (multi-panel array)
  if (Array.isArray(out.images)) {
    const mapped = []
    for (const img of out.images) {
      if (isDataUrl(img)) {
        const path = await uploadImage(userId, scan.id, idx++, img)
        mapped.push(path ? `storage://${path}` : img)
      } else {
        mapped.push(img)
      }
    }
    out.images = mapped
  }

  return out
}

/**
 * Restore storage paths back to viewable URLs when reading a scan.
 * Replaces `storage://...` references with signed Supabase Storage URLs.
 */
async function rehydrateImages(scan) {
  if (!scan) return scan
  const out = { ...scan }

  if (typeof out.image === 'string' && out.image.startsWith('storage://')) {
    const path = out.image.slice('storage://'.length)
    out.image = (await getSignedUrl(path)) || out.image
  }

  if (Array.isArray(out.images)) {
    const mapped = []
    for (const img of out.images) {
      if (typeof img === 'string' && img.startsWith('storage://')) {
        const path = img.slice('storage://'.length)
        mapped.push((await getSignedUrl(path)) || img)
      } else {
        mapped.push(img)
      }
    }
    out.images = mapped
  }

  return out
}

// ---- CRUD -------------------------------------------------------------------

export async function saveScan(scan) {
  const user_id = await currentUserId()
  if (!user_id) throw new Error('You must be signed in to save a scan.')

  // Offload heavy data-URL images to Storage before writing to DB
  const lightweight = await offloadImages(user_id, scan)

  const row = {
    id: lightweight.id,
    user_id,
    created_at: new Date(lightweight.createdAt || Date.now()).toISOString(),
    product_name: lightweight.productName || null,
    overall_status: lightweight.report?.overall_status || null,
    grade: lightweight.report?.grade?.letter || null,
    data: lightweight,
  }

  const { error } = await supabase.from('scans').upsert(row)
  if (error) throw error
  return scan // Return original scan (with data URLs) for immediate in-memory use
}

export async function getScan(id) {
  const { data, error } = await supabase
    .from('scans')
    .select('data')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return rehydrateImages(data?.data ?? null)
}

export async function deleteScan(id) {
  // Also clean up stored images
  const user_id = await currentUserId()
  if (user_id) {
    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(`${user_id}/${id}`)
    if (files && files.length > 0) {
      const paths = files.map((f) => `${user_id}/${id}/${f.name}`)
      await supabase.storage.from(BUCKET).remove(paths)
    }
  }

  const { error } = await supabase.from('scans').delete().eq('id', id)
  if (error) throw error
}

export async function clearAll() {
  const user_id = await currentUserId()
  if (!user_id) return

  // Remove all user images from storage
  const { data: folders } = await supabase.storage
    .from(BUCKET)
    .list(user_id)
  if (folders && folders.length > 0) {
    for (const folder of folders) {
      const { data: files } = await supabase.storage
        .from(BUCKET)
        .list(`${user_id}/${folder.name}`)
      if (files && files.length > 0) {
        const paths = files.map((f) => `${user_id}/${folder.name}/${f.name}`)
        await supabase.storage.from(BUCKET).remove(paths)
      }
    }
  }

  const { error } = await supabase.from('scans').delete().eq('user_id', user_id)
  if (error) throw error
}

export async function listScans() {
  const { data, error } = await supabase
    .from('scans')
    .select('data')
    .order('created_at', { ascending: false })
  if (error) throw error

  // Rehydrate images for all scans (list view may show thumbnails)
  const scans = (data || []).map((r) => r.data).filter(Boolean)
  return Promise.all(scans.map(rehydrateImages))
}
