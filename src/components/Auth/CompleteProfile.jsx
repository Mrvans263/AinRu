import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './Auth.css';

const CompleteProfile = ({ user, onProfileComplete, onLogout }) => {
  const [formData, setFormData] = useState({
    firstname: '',
    surname: '',
    phone: '',
    education: '',
    is_student: '',
    date_of_birth: '',
    university: '',
    city: '',
    verification_board: '',
    program_field: '',
    bio: '',
    year_of_study: ''
  });
  
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [interests, setInterests] = useState([]);
  const [interestInput, setInterestInput] = useState('');
  const fileInputRef = useRef(null);

  // Pre-fill with Google user data if available
  useEffect(() => {
    if (user?.user_metadata?.name) {
      const fullName = user.user_metadata.name;
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const surname = nameParts.slice(1).join(' ') || '';
      
      setFormData(prev => ({
        ...prev,
        firstname: firstName,
        surname: surname
      }));
    }
    
    // Try to get profile picture from Google
    if (user?.user_metadata?.avatar_url) {
      setProfilePreview(user.user_metadata.avatar_url);
    }
  }, [user]);

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

  const addInterest = () => {
    if (interestInput.trim() && !interests.includes(interestInput.trim())) {
      setInterests([...interests, interestInput.trim()]);
      setInterestInput('');
    }
  };

  const removeInterest = (interestToRemove) => {
    setInterests(interests.filter(i => i !== interestToRemove));
  };

  const validateForm = () => {
    const requiredFields = ['firstname', 'surname', 'education', 'is_student', 'date_of_birth'];
    for (const field of requiredFields) {
      if (!formData[field]) {
        setMessage({ type: 'error', text: `Please fill in ${field.replace('_', ' ')}` });
        return false;
      }
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

    if (formData.year_of_study && (formData.year_of_study < 1 || formData.year_of_study > 7)) {
      setMessage({ type: 'error', text: 'Year of study must be between 1 and 7' });
      return false;
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
      // 1. Upload profile picture if provided
      let avatarUrl = profilePreview?.startsWith('data:') ? null : profilePreview;
      
      if (profilePicture && profilePreview?.startsWith('data:')) {
        const fileExt = profilePicture.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, profilePicture);
        
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          avatarUrl = publicUrl;
        }
      }

      // 2. Determine auth provider
      const authProvider = user?.app_metadata?.provider || 'email';

      // 3. Update complete user profile
      const { error: profileError } = await supabase
        .from('users')
        .update({
          firstname: formData.firstname,
          surname: formData.surname,
          phone: formData.phone || null,
          education: formData.education,
          is_student: formData.is_student,
          date_of_birth: formData.date_of_birth,
          university: formData.university || null,
          city: formData.city || null,
          verification_board: formData.verification_board || null,
          program_field: formData.program_field || null,
          bio: formData.bio || null,
          year_of_study: formData.year_of_study || null,
          interests: interests.length > 0 ? interests : null,
          profile_picture_url: avatarUrl,
          auth_provider: authProvider,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      setMessage({ 
        type: 'success', 
        text: 'Profile completed successfully! Redirecting...' 
      });

      // Short delay for better UX
      setTimeout(() => {
        onProfileComplete();
      }, 1000);

    } catch (error) {
      console.error('Profile completion error:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'An error occurred while updating your profile.' 
      });
      setLoading(false);
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
          <h2 className="auth-title">Complete Your Profile</h2>
          <p className="auth-subtitle">Finish setting up your account to get started</p>
          <p className="auth-subtitle" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Signed in as: <strong>{user?.email}</strong>
          </p>
        </div>

        {message.text && (
          <div className={`auth-message auth-message-${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Profile Picture Upload */}
          <div className="form-group">
            <label className="form-label">Profile Picture</label>
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
            <div className="form-hint">Optional. We'll use your Google photo if available.</div>
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

          {/* Email (read-only, from Google) */}
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-input"
              value={user?.email || ''}
              readOnly
              disabled
              style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed' }}
            />
            <div className="form-hint">Email from your Google account</div>
          </div>

          {/* Program/Field */}
          <div className="form-group">
            <label htmlFor="program_field" className="form-label">Program/Field of Study</label>
            <input
              type="text"
              id="program_field"
              name="program_field"
              className="form-input"
              value={formData.program_field}
              onChange={handleChange}
              placeholder="e.g., Computer Science, Business Administration"
            />
          </div>

          {/* Year of Study */}
          <div className="form-group">
            <label htmlFor="year_of_study" className="form-label">Year of Study</label>
            <select
              id="year_of_study"
              name="year_of_study"
              className="form-input"
              value={formData.year_of_study}
              onChange={handleChange}
            >
              <option value="">Select year</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
              <option value="5">5th Year</option>
              <option value="6">6th Year</option>
              <option value="7">Postgraduate</option>
            </select>
          </div>

          {/* Bio */}
          <div className="form-group">
            <label htmlFor="bio" className="form-label">Bio</label>
            <textarea
              id="bio"
              name="bio"
              className="form-input"
              value={formData.bio}
              onChange={handleChange}
              placeholder="Tell us about yourself..."
              rows="3"
              maxLength="500"
            />
            <div className="form-hint">Max 500 characters</div>
          </div>

          {/* Interests */}
          <div className="form-group">
            <label className="form-label">Interests</label>
            <div className="interests-input-container">
              <input
                type="text"
                className="form-input"
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
                placeholder="Type an interest and press Enter"
              />
              <button 
                type="button"
                onClick={addInterest}
                className="add-interest-btn"
              >
                Add
              </button>
            </div>
            
            {interests.length > 0 && (
              <div className="interests-tags">
                {interests.map((interest, index) => (
                  <span key={index} className="interest-tag">
                    {interest}
                    <button 
                      type="button"
                      onClick={() => removeInterest(interest)}
                      className="remove-interest"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
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

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              type="submit" 
              className="auth-button auth-button-primary"
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? 'Saving Profile...' : 'Complete Profile'}
            </button>
            
            <button 
              type="button"
              className="auth-button"
              onClick={onLogout}
              style={{ 
                flex: 1,
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db'
              }}
            >
              Logout
            </button>
          </div>
        </form>

        <div className="auth-footer">
          <p className="auth-text">
            Almost done! Complete your profile to start using CampusConnect.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfile;