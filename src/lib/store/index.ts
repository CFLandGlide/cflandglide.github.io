import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../config'
import { SupabaseStore } from './supabaseStore'
import type { DataStore } from './types'

export async function createStore(): Promise<DataStore | null> {
  // Written inline so production builds drop the local test store entirely
  if (import.meta.env.VITE_LOCAL_TEST === '1') {
    const { LocalStore } = await import('./localStore')
    return new LocalStore()
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  return new SupabaseStore(SUPABASE_URL, SUPABASE_ANON_KEY)
}
export * from './types'
