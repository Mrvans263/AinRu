import React, { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './Auth.css';

const AuthCallback = () => {
  useEffect(() => {
    console.log('=== AUTH CALLBACK DEBUG ===');
    console.log('🔍 URL:', window.location.href);
    console.log('🔍 Hash length:', window.location.hash.length);
    console.log('🔍 Search:', window.location.search);
    
    const processOAuth = async () => {
      try {
        console.log('🔄 Step 1: Getting session...');
        
        // Get session (Supabase should process OAuth tokens automatically)
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('🔄 Step 2: Session result:', {
          hasSession: !!session,
          error: error?.message,
          userEmail: session?.user?.email,
          userId: session?.user?.id
        });
        
        if (error) {
          console.error('❌ Session error:', error);
          // Clean URL and let main app handle it
          setTimeout(() => {
            window.location.hash = '';
            window.location.search = '';
          }, 100);
          return;
        }

        if (!session) {
          console.error('❌ No session after OAuth');
          setTimeout(() => {
            window.location.hash = '';
            window.location.search = '';
          }, 100);
          return;
        }

        console.log('✅ Step 3: OAuth successful!');
        console.log('📋 User details:', {
          email: session.user.email,
          id: session.user.id,
          provider: session.user.app_metadata?.provider,
          created: session.user.created_at
        });
        
        // Check if user exists in database
        console.log('🔄 Step 4: Checking database...');
        const { data: userProfile, error: dbError } = await supabase
          .from('users')
          .select('id, profile_completed, auth_provider')
          .eq('id', session.user.id)
          .single();
        
        console.log('📋 Database check:', {
          hasProfile: !!userProfile,
          dbError: dbError?.message,
          profileCompleted: userProfile?.profile_completed,
          authProvider: userProfile?.auth_provider
        });
        
        // Wait a bit for database sync
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('✅ Step 5: Cleaning URL and letting app handle redirect...');
        
        // CRITICAL: Remove OAuth parameters from URL WITHOUT redirecting
        // Use setTimeout to avoid React render cycle issues
        setTimeout(() => {
          if (window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          // Force navigation to root after a moment
          setTimeout(() => {
            window.location.href = '/';
          }, 50);
        }, 100);
        
      } catch (error) {
        console.error('❌ AuthCallback error:', error);
        setTimeout(() => {
          window.location.hash = '';
          window.location.search = '';
          window.location.href = '/';
        }, 100);
      }
    };

    processOAuth();
  }, []);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <div className="logo-icon">CC</div>
            <h1>AinRu</h1>
          </div>
          <h2 className="auth-title">Processing Google Sign In</h2>
          <p className="auth-subtitle">Please wait...</p>
        </div>
        
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Finalizing authentication...</p>
        </div>
        
        <div className="auth-footer">
          <p className="auth-text" style={{ fontSize: '0.875rem' }}>
            Check browser console for debugging info
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;