import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Variables absentes : pas d'exception au chargement (écran blanc) ; main.js affiche un message sur l'écran de connexion
export const supabaseOk = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = supabaseOk ? createClient(supabaseUrl, supabaseAnonKey) : null
