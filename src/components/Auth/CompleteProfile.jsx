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
    verification_board: ''
  });
  
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Pre-fill with Google user data if available
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
      // 1. Update auth user metadata
      const { error: authUpdateError } = await supabase.auth.updateUser({
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
      });

      if (authUpdateError) throw authUpdateError;

      // 2. Upsert user profile in database
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          firstname: formData.firstname,
          surname: formData.surname,
          phone: formData.phone || null,
          education: formData.education,
          is_student: formData.is_student,
          date_of_birth: formData.date_of_birth,
          university: formData.university || null,
          city: formData.city || null,
          verification_board: formData.verification_board || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (profileError) throw profileError;

      // 3. Handle profile picture upload if provided
      if (profilePicture) {
        try {
          const fileExt = profilePicture.name.split('.').pop();
          const fileName = `${user.id}-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, profilePicture);
          
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('avatars')
              .getPublicUrl(fileName);
            
            await supabase
              .from('users')
              .update({ avatar_url: publicUrl })
              .eq('id', user.id);
          }
        } catch (uploadError) {
          console.error('Error uploading profile picture:', uploadError);
          // Non-critical error, continue
        }
      }

      setMessage({ 
        type: 'success', 
        text: 'Profile completed successfully! Redirecting...' 
      });

      // 4. Set localStorage flag for fast loading on future visits
      localStorage.setItem(`user_${user.id}_profile_complete`, 'true');
      
      // 5. Short delay for better UX, then notify parent
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