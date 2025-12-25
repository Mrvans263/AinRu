import { supabase } from './supabase';

export const authAPI = {
  // Check if user has completed profile
  async checkProfileCompletion(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('profile_completed, firstname, surname')
        .eq('id', userId)
        .single();
      
      if (error) {
        // User doesn't exist in public.users yet (Google OAuth new user)
        return false;
      }
      
      return data?.profile_completed === true;
    } catch (error) {
      console.error('Profile check error:', error);
      return false;
    }
  },

  // Get user's auth provider
  async getUserAuthProvider(userId) {
    try {
      const { data } = await supabase
        .from('users')
        .select('auth_provider')
        .eq('id', userId)
        .single();
      
      return data?.auth_provider || 'email';
    } catch (error) {
      return 'email';
    }
  },

  // Complete user profile (used by both Google and email users)
  async completeUserProfile(userId, profileData) {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          ...profileData,
          profile_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      return { success: !error, error };
    } catch (error) {
      return { success: false, error };
    }
  },

  // Update last login
  async updateLastLogin(userId) {
    try {
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      console.error('Update last login error:', error);
    }
  }
};