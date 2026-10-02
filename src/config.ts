export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''
/** Local test mode: browser-only data, never used by the deployed site. */
export const LOCAL_TEST = import.meta.env.VITE_LOCAL_TEST === '1'
export const APP_NAME = 'CFLandGlide'
export const DEFAULT_CENTER = { lat: 26.93, lng: -80.19 } // Jupiter Farms, FL
