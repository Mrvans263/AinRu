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
          window.location.href = '/';
          return;
        }

        if (!session) {
          console.error('❌ No session after OAuth');
          
          // Check if we have tokens in URL
          const hash = window.location.hash;
          if (hash.includes('access_token')) {
            console.log('⚠️ Has tokens but no session - trying manual processing');
            
            // Try to parse tokens manually
            const params = new URLSearchParams(hash.substring(1));
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            
            console.log('📋 Token check:', {
              hasAccessToken: !!accessToken,
              hasRefreshToken: !!refreshToken,
              tokenLength: accessToken?.length
            });
            
            if (accessToken) {
              // Try to set session manually
              try {
                await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken
                });
                console.log('✅ Manually set session from tokens');
                
                // Get session again
                const { data: { session: newSession } } = await supabase.auth.getSession();
                if (newSession) {
                  console.log('✅ Now have session:', newSession.user.email);
                  window.location.href = '/';
                  return;
                }
              } catch (tokenError) {
                console.error('❌ Manual token error:', tokenError);
              }
            }
          }
          
          window.location.href = '/';
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
        
        console.log('✅ Step 5: Redirecting to app...');
        window.location.href = '/';
        
      } catch (error) {
        console.error('❌ AuthCallback error:', error);
        window.location.href = '/';
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
            <h1>CampusConnect</h1>
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