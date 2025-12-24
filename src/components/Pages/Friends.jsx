import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './Friends.css';

const Friends = ({ user }) => {
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'following', 'followers'
  const [users, setUsers] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFollowingLoading, setIsFollowingLoading] = useState({});

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all users (except current user)
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('id, firstname, surname, profile_picture_url, university')
        .neq('id', user.id)
        .order('firstname', { ascending: true })
        .limit(100);

      if (usersError) throw usersError;

      // Fetch who current user follows
      const { data: followingData, error: followingError } = await supabase
        .from('user_follows')
        .select('following_id, created_at')
        .eq('follower_id', user.id);

      if (followingError) throw followingError;

      // Fetch who follows current user
      const { data: followersData, error: followersError } = await supabase
        .from('user_follows')
        .select('follower_id, created_at')
        .eq('following_id', user.id);

      if (followersError) throw followersError;

      // Process data
      const followingIds = followingData?.map(f => f.following_id) || [];
      const followerIds = followersData?.map(f => f.follower_id) || [];

      const processedUsers = allUsers?.map(u => ({
        ...u,
        isFollowing: followingIds.includes(u.id),
        isFollower: followerIds.includes(u.id),
        followDate: followingData?.find(f => f.following_id === u.id)?.created_at,
        followerDate: followersData?.find(f => f.follower_id === u.id)?.created_at
      })) || [];

      setUsers(processedUsers);
      setFollowing(followingData || []);
      setFollowers(followersData || []);
      
    } catch (error) {
      console.error('Error fetching friends data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (targetUserId, targetUser) => {
    setIsFollowingLoading(prev => ({ ...prev, [targetUserId]: true }));
    
    try {
      const { error } = await supabase
        .from('user_follows')
        .insert([{
          follower_id: user.id,
          following_id: targetUserId
        }]);

      if (error) throw error;

      // Update local state optimistically
      setUsers(prev => prev.map(u => 
        u.id === targetUserId ? { 
          ...u, 
          isFollowing: true,
          followDate: new Date().toISOString()
        } : u
      ));

      setFollowing(prev => [...prev, { following_id: targetUserId, created_at: new Date().toISOString() }]);
      
      // Show success feedback
      console.log(`Followed ${targetUser.firstname} ${targetUser.surname}`);
      
    } catch (error) {
      console.error('Error following user:', error);
      
      // Revert optimistic update
      setUsers(prev => prev.map(u => 
        u.id === targetUserId ? { ...u, isFollowing: false } : u
      ));
      
      alert('Failed to follow user: ' + error.message);
    } finally {
      setIsFollowingLoading(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  const handleUnfollow = async (targetUserId, targetUser) => {
    setIsFollowingLoading(prev => ({ ...prev, [targetUserId]: true }));
    
    try {
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId);

      if (error) throw error;

      // Update local state optimistically
      setUsers(prev => prev.map(u => 
        u.id === targetUserId ? { ...u, isFollowing: false } : u
      ));

      setFollowing(prev => prev.filter(f => f.following_id !== targetUserId));
      
      // Show success feedback
      console.log(`Unfollowed ${targetUser.firstname} ${targetUser.surname}`);
      
    } catch (error) {
      console.error('Error unfollowing user:', error);
      
      // Revert optimistic update
      setUsers(prev => prev.map(u => 
        u.id === targetUserId ? { ...u, isFollowing: true } : u
      ));
      
      alert('Failed to unfollow user: ' + error.message);
    } finally {
      setIsFollowingLoading(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const getInitials = (firstname, surname) => {
    return `${firstname?.[0] || ''}${surname?.[0] || ''}`.toUpperCase();
  };

  // Filter users based on search and active tab
  const filteredUsers = users.filter(user => {
    const matchesSearch = `${user.firstname} ${user.surname} ${user.university || ''}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (activeTab === 'following') return user.isFollowing;
    if (activeTab === 'followers') return user.isFollower;
    return true;
  });

  if (loading) {
    return (
      <div className="friends-container">
        <div className="loading">Loading connections...</div>
      </div>
    );
  }

  return (
    <div className="friends-container">
      <div className="friends-header">
        <h1>👥 Campus Connections</h1>
        <p>Follow students to see their posts in your feed</p>
      </div>

      {/* Search Bar */}
      <div className="search-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search students by name or university..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
        
        <div className="search-info">
          {searchQuery ? (
            <span className="search-results">
              Found {filteredUsers.length} student{filteredUsers.length !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="total-users">
              {users.length} students on campus
            </span>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="friends-stats">
        <div className="stat-card" onClick={() => setActiveTab('following')}>
          <div className="stat-icon">➕</div>
          <div className="stat-content">
            <div className="stat-number">{following.length}</div>
            <div className="stat-label">Following</div>
          </div>
          <div className="stat-arrow">→</div>
        </div>
        
        <div className="stat-card" onClick={() => setActiveTab('followers')}>
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-number">{followers.length}</div>
            <div className="stat-label">Followers</div>
          </div>
          <div className="stat-arrow">→</div>
        </div>
        
        <div className="stat-card" onClick={() => setActiveTab('all')}>
          <div className="stat-icon">👤</div>
          <div className="stat-content">
            <div className="stat-number">{users.length}</div>
            <div className="stat-label">All Students</div>
          </div>
          <div className="stat-arrow">→</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="friends-tabs">
        <button 
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <span className="tab-icon">👤</span>
          <span className="tab-text">All Students</span>
          <span className="tab-count">{users.length}</span>
        </button>
        
        <button 
          className={`tab-btn ${activeTab === 'following' ? 'active' : ''}`}
          onClick={() => setActiveTab('following')}
        >
          <span className="tab-icon">➕</span>
          <span className="tab-text">Following</span>
          <span className="tab-count">{following.length}</span>
        </button>
        
        <button 
          className={`tab-btn ${activeTab === 'followers' ? 'active' : ''}`}
          onClick={() => setActiveTab('followers')}
        >
          <span className="tab-icon">👥</span>
          <span className="tab-text">Followers</span>
          <span className="tab-count">{followers.length}</span>
        </button>
      </div>

      {/* Users Grid */}
      <div className="users-grid">
        {filteredUsers.length === 0 ? (
          <div className="no-users">
            <div className="no-users-icon">👥</div>
            <h3>No students found</h3>
            <p>Try a different search term or browse all students</p>
            <button 
              className="btn-view-all"
              onClick={() => {
                setSearchQuery('');
                setActiveTab('all');
              }}
            >
              View All Students
            </button>
          </div>
        ) : (
          filteredUsers.map(user => (
            <div key={user.id} className="user-card">
              <div className="user-card-header">
                <div className="user-avatar">
                  {user.profile_picture_url ? (
                    <img src={user.profile_picture_url} alt={user.firstname} />
                  ) : (
                    <div className="avatar-fallback">
                      {getInitials(user.firstname, user.surname)}
                    </div>
                  )}
                </div>
                
                <div className="user-badges">
                  {user.isFollowing && user.isFollower && (
                    <span className="badge mutual">🔄 Mutual</span>
                  )}
                  {user.isFollowing && !user.isFollower && (
                    <span className="badge following">➕ Following</span>
                  )}
                  {!user.isFollowing && user.isFollower && (
                    <span className="badge follower">👥 Follows You</span>
                  )}
                  {!user.isFollowing && !user.isFollower && (
                    <span className="badge new">👋 New</span>
                  )}
                </div>
              </div>
              
              <div className="user-info">
                <h3 className="user-name">
                  {user.firstname} {user.surname}
                </h3>
                {user.university && (
                  <p className="user-university">🎓 {user.university}</p>
                )}
                
                {user.isFollowing && user.followDate && (
                  <p className="user-follow-date">
                    Following since {formatTimeAgo(user.followDate)}
                  </p>
                )}
                
                {user.isFollower && user.followerDate && (
                  <p className="user-follow-date">
                    Followed you {formatTimeAgo(user.followerDate)}
                  </p>
                )}
              </div>
              
              <div className="user-actions">
                {user.isFollowing ? (
                  <button 
                    className={`btn-unfollow ${isFollowingLoading[user.id] ? 'loading' : ''}`}
                    onClick={() => handleUnfollow(user.id, user)}
                    disabled={isFollowingLoading[user.id]}
                  >
                    {isFollowingLoading[user.id] ? (
                      <span className="spinner"></span>
                    ) : (
                      'Unfollow'
                    )}
                  </button>
                ) : (
                  <button 
                    className={`btn-follow ${isFollowingLoading[user.id] ? 'loading' : ''}`}
                    onClick={() => handleFollow(user.id, user)}
                    disabled={isFollowingLoading[user.id]}
                  >
                    {isFollowingLoading[user.id] ? (
                      <span className="spinner"></span>
                    ) : (
                      'Follow'
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Box */}
      <div className="info-box">
        <div className="info-icon">💡</div>
        <div className="info-content">
          <h4>How following works:</h4>
          <ul>
            <li>• Follow anyone to see their posts in your feed</li>
            <li>• No approval needed - follow instantly</li>
            <li>• Use "Friends Only" privacy for posts visible only to followers</li>
            <li>• Follow back to create mutual connections</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Friends;