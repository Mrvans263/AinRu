import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;


export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Set to false to prevent URL issues
    storage: {
      getItem: (key) => {
        try {
          return localStorage.getItem(key)
        } catch (error) {
          console.error('Error reading from localStorage:', error)
          return null
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value)
        } catch (error) {
          console.error('Error writing to localStorage:', error)
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key)
        } catch (error) {
          console.error('Error removing from localStorage:', error)
        }
      }
    }
  }
})

// Helper function to clear auth data
export const clearAuthData = () => {
  try {
    // Clear all Supabase auth related keys
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key.includes('supabase') || 
          key.includes('sb-') ||
          key.startsWith('user_') && key.endsWith('_profile_complete') ||
          key === 'just_signed_up') {
        keysToRemove.push(key)
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key))
    console.log('Cleared auth data')
  } catch (error) {
    console.error('Error clearing auth data:', error)
  }
}
