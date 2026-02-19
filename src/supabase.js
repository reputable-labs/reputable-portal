import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '')

// ─── Client CRUD ─────────────────────────────────────────────────

export async function createClient_(client) {
  // Insert client row
  const { error: clientErr } = await supabase.from('clients').insert({
    id: client.id,
    company_name: client.companyName,
    social_handles: client.socialHandles || '',
    collaborator_name: client.collaboratorName || '',
    collaborator_email: client.collaboratorEmail || '',
    collab_post: client.collabPost || false,
    story_sharing: client.storySharing || false,
    cross_posting: client.crossPosting || false,
    overall_status: client.overallStatus || 'not_started',
    form_completed: client.formCompleted || false,
  })
  if (clientErr) throw clientErr

  // Insert asset rows
  const assetRows = client.assets.map((a) => ({
    id: a.id,
    client_id: client.id,
    type: a.type,
    title: a.title,
    description: a.description,
    preview_label: a.previewLabel,
    dimensions: a.dimensions,
    status: a.status || 'pending',
    feedback: a.feedback || '',
    image_url: a.imageUrl || null,
  }))
  const { error: assetErr } = await supabase.from('assets').insert(assetRows)
  if (assetErr) throw assetErr

  return client
}

export async function getClient(id) {
  const { data: row, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !row) return null

  const { data: assetRows } = await supabase
    .from('assets')
    .select('*')
    .eq('client_id', id)
    .order('id')

  return rowToClient(row, assetRows || [])
}

export async function listClients() {
  const { data: rows } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (!rows) return []

  const { data: allAssets } = await supabase.from('assets').select('*')
  const assetMap = {}
  ;(allAssets || []).forEach((a) => {
    if (!assetMap[a.client_id]) assetMap[a.client_id] = []
    assetMap[a.client_id].push(a)
  })

  return rows.map((r) => rowToClient(r, assetMap[r.id] || []))
}

export async function updateClient(client) {
  const { error: clientErr } = await supabase.from('clients').update({
    company_name: client.companyName,
    social_handles: client.socialHandles || '',
    collaborator_name: client.collaboratorName || '',
    collaborator_email: client.collaboratorEmail || '',
    collab_post: client.collabPost || false,
    story_sharing: client.storySharing || false,
    cross_posting: client.crossPosting || false,
    overall_status: client.overallStatus,
    form_completed: client.formCompleted,
    form_submitted_at: client.formSubmittedAt || null,
    submitted_at: client.submittedAt || null,
  }).eq('id', client.id)
  if (clientErr) throw clientErr

  // Upsert assets
  for (const a of client.assets) {
    await supabase.from('assets').update({
      status: a.status || 'pending',
      feedback: a.feedback || '',
      image_url: a.imageUrl || null,
    }).eq('client_id', client.id).eq('id', a.id)
  }
  return client
}

export async function deleteClient_(id) {
  // Delete stored images
  const { data: assets } = await supabase.from('assets').select('image_url').eq('client_id', id)
  if (assets) {
    const paths = assets.map((a) => a.image_url).filter(Boolean).map((url) => {
      const parts = url.split('/assets/')
      return parts[parts.length - 1]
    })
    if (paths.length > 0) {
      await supabase.storage.from('assets').remove(paths)
    }
  }
  // Cascade deletes assets via FK
  await supabase.from('clients').delete().eq('id', id)
}

// ─── Image Upload ────────────────────────────────────────────────

export async function uploadAssetImage(clientId, assetId, file) {
  const path = `${clientId}/${assetId}_${Date.now()}.jpg`

  // Compress before uploading
  const compressed = await compressImageFile(file, 1200, 0.75)

  const { error } = await supabase.storage
    .from('assets')
    .upload(path, compressed, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error

  const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)

  // Update asset row with the image URL
  await supabase.from('assets').update({ image_url: urlData.publicUrl })
    .eq('client_id', clientId).eq('id', assetId)

  return urlData.publicUrl
}

export async function deleteAssetImage(clientId, assetId) {
  const { data: asset } = await supabase
    .from('assets')
    .select('image_url')
    .eq('client_id', clientId)
    .eq('id', assetId)
    .single()

  if (asset?.image_url) {
    const parts = asset.image_url.split('/assets/')
    const path = parts[parts.length - 1]
    await supabase.storage.from('assets').remove([path])
  }

  await supabase.from('assets').update({ image_url: null })
    .eq('client_id', clientId).eq('id', assetId)
}

// ─── Helpers ─────────────────────────────────────────────────────

function rowToClient(row, assetRows) {
  return {
    id: row.id,
    companyName: row.company_name,
    socialHandles: row.social_handles,
    collaboratorName: row.collaborator_name,
    collaboratorEmail: row.collaborator_email,
    collabPost: row.collab_post,
    storySharing: row.story_sharing,
    crossPosting: row.cross_posting,
    overallStatus: row.overall_status,
    formCompleted: row.form_completed,
    formSubmittedAt: row.form_submitted_at,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    assets: assetRows.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      previewLabel: a.preview_label,
      dimensions: a.dimensions,
      status: a.status,
      feedback: a.feedback,
      imageUrl: a.image_url,
      // Keep gradient previews as fallback
      preview: getDefaultPreview(a.id),
    })),
  }
}

function getDefaultPreview(assetId) {
  const previews = {
    asset_1: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 40%, #333 100%)',
    asset_2: 'linear-gradient(135deg, #222 0%, #1a1a1a 50%, #111 100%)',
    asset_3: 'linear-gradient(180deg, #333 0%, #1a1a1a 40%, #0a0a0a 100%)',
  }
  return previews[assetId] || previews.asset_1
}

function compressImageFile(file, maxWidth = 1200, quality = 0.75) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
