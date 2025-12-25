import React, { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './Auth.css';

const AuthCallback = () => {
  useEffect(() => {
    const handleCallback = async () => {
      console.log('🔄 Processing OAuth callback...');
      
      try {
        // Let Supabase handle the OAuth tokens
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('OAuth error:', error);
          window.location.href = '/';
          return;
        }
        
        if (!session) {
          console.log('No session after OAuth');
          window.location.href = '/';
          return;
        }
        
        console.log('✅ OAuth successful for:', session.user.email);
        
        // Small delay for database sync
        setTimeout(() => {
          // Just redirect to root - App.jsx will handle the rest
          window.location.href = '/';
        }, 500);
        
      } catch (error) {
        console.error('Callback error:', error);
        window.location.href = '/';
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
          <h2 className="auth-title">Completing Sign In</h2>
          <p className="auth-subtitle">Please wait...</p>
        </div>
        
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Finalizing authentication...</p>
        </div>
        
        <div className="auth-footer">
          <p className="auth-text" style={{ fontSize: '0.875rem' }}>
            Redirecting you to the app...
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;