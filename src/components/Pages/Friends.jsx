import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import './Friends.css';

const Friends = ({ currentUser }) => {
  // Debug logging
  console.log('🔍 Friends component rendering with user:', currentUser?.id);
  
  const [state, setState] = useState({
    users: [],
    loading: true,
    searchQuery: '',
    activeTab: 'all',
    error: null,
    stats: {
      totalUsers: 0,
      followers: 0,
      following: 0,
      mutual: 0
    }
  });

  // Safely load data only when user is available
  const loadFriendsData = useCallback(async () => {
    console.log('🔄 Loading friends data for user:', currentUser?.id);
    
    if (!currentUser?.id) {
      console.log('⚠️ No user ID, skipping load');
      setState(prev => ({ ...prev, loading: false, error: 'Please log in first' }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // 1. Get all users (except current user)
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, firstname, surname, university, profile_picture_url, created_at')
        .neq('id', currentUser.id)
        .order('created_at', { ascending: false });

      if (usersError) throw new Error(`Failed to load users: ${usersError.message}`);

      // 2. Get who current user follows
      const { data: following, error: followingError } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', currentUser.id);

      if (followingError) throw new Error(`Failed to load following: ${followingError.message}`);

      // 3. Get who follows current user
      const { data: followers, error: followersError } = await supabase
        .from('user_follows')
        .select('follower_id')
        .eq('following_id', currentUser.id);

      if (followersError) throw new Error(`Failed to load followers: ${followersError.message}`);

      // Process the data
      const followingIds = new Set(following?.map(f => f.following_id) || []);
      const followerIds = new Set(followers?.map(f => f.follower_id) || []);
      
      let mutualCount = 0;
      const processedUsers = users.map(user => {
        const isFollowing = followingIds.has(user.id);
        const isFollower = followerIds.has(user.id);
        
        if (isFollowing && isFollower) mutualCount++;
        
        return {
          ...user,
          isFollowing,
          isFollower,
          connectionType: isFollowing && isFollower ? 'mutual' :
                         isFollowing ? 'following' :
                         isFollower ? 'follower' : 'none'
        };
      });

      setState(prev => ({
        ...prev,
        users: processedUsers,
        loading: false,
        stats: {
          totalUsers: processedUsers.length,
          following: following?.length || 0,
          followers: followers?.length || 0,
          mutual: mutualCount
        }
      }));

      console.log('✅ Loaded:', {
        users: processedUsers.length,
        following: following?.length,
        followers: followers?.length,
        mutual: mutualCount
      });

    } catch (error) {
      console.error('❌ Failed to load friends data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  }, [currentUser]);

  // Load data when component mounts AND when user changes
  useEffect(() => {
    const timer = setTimeout(() => {
      loadFriendsData();
    }, 100); // Small delay to ensure user prop is stable
    
    return () => clearTimeout(timer);
  }, [currentUser?.id, loadFriendsData]);

  // Handle follow/unfollow
  const handleFollowToggle = async (targetUser) => {
    if (!currentUser?.id) {
      alert('Please log in first');
      return;
    }

    const isCurrentlyFollowing = targetUser.isFollowing;
    
    try {
      if (isCurrentlyFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', targetUser.id);

        if (error) throw error;
      } else {
        // Follow
        const { error } = await supabase
          .from('user_follows')
          .insert([{
            follower_id: currentUser.id,
            following_id: targetUser.id
          }]);

        if (error) {
          // Check if it's a unique constraint violation (already following)
          if (error.code === '23505') {
            console.log('Already following this user');
          } else {
            throw error;
          }
        }
      }

      // Reload data to get fresh state
      await loadFriendsData();

    } catch (error) {
      console.error('❌ Follow toggle failed:', error);
      alert(`Operation failed: ${error.message}`);
    }
  };

  // Filter users based on search and active tab
  const filteredUsers = state.users.filter(user => {
    // Search filter
    const searchLower = state.searchQuery.toLowerCase();
    const matchesSearch = 
      user.firstname?.toLowerCase().includes(searchLower) ||
      user.surname?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.university?.toLowerCase().includes(searchLower);
    
    if (!matchesSearch) return false;
    
    // Tab filter
    switch (state.activeTab) {
      case 'following':
        return user.isFollowing;
      case 'followers':
        return user.isFollower;
      case 'mutual':
        return user.isFollowing && user.isFollower;
      default:
        return true;
    }
  });

  // Helper functions
  const getInitials = (firstname, surname) => {
    return `${firstname?.[0] || ''}${surname?.[0] || ''}`.toUpperCase();
  };

  // Render loading state
  if (!currentUser) {
    return (
      <div className="friends-container">
        <div className="auth-required">
          <h3>🔒 Authentication Required</h3>
          <p>Please log in to view campus connections</p>
        </div>
      </div>
    );
  }

  if (state.loading) {
    return (
      <div className="friends-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading campus network...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="friends-container">
        <div className="error-state">
          <h3>⚠️ Error Loading Connections</h3>
          <p>{state.error}</p>
          <button onClick={loadFriendsData} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="friends-container">
      {/* Header */}
      <div className="friends-header">
        <h1>👥 Campus Connections</h1>
        <p>Connect with fellow students</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div 
          className={`stat-card ${state.activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, activeTab: 'all' }))}
        >
          <div className="stat-number">{state.stats.totalUsers}</div>
          <div className="stat-label">All Students</div>
        </div>
        
        <div 
          className={`stat-card ${state.activeTab === 'following' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, activeTab: 'following' }))}
        >
          <div className="stat-number">{state.stats.following}</div>
          <div className="stat-label">Following</div>
        </div>
        
        <div 
          className={`stat-card ${state.activeTab === 'followers' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, activeTab: 'followers' }))}
        >
          <div className="stat-number">{state.stats.followers}</div>
          <div className="stat-label">Followers</div>
        </div>
        
        <div 
          className={`stat-card ${state.activeTab === 'mutual' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, activeTab: 'mutual' }))}
        >
          <div className="stat-number">{state.stats.mutual}</div>
          <div className="stat-label">Mutual</div>
        </div>
      </div>

      {/* Search */}
      <div className="search-box">
        <input
          type="text"
          placeholder="Search students..."
          value={state.searchQuery}
          onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
          className="search-input"
        />
      </div>

      {/* Users List */}
      <div className="users-list">
        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No connections found</h3>
            <p>
              {state.searchQuery 
                ? 'Try a different search term' 
                : 'Start following other students to build your network'
              }
            </p>
          </div>
        ) : (
          filteredUsers.map(user => (
            <div key={user.id} className="user-card">
              <div className="user-avatar">
                {user.profile_picture_url ? (
                  <img src={user.profile_picture_url} alt={user.firstname} />
                ) : (
                  <div className="avatar-fallback">
                    {getInitials(user.firstname, user.surname)}
                  </div>
                )}
              </div>
              
              <div className="user-info">
                <h4 className="user-name">
                  {user.firstname} {user.surname}
                </h4>
                <p className="user-email">{user.email}</p>
                {user.university && (
                  <p className="user-university">🎓 {user.university}</p>
                )}
                
                <div className="user-status">
                  {user.connectionType === 'mutual' && (
                    <span className="status-badge mutual">🔄 Mutual Connection</span>
                  )}
                  {user.connectionType === 'following' && (
                    <span className="status-badge following">➕ You Follow</span>
                  )}
                  {user.connectionType === 'follower' && (
                    <span className="status-badge follower">👥 Follows You</span>
                  )}
                  {user.connectionType === 'none' && (
                    <span className="status-badge new">👋 Not Connected</span>
                  )}
                </div>
              </div>
              
              <div className="user-actions">
                <button
                  className={user.isFollowing ? 'btn-unfollow' : 'btn-follow'}
                  onClick={() => handleFollowToggle(user)}
                >
                  {user.isFollowing ? 'Unfollow' : 'Follow'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Friends;