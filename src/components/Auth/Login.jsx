import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

const Login = ({ onSwitchToSignup }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (error) throw error;
      // Login successful - app will redirect via auth state change

    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.message.includes('Invalid login credentials') 
          ? 'Invalid email or password. Please try again.'
          : error.message 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = prompt('Enter your email for password reset:');
    if (email) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        
        if (error) throw error;
        alert('Password reset email sent! Check your inbox.');
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }
  };

  return (
    <div className="container">
      <h2 className="form-title">Welcome Back</h2>
      <p className="form-subtitle">Sign in to your account</p>
      
      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            className="form-control"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="Enter your email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            className="form-control"
            value={formData.password}
            onChange={handleChange}
            required
            placeholder="Enter your password"
          />
          <div className="text-right mt-2">
            <span 
              className="link" 
              onClick={handleForgotPassword}
              style={{ fontSize: '14px' }}
            >
              Forgot password?
            </span>
          </div>
        </div>

        <button 
          type="submit" 
          className="btn" 
          disabled={loading}
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <div className="text-center mt-4">
        <p>
          Don't have an account?{' '}
          <span className="link" onClick={onSwitchToSignup}>
            Sign Up
          </span>
        </p>
      </div>
    </div>
  );
};

export default Login;