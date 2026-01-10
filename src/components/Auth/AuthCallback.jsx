import React, { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './Auth.css';

const AuthCallback = () => {
  useEffect(() => {
    console.log('=== AUTH CALLBACK DEBUG ===');
    console.log('🔍 Full URL:', window.location.href);
    console.log('🔍 Pathname:', window.location.pathname);
    console.log('🔍 Hash:', window.location.hash);
    console.log('🔍 Search:', window.location.search);
    
    const processOAuth = async () => {
      try {
        console.log('🔄 Step 1: Getting session...');
        
        // IMPORTANT: First, let Supabase handle the OAuth tokens from the URL
        // This is needed because tokens might be in the hash fragment
        const hash = window.location.hash;
        
        if (hash && hash.includes('access_token')) {
          console.log('🔑 Found tokens in hash fragment');
          // Parse tokens from hash
          const params = new URLSearchParams(hash.substring(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          
          if (access_token) {
            console.log('🔄 Setting session from hash tokens...');
            await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            console.log('✅ Session set from hash tokens');
          }
        }
        
        // Now get the session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('🔄 Step 2: Session result:', {
          hasSession: !!session,
          error: error?.message,
          userEmail: session?.user?.email,
          userId: session?.user?.id
        });
        
        if (error) {
          console.error('❌ Session error:', error);
          // Redirect to login after delay
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
          return;
        }

        if (!session) {
          console.error('❌ No session after OAuth - trying to sign in with OAuth');
          
          // Try to trigger OAuth sign in again
          try {
            await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: {
                skipBrowserRedirect: true
              }
            });
          } catch (oauthError) {
            console.error('OAuth retry failed:', oauthError);
          }
          
          // Wait and redirect
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
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
        let userProfile = null;
        let dbError = null;
        
        try {
          const { data, error: profileError } = await supabase
            .from('users')
            .select('id, profile_completed, auth_provider')
            .eq('id', session.user.id)
            .single();
          
          userProfile = data;
          dbError = profileError;
        } catch (err) {
          dbError = err;
        }
        
        console.log('📋 Database check:', {
          hasProfile: !!userProfile,
          dbError: dbError?.message,
          profileCompleted: userProfile?.profile_completed,
          authProvider: userProfile?.auth_provider
        });
        
        // Clean the URL before redirecting
        console.log('✅ Step 5: Cleaning URL and redirecting...');
        
        // Remove hash and query parameters
        if (window.history.replaceState) {
          window.history.replaceState({}, document.title, '/');
        }
        
        // Give a moment for state to update, then redirect
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
        
      } catch (error) {
        console.error('❌ AuthCallback error:', error);
        // Clean URL and redirect on error
        setTimeout(() => {
          if (window.history.replaceState) {
            window.history.replaceState({}, document.title, '/');
          }
          window.location.href = '/';
        }, 1500);
      }
    };

    // Add a small delay to ensure Supabase is ready
    setTimeout(() => {
      processOAuth();
    }, 100);
    
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