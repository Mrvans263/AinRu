import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import './Auth.css';

const AuthCallback = () => {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('Handling OAuth callback...');
        
        // 1. Get the session from the URL hash
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error in callback:', error);
          setMessage({ 
            type: 'error', 
            text: 'Authentication failed. Please try again.' 
          });
          setLoading(false);
          return;
        }

        if (!session) {
          console.log('No session found in callback');
          setMessage({ 
            type: 'error', 
            text: 'No session found. Redirecting to login...' 
          });
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
          return;
        }

        console.log('Session found for user:', session.user.email);
        
        // 2. Check if user profile exists in database
        const { data: userProfile } = await supabase
          .from('users')
          .select('firstname, surname')
          .eq('id', session.user.id)
          .maybeSingle();

        // 3. Set localStorage flag for immediate loading
        localStorage.setItem(`user_${session.user.id}_profile_complete`, userProfile?.firstname ? 'true' : 'false');
        
        if (userProfile?.firstname && userProfile?.surname) {
          // Profile exists - redirect to app
          console.log('Profile exists, redirecting to app');
          window.location.href = '/';
        } else {
          // Profile doesn't exist - redirect to complete profile
          console.log('No profile found, redirecting to complete-profile');
          window.location.href = '/?state=complete-profile';
        }
        
      } catch (error) {
        console.error('Callback error:', error);
        setMessage({ 
          type: 'error', 
          text: 'An error occurred during authentication.' 
        });
        setLoading(false);
      }
    };

    handleCallback();
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