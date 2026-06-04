import { createClient } from '@supabase/supabase-js'

// Server-only Supabase client using the service-role key.
// Never import this in client components. The gaedhd_state table has RLS
// enabled with no policies, so only this service-role client can touch it.
// Per-user access is enforced in the API routes via the NextAuth session.
const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const STATE_TABLE = 'gaedhd_state'
export const PRESENCE_TABLE = 'gaedhd_presence'
export const INBOX_TABLE = 'gaedhd_inbox'

export function getSupabaseAdmin() {
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function supabaseConfigured() {
  return Boolean(url && serviceKey)
}
