import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import './Auth.css';

const AuthCallback = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔄 Processing OAuth callback...');
        
        // 1. Get the hash from URL (Supabase puts tokens here)
        const hash = window.location.hash;
        
        if (!hash) {
          console.error('❌ No OAuth data in URL');
          setError('No authentication data found');
          setTimeout(() => window.location.href = '/', 2000);
          return;
        }

        // 2. Let Supabase handle the OAuth tokens
        // This is the CRITICAL part - Supabase v2 handles this automatically
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          throw sessionError;
        }

        if (!session?.user) {
          console.error('❌ No user after OAuth');
          setError('Authentication failed');
          setTimeout(() => window.location.href = '/', 2000);
          return;
        }

        console.log('✅ OAuth successful for:', session.user.email);
        
        // 3. Check if user exists in your database
        const { data: existingUser, error: dbError } = await supabase
          .from('users')
          .select('firstname, surname')
          .eq('id', session.user.id)
          .single();

        // 4. Redirect based on profile status
        if (dbError || !existingUser?.firstname) {
          // New user - needs to complete profile
          console.log('➡️ Redirecting to complete profile');
          window.location.href = '/?state=complete-profile';
        } else {
          // Existing user - go to app
          console.log('➡️ Redirecting to app');
          window.location.href = '/';
        }

      } catch (err) {
        console.error('❌ AuthCallback error:', err);
        setError(err.message || 'Authentication failed');
        setTimeout(() => window.location.href = '/', 3000);
      } finally {
        setLoading(false);
      }
    };

    handleAuthCallback();
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

        {error ? (
          <div className="auth-message auth-message-error">
            <p>{error}</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Redirecting to login...
            </p>
          </div>
        ) : loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Finalizing authentication...</p>
          </div>
        ) : (
          <div className="auth-message auth-message-success">
            <p>Login successful! Redirecting...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;