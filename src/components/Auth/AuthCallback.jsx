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
        
        // CRITICAL: First, let Supabase handle the OAuth tokens from URL
        const { data: { session }, error: oauthError } = await supabase.auth.getSession();
        
        if (oauthError) {
          console.error('❌ OAuth processing error:', oauthError);
          setMessage({ 
            type: 'error', 
            text: 'Authentication failed. Please try again.' 
          });
          setLoading(false);
          return;
        }

        if (!session) {
          console.log('⚠️ No session after OAuth - trying to get user...');
          
          // Try to get user directly (sometimes needed for OAuth)
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          
          if (userError || !user) {
            console.error('❌ No user found after OAuth');
            setMessage({ 
              type: 'error', 
              text: 'Authentication incomplete. Redirecting to login...' 
            });
            
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
            return;
          }
          
          // If we have a user but no session, try to refresh
          await supabase.auth.refreshSession();
          console.log('🔄 Refreshed session for user:', user.email);
        }

        // Now get the final session after processing
        const { data: { session: finalSession } } = await supabase.auth.getSession();
        
        if (!finalSession?.user) {
          console.error('❌ Final session check failed');
          setMessage({ 
            type: 'error', 
            text: 'Authentication failed. Please try again.' 
          });
          setLoading(false);
          return;
        }

        console.log('✅ OAuth successful for user:', finalSession.user.email);
        
        // 2. Check if user profile exists in database
        const isProfileComplete = await authAPI.checkProfileCompletion(finalSession.user.id);
        
        // 3. Update last login
        await authAPI.updateLastLogin(finalSession.user.id);
        
        // 4. Determine where to redirect
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
          text: 'An error occurred during authentication.' 
        });
        setLoading(false);
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
            <p>Finalizing your login...</p>
          </div>
        )}
        
        {loading && !message.text && (
          <div className="auth-footer">
            <p className="auth-text" style={{ fontSize: '0.875rem' }}>
              This may take a few seconds...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;