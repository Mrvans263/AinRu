import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { authAPI } from '../../lib/auth';
import './Auth.css';

const AuthCallback = () => {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        console.log('🔄 Starting OAuth callback processing...');
        
        // CRITICAL: Get the hash/fragment from the URL
        const hash = window.location.hash;
        const search = window.location.search;
        
        if (!hash && !search) {
          console.error('❌ No OAuth data in URL');
          setMessage({ 
            type: 'error', 
            text: 'No authentication data found.' 
          });
          setTimeout(() => window.location.href = '/', 2000);
          return;
        }

        // 1. Extract the access token from URL (for debugging)
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        console.log('📋 URL Data:', { 
          hasHash: !!hash, 
          hasSearch: !!search,
          hashLength: hash?.length,
          searchLength: search?.length,
          hasAccessToken: !!accessToken
        });

        // 2. IMPORTANT: Use exchangeCodeForSession for OAuth callback
        // This is the correct method for processing OAuth redirects
        const { data, error } = await supabase.auth.exchangeCodeForSession({
          authCode: search?.split('code=')[1] || hash?.split('code=')[1]
        });

        if (error) {
          console.error('❌ OAuth exchange error:', error);
          
          // Fallback: Try to get session directly
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError || !session) {
            console.error('❌ Fallback session check failed:', sessionError);
            
            // Last resort: Clear URL and try to trigger auth
            window.history.replaceState({}, document.title, '/auth/callback');
            
            // Try to sign in with stored tokens
            if (accessToken && refreshToken) {
              try {
                await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken
                });
                console.log('✅ Manually set session from tokens');
              } catch (tokenError) {
                console.error('❌ Manual token setting failed:', tokenError);
              }
            }
            
            // Check one more time
            const { data: { session: finalCheck } } = await supabase.auth.getSession();
            
            if (!finalCheck) {
              setMessage({ 
                type: 'error', 
                text: 'Authentication failed. Please try signing in again.' 
              });
              setLoading(false);
              return;
            }
          }
        }

        // 3. Get the final session
        const { data: { session: finalSession }, error: finalError } = await supabase.auth.getSession();
        
        if (finalError || !finalSession?.user) {
          console.error('❌ Final session error:', finalError);
          
          // Check if we're in a popup (some OAuth flows use this)
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_ERROR' }, window.location.origin);
            window.close();
            return;
          }
          
          setMessage({ 
            type: 'error', 
            text: 'Could not establish session. Redirecting...' 
          });
          setTimeout(() => window.location.href = '/', 2000);
          return;
        }

        console.log('✅ OAuth successful for user:', finalSession.user.email);
        
        // 4. Check profile and redirect
        const isProfileComplete = await authAPI.checkProfileCompletion(finalSession.user.id);
        
        if (isProfileComplete) {
          console.log('✅ Profile exists, redirecting to app');
          window.location.href = '/';
        } else {
          console.log('⚠️ No profile found, redirecting to complete-profile');
          window.location.href = '/?state=complete-profile';
        }
        
      } catch (error) {
        console.error('❌ Callback error:', error);
        setMessage({ 
          type: 'error', 
          text: 'Authentication error. Please try again.' 
        });
        setLoading(false);
        
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      }
    };

    handleOAuthCallback();
  }, []);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <div className="logo-icon">CC</div>
            <h1>CampusConnect</h1>
          </div>
          <h2 className="auth-title">Completing Authentication</h2>
          <p className="auth-subtitle">Please wait while we log you in...</p>
        </div>
        
        {message.text ? (
          <div className={`auth-message auth-message-${message.type}`}>
            {message.text}
          </div>
        ) : (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Processing authentication...</p>
          </div>
        )}
        
        {loading && !message.text && (
          <div className="auth-footer">
            <p className="auth-text" style={{ fontSize: '0.875rem' }}>
              Do not close this window...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;