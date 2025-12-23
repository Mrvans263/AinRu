import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import './Auth.css';

const Signup = ({ onSwitchToLogin, onSignupComplete }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstname: '',
    surname: '',
    phone: '',
    education: '',
    is_student: '',
    date_of_birth: '',
    university: '',
    city: '',
    verification_board: ''
  });
  
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [googleLoading, setGoogleLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Please select a valid image file (JPEG, PNG, GIF, WebP)' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size must be less than 5MB' });
      return;
    }

    setProfilePicture(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return false;
    }
    
    if (formData.password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return false;
    }

    const requiredFields = ['firstname', 'surname', 'email', 'education', 'is_student', 'date_of_birth'];
    for (const field of requiredFields) {
      if (!formData[field]) {
        setMessage({ type: 'error', text: `Please fill in ${field.replace('_', ' ')}` });
        return false;
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return false;
    }

    if (formData.date_of_birth) {
      const dob = new Date(formData.date_of_birth);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      
      if (age < 16) {
        setMessage({ type: 'error', text: 'You must be at least 16 years old to register' });
        return false;
      }
    }

    return true;
  };

 const handleSubmit = async (e) => {
  e.preventDefault();
  
  if (!validateForm()) {
    return;
  }

  setLoading(true);
  setMessage({ type: '', text: '' });

  try {
    // 1. Sign up with auth (user gets created in auth.users table)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          firstname: formData.firstname,
          surname: formData.surname,
          phone: formData.phone || null,
          education: formData.education,
          is_student: formData.is_student,
          date_of_birth: formData.date_of_birth,
          university: formData.university || null,
          city: formData.city || null,
          verification_board: formData.verification_board || null
        }
      }
    });

    if (authError) throw authError;

    // 2. IMPORTANT: Wait a moment for the user to be fully created in auth.users
    // This prevents the foreign key constraint error
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Now create the user profile
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: formData.email,
          firstname: formData.firstname,
          surname: formData.surname,
          phone: formData.phone || null,
          education: formData.education,
          is_student: formData.is_student,
          date_of_birth: formData.date_of_birth,
          university: formData.university || null,
          city: formData.city || null,
          verification_board: formData.verification_board || null,
          created_at: new Date().toISOString()
        });

      if (profileError) {
        console.error('Profile creation error (non-critical):', profileError);
        // User can complete profile on first login
      }
    }

    setMessage({ 
      type: 'success', 
      text: 'Registration successful! You can now log in.' 
    });

    if (onSignupComplete) {
      setTimeout(() => {
        onSignupComplete();
      }, 2000);
    }

  } catch (error) {
    console.error('Signup error:', error);
    setMessage({ 
      type: 'error', 
      text: error.message.includes('already registered') 
        ? 'This email is already registered. Please log in.'
        : error.message || 'An error occurred during registration.'
    });
  } finally {
    setLoading(false);
  }
};
  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) throw error;
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to sign up with Google' });
      setGoogleLoading(false);
    }
  };

  const removeProfilePicture = () => {
    setProfilePicture(null);
    setProfilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card signup-card">
        <div className="auth-header">
          <div className="auth-logo">
            <div className="logo-icon">CC</div>
            <h1>CampusConnect</h1>
          </div>
          <h2 className="auth-title">Join Our Community</h2>
          <p className="auth-subtitle">Create your student account</p>
        </div>

        {message.text && (
          <div className={`auth-message auth-message-${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="auth-social" style={{ marginBottom: '2rem' }}>
          <button 
            type="button" 
            className="social-button"
            onClick={handleGoogleSignUp}
            disabled={googleLoading}
          >
            <svg className="social-icon" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleLoading ? 'Connecting...' : 'Sign up with Google'}
          </button>
        </div>

        <div className="auth-divider" style={{ marginTop: 0 }}>
          <span>Or sign up with email</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Profile Picture Upload */}
          <div className="form-group">
            <label className="form-label">Profile Picture (Optional)</label>
            <div className="profile-upload-container">
              <div 
                className="profile-upload-area"
                onClick={() => fileInputRef.current?.click()}
              >
                {profilePreview ? (
                  <img 
                    src={profilePreview} 
                    alt="Profile preview" 
                    className="profile-preview"
                  />
                ) : (
                  <div className="profile-upload-placeholder">
                    <div className="upload-icon">📷</div>
                    <div className="upload-text">Click to upload photo</div>
                  </div>
                )}
              </div>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="profile-input"
              />
              
              {profilePicture && (
                <div className="profile-upload-info">
                  <button 
                    type="button"
                    onClick={removeProfilePicture}
                    className="remove-button"
                  >
                    Remove
                  </button>
                  <span className="file-name">{profilePicture.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Name Fields */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstname" className="form-label">First Name *</label>
              <input
                type="text"
                id="firstname"
                name="firstname"
                className="form-input"
                value={formData.firstname}
                onChange={handleChange}
                required
                placeholder="Enter first name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="surname" className="form-label">Surname *</label>
              <input
                type="text"
                id="surname"
                name="surname"
                className="form-input"
                value={formData.surname}
                onChange={handleChange}
                required
                placeholder="Enter surname"
              />
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-input"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
            />
          </div>

          {/* Password Fields */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password" className="form-label">Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                className="form-input"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Create password"
                minLength="6"
              />
              <div className="form-hint">Minimum 6 characters</div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                className="form-input"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="Confirm password"
                minLength="6"
              />
            </div>
          </div>

          {/* Education */}
          <div className="form-group">
            <label htmlFor="education" className="form-label">Education Level *</label>
            <select
              id="education"
              name="education"
              className="form-input"
              value={formData.education}
              onChange={handleChange}
              required
            >
              <option value="">Select education level</option>
              <option value="Undergraduate">Undergraduate</option>
              <option value="Masters">Masters</option>
              <option value="PhD">PhD</option>
            </select>
          </div>

          {/* Student Status */}
          <div className="form-group">
            <label className="form-label">Currently a Student? *</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="is_student"
                  value="Yes"
                  checked={formData.is_student === 'Yes'}
                  onChange={handleChange}
                  required
                />
                <span className="radio-label">Yes</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="is_student"
                  value="No"
                  checked={formData.is_student === 'No'}
                  onChange={handleChange}
                  required
                />
                <span className="radio-label">No</span>
              </label>
            </div>
          </div>

          {/* Date of Birth */}
          <div className="form-group">
            <label htmlFor="date_of_birth" className="form-label">Date of Birth *</label>
            <input
              type="date"
              id="date_of_birth"
              name="date_of_birth"
              className="form-input"
              value={formData.date_of_birth}
              onChange={handleChange}
              required
              max={new Date().toISOString().split('T')[0]}
            />
            <div className="form-hint">You must be at least 16 years old</div>
          </div>

          {/* Additional Info */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="phone" className="form-label">Phone Number</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                className="form-input"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Enter phone number"
              />
            </div>

            <div className="form-group">
              <label htmlFor="city" className="form-label">City</label>
              <input
                type="text"
                id="city"
                name="city"
                className="form-input"
                value={formData.city}
                onChange={handleChange}
                placeholder="Enter your city"
              />
            </div>
          </div>

          {/* University */}
          <div className="form-group">
            <label htmlFor="university" className="form-label">University</label>
            <input
              type="text"
              id="university"
              name="university"
              className="form-input"
              value={formData.university}
              onChange={handleChange}
              placeholder="Enter university name"
            />
          </div>

          {/* Verification Board */}
          <div className="form-group">
            <label htmlFor="verification_board" className="form-label">Verification Board</label>
            <select
              id="verification_board"
              name="verification_board"
              className="form-input"
              value={formData.verification_board}
              onChange={handleChange}
            >
              <option value="">Select verification board</option>
              <option value="Zisa">Zisa</option>
              <option value="Zim Embassy">Zim Embassy</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Terms */}
          <div className="form-group terms-group">
            <label className="terms-label">
              <input type="checkbox" required />
              <span>
                I agree to the <a href="#" className="terms-link">Terms of Service</a> and <a href="#" className="terms-link">Privacy Policy</a>
              </span>
            </label>
          </div>

          <button 
            type="submit" 
            className="auth-button auth-button-primary"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p className="auth-text">
            Already have an account?{' '}
            <button 
              type="button"
              className="auth-link"
              onClick={onSwitchToLogin}
            >
              Sign in here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;