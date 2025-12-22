import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const Signup = ({ onSwitchToLogin }) => {
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

  const uploadProfilePicture = async (userId) => {
    if (!profilePicture) return null;

    try {
      const fileExt = profilePicture.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = fileName; // Store in bucket root for simplicity

      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, profilePicture);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      return publicUrl;

    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const validateForm = () => {
    // Password validation
    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return false;
    }
    
    if (formData.password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return false;
    }

    // Required fields
    const requiredFields = ['firstname', 'surname', 'email', 'education', 'is_student', 'date_of_birth'];
    for (const field of requiredFields) {
      if (!formData[field]) {
        setMessage({ type: 'error', text: `Please fill in ${field.replace('_', ' ')}` });
        return false;
      }
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return false;
    }

    // Phone validation (optional)
    if (formData.phone && !/^[\+]?[0-9\s\-\(\)]{10,}$/.test(formData.phone)) {
      setMessage({ type: 'error', text: 'Please enter a valid phone number' });
      return false;
    }

    // Date validation (16+ years old)
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

      if (dob > today) {
        setMessage({ type: 'error', text: 'Date of birth cannot be in the future' });
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
      // 1. Create user in Supabase Auth with all metadata
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
            verification_board: formData.verification_board || null,
            // Profile picture will be added after email confirmation
          }
        }
      });

      if (authError) throw authError;

      // 2. Upload profile picture if exists (optional - can be done later)
      if (profilePicture && authData.user) {
        try {
          const profilePictureUrl = await uploadProfilePicture(authData.user.id);
          if (profilePictureUrl) {
            // Update user with profile picture URL
            await supabase.auth.updateUser({
              data: { profile_picture_url: profilePictureUrl }
            });
          }
        } catch (uploadError) {
          console.warn('Profile picture upload failed, but account was created:', uploadError);
        }
      }

      setMessage({ 
        type: 'success', 
        text: 'Registration successful! Please check your email to confirm your account.' 
      });
      
      // Clear form after success
      setTimeout(() => {
        setFormData({
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
        setProfilePicture(null);
        setProfilePreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          onSwitchToLogin();
        }, 3000);
      }, 2000);

    } catch (error) {
      console.error('Signup error:', error);
      setMessage({ 
        type: 'error', 
        text: error.message.includes('already registered') 
          ? 'This email is already registered. Please use a different email or try logging in.'
          : error.message || 'An error occurred during registration. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const removeProfilePicture = (e) => {
    e?.stopPropagation();
    setProfilePicture(null);
    setProfilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = (e) => {
    e?.stopPropagation();
    fileInputRef.current?.click();
  };

  return (
    <div className="container">
      <h2 className="form-title">Create Account</h2>
      <p className="form-subtitle">Fill in all required information</p>
      
      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Profile Picture */}
        <div className="form-group">
          <label>Profile Picture (Optional)</label>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            <div 
              onClick={() => !profilePreview && triggerFileInput()}
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                border: profilePreview ? 'none' : '2px dashed #667eea',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                cursor: 'pointer',
                backgroundColor: profilePreview ? 'transparent' : '#f8f9fa'
              }}
            >
              {profilePreview ? (
                <img 
                  src={profilePreview} 
                  alt="Preview" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#667eea' }}>
                  <div style={{ fontSize: '24px' }}>+</div>
                  <div style={{ fontSize: '12px' }}>Add Photo</div>
                </div>
              )}
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
            
            {profilePicture && (
              <div style={{ textAlign: 'center' }}>
                <button 
                  type="button"
                  onClick={removeProfilePicture}
                  style={{
                    padding: '6px 12px',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    marginTop: '5px'
                  }}
                >
                  Remove
                </button>
                <p style={{ fontSize: '12px', color: '#28a745', marginTop: '5px' }}>
                  Selected: {profilePicture.name}
                </p>
              </div>
            )}
            
            <p style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
              Max 5MB. Formats: JPG, PNG, GIF, WebP
            </p>
          </div>
        </div>

        {/* Personal Information */}
        <div className="form-group">
          <label htmlFor="firstname" className="required">First Name</label>
          <input
            type="text"
            id="firstname"
            name="firstname"
            className="form-control"
            value={formData.firstname}
            onChange={handleChange}
            required
            placeholder="Enter first name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="surname" className="required">Surname</label>
          <input
            type="text"
            id="surname"
            name="surname"
            className="form-control"
            value={formData.surname}
            onChange={handleChange}
            required
            placeholder="Enter surname"
          />
        </div>

        <div className="form-group">
          <label htmlFor="email" className="required">Email</label>
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
          <label htmlFor="phone">Phone Number (Optional)</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            className="form-control"
            value={formData.phone}
            onChange={handleChange}
            placeholder="e.g., +1 234 567 8900"
          />
        </div>

        <div className="form-group">
          <label htmlFor="date_of_birth" className="required">Date of Birth</label>
          <input
            type="date"
            id="date_of_birth"
            name="date_of_birth"
            className="form-control"
            value={formData.date_of_birth}
            onChange={handleChange}
            required
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="form-group">
          <label htmlFor="city">City (Optional)</label>
          <input
            type="text"
            id="city"
            name="city"
            className="form-control"
            value={formData.city}
            onChange={handleChange}
            placeholder="Enter your city"
          />
        </div>

        {/* Education */}
        <div className="form-group">
          <label htmlFor="education" className="required">Education Level</label>
          <select
            id="education"
            name="education"
            className="form-control"
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

        <div className="form-group">
          <label className="required">Currently a Student?</label>
          <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="radio"
                name="is_student"
                value="Yes"
                checked={formData.is_student === 'Yes'}
                onChange={handleChange}
                required
                style={{ marginRight: '8px' }}
              />
              Yes
            </label>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="radio"
                name="is_student"
                value="No"
                checked={formData.is_student === 'No'}
                onChange={handleChange}
                required
                style={{ marginRight: '8px' }}
              />
              No
            </label>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="university">University (Optional)</label>
          <input
            type="text"
            id="university"
            name="university"
            className="form-control"
            value={formData.university}
            onChange={handleChange}
            placeholder="Enter university name"
          />
        </div>

        {/* Verification */}
        <div className="form-group">
          <label htmlFor="verification_board">Verification Board (Optional)</label>
          <select
            id="verification_board"
            name="verification_board"
            className="form-control"
            value={formData.verification_board}
            onChange={handleChange}
          >
            <option value="">Select verification board</option>
            <option value="Zisa">Zisa</option>
            <option value="Zim Embassy">Zim Embassy</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Passwords */}
        <div className="form-group">
          <label htmlFor="password" className="required">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            className="form-control"
            value={formData.password}
            onChange={handleChange}
            required
            placeholder="Create password"
            minLength="6"
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword" className="required">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            className="form-control"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            placeholder="Confirm password"
            minLength="6"
          />
        </div>

        <button 
          type="submit" 
          className="btn" 
          disabled={loading}
          style={{ marginTop: '20px' }}
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <div className="text-center mt-4">
        <p>
          Already have an account?{' '}
          <span className="link" onClick={onSwitchToLogin}>
            Sign In
          </span>
        </p>
      </div>
    </div>
  );
};

export default Signup;