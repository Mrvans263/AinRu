import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const Dashboard = ({ user }) => {
  const [userProfile, setUserProfile] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user) {
      setUserProfile(user.user_metadata || {});
    }
  }, [user]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log('Selected file:', file);

    // Basic validation
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size must be less than 5MB' });
      return;
    }

    await uploadProfilePicture(file);
  };

  const uploadProfilePicture = async (file) => {
    if (!file || !user) {
      setMessage({ type: 'error', text: 'No file or user' });
      return;
    }

    try {
      setUploading(true);
      setMessage({ type: 'info', text: 'Uploading...' });

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `user-${user.id}-${Date.now()}.${fileExt}`;
      
      console.log('Uploading to bucket: profile-pictures');
      console.log('Filename:', fileName);

      // UPLOAD THE FILE
      const { data, error } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      console.log('Upload success:', data);

      // GET PUBLIC URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      console.log('Public URL:', publicUrl);

      // UPDATE USER METADATA
      const { error: updateError } = await supabase.auth.updateUser({
        data: { 
          ...user.user_metadata,
          profile_picture_url: publicUrl
        }
      });

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // Update local state
      setUserProfile(prev => ({
        ...prev,
        profile_picture_url: publicUrl
      }));
      
      setMessage({ 
        type: 'success', 
        text: 'Profile picture updated successfully!' 
      });

      console.log('Profile updated successfully');

    } catch (error) {
      console.error('Full error:', error);
      setMessage({ 
        type: 'error', 
        text: `Upload failed: ${error.message}` 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Helper functions (keep your existing ones)
  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateAge = (dateString) => {
    if (!dateString) return null;
    const dob = new Date(dateString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return 'Not provided';
    
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1,4)}) ${cleaned.slice(4,7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length > 10) {
      return `+${cleaned}`;
    }
    
    return phone;
  };

  return (
    <div className="dashboard-container">
      

      {/* Message Display */}
      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '20px' }}>
          {message.text}
        </div>
      )}

      {/* Profile Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '30px', 
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '2px solid #f0f0f0'
      }}>
        <div style={{ position: 'relative' }}>
          {userProfile?.profile_picture_url ? (
            <div style={{ position: 'relative' }}>
              <img 
                src={userProfile.profile_picture_url} 
                alt="Profile" 
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '4px solid #667eea'
                }}
              />
              <div style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: '#28a745',
                color: 'white',
                border: '2px solid white',
                borderRadius: '50%',
                width: '25px',
                height: '25px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px'
              }}>
                ✓
              </div>
            </div>
          ) : (
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '4px solid #764ba2',
              color: 'white',
              fontSize: '40px',
              fontWeight: 'bold'
            }}>
              {userProfile?.firstname?.[0] || ''}{userProfile?.surname?.[0] || ''}
            </div>
          )}
          
          {/* SIMPLE UPLOAD BUTTON THAT WORKS */}
          <div style={{ marginTop: '15px', textAlign: 'center' }}>
            <label 
              htmlFor="file-upload" 
              style={{ 
                cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'inline-block'
              }}
            >
              <div style={{
                padding: '10px 20px',
                background: uploading ? '#6c757d' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.3s'
              }}>
                {uploading ? 'Uploading...' : 'Upload Photo'}
              </div>
              <input
                id="file-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              Max 5MB • JPG, PNG, GIF, WebP
            </p>
          </div>
        </div>
        
        <div style={{ flex: 1 }}>
          <h2 style={{ marginBottom: '10px', fontSize: '28px', color: '#333' }}>
            Welcome, {userProfile?.firstname} {userProfile?.surname}!
          </h2>
          <p style={{ color: '#666', fontSize: '16px' }}>{user?.email}</p>
          <p style={{ color: '#28a745', fontSize: '14px', marginTop: '5px' }}>
            Member since: {new Date(user?.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Profile Information Grid */}
      <div className="user-info">
        <h3 style={{ 
          marginBottom: '20px', 
          color: '#333', 
          borderBottom: '2px solid #667eea', 
          paddingBottom: '10px',
          fontSize: '20px'
        }}>
          Profile Information
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '25px' }}>
          <div>
            <p><strong>Full Name:</strong></p>
            <p style={{ fontSize: '18px', fontWeight: '600', color: '#667eea', marginTop: '5px' }}>
              {userProfile?.firstname} {userProfile?.surname}
            </p>
          </div>
          
          <div>
            <p><strong>Email:</strong></p>
            <p style={{ marginTop: '5px', color: '#333' }}>{user?.email}</p>
          </div>
          
          <div>
            <p><strong>Phone Number:</strong></p>
            <p style={{ marginTop: '5px' }}>
              {formatPhoneNumber(userProfile?.phone)}
            </p>
          </div>
          
          <div>
            <p><strong>Education Level:</strong></p>
            <p style={{ marginTop: '5px' }}>{userProfile?.education}</p>
          </div>
          
          <div>
            <p><strong>Student Status:</strong></p>
            <p style={{ marginTop: '5px' }}>
              <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: userProfile?.is_student === 'Yes' ? '#d4edda' : '#f8d7da',
                color: userProfile?.is_student === 'Yes' ? '#155724' : '#721c24',
                fontSize: '14px'
              }}>
                {userProfile?.is_student === 'Yes' ? 'Currently a Student' : 'Not a Student'}
              </span>
            </p>
          </div>
          
          <div>
            <p><strong>Date of Birth:</strong></p>
            <p style={{ marginTop: '5px' }}>{formatDate(userProfile?.date_of_birth)}</p>
            {userProfile?.date_of_birth && (
              <p style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                Age: {calculateAge(userProfile.date_of_birth)} years
              </p>
            )}
          </div>
          
          <div>
            <p><strong>University:</strong></p>
            <p style={{ marginTop: '5px' }}>
              {userProfile?.university || 'Not provided'}
            </p>
          </div>
          
          <div>
            <p><strong>City:</strong></p>
            <p style={{ marginTop: '5px' }}>
              {userProfile?.city || 'Not provided'}
            </p>
          </div>
          
          <div>
            <p><strong>Verification Board:</strong></p>
            <p style={{ marginTop: '5px' }}>
              {userProfile?.verification_board || 'Not selected'}
            </p>
          </div>
          
          <div>
            <p><strong>Profile Picture:</strong></p>
            <p style={{ marginTop: '5px' }}>
              {userProfile?.profile_picture_url ? (
                <span style={{ color: '#28a745', fontWeight: '600' }}>✓ Uploaded</span>
              ) : (
                <span style={{ color: '#dc3545' }}>Not uploaded</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ 
        marginTop: '40px',
        display: 'flex',
        gap: '15px',
        justifyContent: 'center',
        borderTop: '1px solid #f0f0f0',
        paddingTop: '20px'
      }}>
        <button 
          className="btn btn-danger"
          onClick={handleLogout}
          style={{ flex: 1, maxWidth: '200px' }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Dashboard;