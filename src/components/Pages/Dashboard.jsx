import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Loading from '../Common/Loading';
import './Dashboard.css';

const Dashboard = ({ user }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    listings: 0,
    messages: 0,
    friends: 0,
    events: 0
  });
  const [recentListings, setRecentListings] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);

  useEffect(() => {
    if (user) {
      initializeUserProfile();
    }
  }, [user]);

  const initializeUserProfile = async () => {
    try {
      // First, try to get the user profile
      const profile = await getUserProfile();
      
      if (!profile) {
        // If no profile exists, create one from auth data
        await createUserProfileFromAuth();
        // Then fetch the newly created profile
        const newProfile = await getUserProfile();
        setUserProfile(newProfile);
      } else {
        setUserProfile(profile);
      }
      
      // Fetch additional data
      await Promise.all([
        fetchUserStats(),
        fetchRecentListings(),
        fetchRecentMessages()
      ]);
      
    } catch (error) {
      console.error('Error initializing user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle instead of single to avoid PGRST116

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Exception in getUserProfile:', error);
      return null;
    }
  };

  const createUserProfileFromAuth = async () => {
    try {
      console.log('Creating user profile from auth data...');
      
      // Get fresh user data from auth
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        throw new Error('No auth user found');
      }
      
      // Extract data from user_metadata
      const metadata = authUser.user_metadata || {};
      
      const profileData = {
        id: authUser.id,
        email: authUser.email,
        firstname: metadata.firstname || '',
        surname: metadata.surname || '',
        profile_picture_url: metadata.profile_picture_url || null,
        education: metadata.education || 'Not specified',
        university: metadata.university || '',
        city: metadata.city || '',
        phone: metadata.phone || '',
        date_of_birth: metadata.date_of_birth || null,
        verification_board: metadata.verification_board || '',
        is_student: metadata.is_student === 'Yes' || metadata.is_student === true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('Creating profile with data:', profileData);
      
      const { data, error } = await supabase
        .from('users')
        .insert(profileData)
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error);
        
        // If it's a duplicate key error, the profile might have been created by another process
        if (error.code === '23505') { // Unique violation
          console.log('Profile already exists (duplicate key)');
          return;
        }
        
        throw error;
      }
      
      console.log('Profile created successfully:', data);
      return data;
      
    } catch (error) {
      console.error('Error in createUserProfileFromAuth:', error);
      throw error;
    }
  };

  const fetchUserStats = async () => {
    try {
      const [
        { count: listingsCount },
        { count: messagesCount },
        { count: friendsCount },
        { count: eventsCount }
      ] = await Promise.all([
        supabase
          .from('listings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_active', true),
        
        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', user.id)
          .eq('is_read', false),
        
        supabase
          .from('friends')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'accepted'),
        
        supabase
          .from('event_attendees')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'going')
      ]);

      setStats({
        listings: listingsCount || 0,
        messages: messagesCount || 0,
        friends: friendsCount || 0,
        events: eventsCount || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchRecentListings = async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setRecentListings(data || []);
    } catch (error) {
      console.error('Error fetching listings:', error);
    }
  };

  const fetchRecentMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey (
            firstname,
            surname,
            profile_picture_url
          )
        `)
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setRecentMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleEditProfile = () => {
    alert('Edit profile feature coming soon!');
  };

  const handleMarkAsRead = async (messageId) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId);

      if (error) throw error;
      
      fetchRecentMessages();
      fetchUserStats();
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  if (loading) {
    return <Loading message="Setting up your dashboard..." />;
  }

  if (!userProfile) {
    return (
      <div className="dashboard-error">
        <div className="error-container">
          <h2>Unable to Load Profile</h2>
          <p>There was an issue loading your profile data.</p>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
            User ID: {user?.id}
          </p>
          <button 
            onClick={() => {
              setLoading(true);
              initializeUserProfile();
            }}
            className="retry-btn"
          >
            Try Again
          </button>
          <button 
            onClick={createUserProfileFromAuth}
            className="retry-btn"
            style={{ marginLeft: '10px', backgroundColor: '#28a745' }}
          >
            Create Profile Manually
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Welcome Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            {userProfile?.profile_picture_url ? (
              <img 
                src={userProfile.profile_picture_url} 
                alt="Profile"
                className="profile-avatar-lg"
              />
            ) : user?.user_metadata?.profile_picture_url ? (
              <img 
                src={user.user_metadata.profile_picture_url} 
                alt="Profile"
                className="profile-avatar-lg"
              />
            ) : (
              <div className="profile-avatar-placeholder">
                {userProfile?.firstname?.[0]}{userProfile?.surname?.[0]}
              </div>
            )}
            <div className="header-info">
              <h1 className="welcome-text">
                Welcome back, <span className="highlight">{userProfile?.firstname}</span>!
              </h1>
              <p className="user-email">{userProfile?.email}</p>
              <div className="member-since">
                <span className="member-icon">🎓</span>
                <span className="member-text">
                  Member since {new Date(userProfile?.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <div className="header-right">
            <button 
              onClick={handleEditProfile}
              className="edit-profile-btn"
            >
              <span className="edit-icon">✏️</span>
              Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">🛒</div>
          <div className="stat-content">
            <div className="stat-value">{stats.listings}</div>
            <div className="stat-label">Active Listings</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-purple">💬</div>
          <div className="stat-content">
            <div className="stat-value">{stats.messages}</div>
            <div className="stat-label">Unread Messages</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-green">👥</div>
          <div className="stat-content">
            <div className="stat-value">{stats.friends}</div>
            <div className="stat-label">Friends</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-orange">📅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.events}</div>
            <div className="stat-label">Upcoming Events</div>
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Personal Information */}
        <div className="info-card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="card-icon">👤</span>
              Personal Information
            </h2>
          </div>
          
          <div className="card-content">
            <div className="info-item">
              <span className="info-label">Full Name</span>
              <span className="info-value">
                {userProfile?.firstname} {userProfile?.surname}
              </span>
            </div>
            
            <div className="info-item">
              <span className="info-label">Education Level</span>
              <span className="info-value">{userProfile?.education}</span>
            </div>
            
            <div className="info-item">
              <span className="info-label">Student Status</span>
              <span className={`status-badge ${userProfile?.is_student ? 'status-student' : 'status-not-student'}`}>
                {userProfile?.is_student ? 'Currently a Student' : 'Not a Student'}
              </span>
            </div>
            
            <div className="info-item">
              <span className="info-label">Date of Birth</span>
              <span className="info-value">
                {userProfile?.date_of_birth ? new Date(userProfile.date_of_birth).toLocaleDateString() : 'Not provided'}
              </span>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="info-card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="card-icon">📞</span>
              Contact Information
            </h2>
          </div>
          
          <div className="card-content">
            <div className="info-item info-item-with-icon">
              <span className="info-icon">📧</span>
              <div className="info-content">
                <span className="info-label">Email</span>
                <span className="info-value">{userProfile?.email}</span>
              </div>
            </div>
            
            <div className="info-item info-item-with-icon">
              <span className="info-icon">📱</span>
              <div className="info-content">
                <span className="info-label">Phone </span>
                <span className="info-value">{userProfile?.phone || 'Not provided'}</span>
              </div>
            </div>
            
            <div className="info-item info-item-with-icon">
              <span className="info-icon">🏫</span>
              <div className="info-content">
                <span className="info-label">University </span>
                <span className="info-value">{userProfile?.university || 'Not provided'}</span>
              </div>
            </div>
            
            <div className="info-item info-item-with-icon">
              <span className="info-icon">📍</span>
              <div className="info-content">
                <span className="info-label">City</span>
                <span className="info-value">{userProfile?.city || 'Not provided'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Listings */}
        <div className="info-card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="card-icon">📋</span>
              Recent Listings
            </h2>
            <div className="card-actions">
              <button className="card-action-btn">View All</button>
            </div>
          </div>
          
          <div className="card-content">
            {recentListings.length > 0 ? (
              <div className="listings-list">
                {recentListings.map((listing) => (
                  <div key={listing.id} className="listing-item">
                    <div className="listing-title">{listing.title}</div>
                    <div className="listing-meta">
                      <span className="listing-price">${listing.price}</span>
                      <span className="listing-date">
                        {new Date(listing.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">🛒</span>
                <p className="empty-text">No listings yet</p>
                <button className="empty-action">Create First Listing</button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Messages */}
        <div className="info-card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="card-icon">💬</span>
              Recent Messages
            </h2>
            <div className="card-actions">
              <button className="card-action-btn">View All</button>
            </div>
          </div>
          
          <div className="card-content">
            {recentMessages.length > 0 ? (
              <div className="messages-list">
                {recentMessages.map((message) => (
                  <div 
                    key={message.id} 
                    className={`message-item ${!message.is_read ? 'message-unread' : ''}`}
                    onClick={() => handleMarkAsRead(message.id)}
                  >
                    <div className="message-sender">
                      {message.sender?.profile_picture_url ? (
                        <img 
                          src={message.sender.profile_picture_url} 
                          alt={message.sender.firstname}
                          className="sender-avatar"
                        />
                      ) : (
                        <div className="sender-avatar-placeholder">
                          {message.sender?.firstname?.[0]}
                        </div>
                      )}
                      <div className="sender-info">
                        <div className="sender-name">
                          {message.sender?.firstname} {message.sender?.surname}
                        </div>
                        <div className="message-preview">
                          {message.content.length > 50 
                            ? `${message.content.substring(0, 50)}...` 
                            : message.content}
                        </div>
                      </div>
                    </div>
                    {!message.is_read && (
                      <div className="unread-indicator"></div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">💬</span>
                <p className="empty-text">No messages yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;