// components/Auth/AuthCallback.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Loading from '../Common/Loading';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the session from URL fragments
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          navigate('/');
          return;
        }

        if (!session) {
          console.error('No session found');
          navigate('/');
          return;
        }

        console.log('User authenticated:', session.user.email);

        // Check if user exists in database
        const { data: existingUser, error: userError } = await supabase
          .from('users')
          .select('firstname, surname')
          .eq('id', session.user.id)
          .single();

        if (userError && userError.code !== 'PGRST116') {
          console.error('Error checking user:', userError);
        }

        // If user doesn't exist or profile is incomplete
        if (!existingUser || !existingUser.firstname || !existingUser.surname) {
          // Redirect to complete profile
          navigate('/complete-profile');
        } else {
          // Profile is complete, mark as such and redirect to app
          localStorage.setItem(`user_${session.user.id}_profile_complete`, 'true');
          navigate('/app');
        }

      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return <Loading fullscreen message="Completing authentication..." />;
};

export default AuthCallback;