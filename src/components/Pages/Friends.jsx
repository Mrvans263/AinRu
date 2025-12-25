import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import './Friends.css';

const Friends = () => {
  // ===== CORE STATES =====
  const [authUser, setAuthUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [friendsState, setFriendsState] = useState({
    users: [],
    following: [],
    followers: [],
    isLoading: true,
    error: null
  });
  
  const [uiState, setUiState] = useState({
    searchQuery: '',
    activeTab: 'all',
    selectedUserId: null,
    operationInProgress: false
  });

  // ===== AUTH MANAGEMENT =====
  useEffect(() => {
    console.log('🔐 [FRIENDS] Initializing auth...');
    
    const initializeAuth = async () => {
      try {
        // 1. Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;
        
        console.log('🔐 [FRIENDS] Session:', session?.user?.id);
        setAuthUser(session?.user || null);
        
        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, newSession) => {
            console.log('🔐 [FRIENDS] Auth state changed:', event);
            setAuthUser(newSession?.user || null);
            
            if (event === 'SIGNED_IN' && newSession?.user) {
              await loadFriendsData(newSession.user.id);
            }
            
            if (event === 'SIGNED_OUT') {
              setFriendsState({
                users: [],
                following: [],
                followers: [],
                isLoading: false,
                error: null
              });
            }
          }
        );
        
        return () => subscription.unsubscribe();
        
      } catch (error) {
        console.error('❌ [FRIENDS] Auth initialization failed:', error);
        setFriendsState(prev => ({
          ...prev,
          error: `Authentication error: ${error.message}`,
          isLoading: false
        }));
      } finally {
        setIsAuthLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // ===== DATA LOADING =====
  const loadFriendsData = useCallback(async (userId) => {
    if (!userId) {
      console.log('⏸️ [FRIENDS] No user ID, skipping load');
      return;
    }
    
    console.log('🔄 [FRIENDS] Loading data for user:', userId);
    
    setFriendsState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Load all three datasets in parallel
      const [
        { data: usersData, error: usersError },
        { data: followingData, error: followingError },
        { data: followersData, error: followersError }
      ] = await Promise.all([
        supabase
          .from('users')
          .select('id, email, firstname, surname, university, profile_picture_url, created_at')
          .neq('id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
        
        supabase
          .from('user_follows')
          .select('following_id, created_at')
          .eq('follower_id', userId),
        
        supabase
          .from('user_follows')
          .select('follower_id, created_at')
          .eq('following_id', userId)
      ]);
      
      // Handle errors
      if (usersError) throw new Error(`Users: ${usersError.message}`);
      if (followingError) throw new Error(`Following: ${followingError.message}`);
      if (followersError) throw new Error(`Followers: ${followersError.message}`);
      
      // Process data
      const followingIds = new Set(followingData?.map(f => f.following_id) || []);
      const followerIds = new Set(followersData?.map(f => f.follower_id) || []);
      
      const processedUsers = (usersData || []).map(user => {
        const isFollowing = followingIds.has(user.id);
        const isFollower = followerIds.has(user.id);
        
        return {
          ...user,
          isFollowing,
          isFollower,
          connectionType: isFollowing && isFollower ? 'mutual' :
                         isFollowing ? 'following' :
                         isFollower ? 'follower' : 'none',
          followDate: followingData?.find(f => f.following_id === user.id)?.created_at,
          followerDate: followersData?.find(f => f.follower_id === user.id)?.created_at
        };
      });
      
      setFriendsState({
        users: processedUsers,
        following: followingData || [],
        followers: followersData || [],
        isLoading: false,
        error: null
      });
      
      console.log('✅ [FRIENDS] Data loaded:', {
        users: processedUsers.length,
        following: followingData?.length,
        followers: followersData?.length
      });
      
    } catch (error) {
      console.error('❌ [FRIENDS] Data load failed:', error);
      setFriendsState(prev => ({
        ...prev,
        isLoading: false,
        error: `Failed to load connections: ${error.message}`
      }));
    }
  }, []);

  // ===== LOAD DATA WHEN USER IS READY =====
  useEffect(() => {
    if (authUser?.id && !isAuthLoading) {
      loadFriendsData(authUser.id);
    }
  }, [authUser, isAuthLoading, loadFriendsData]);

  // ===== FOLLOW/UNFOLLOW OPERATIONS =====
  const handleFollowToggle = async (targetUser) => {
    if (!authUser?.id || uiState.operationInProgress) return;
    
    const isCurrentlyFollowing = targetUser.isFollowing;
    const operation = isCurrentlyFollowing ? 'unfollow' : 'follow';
    
    setUiState(prev => ({ ...prev, operationInProgress: true }));
    
    try {
      // Optimistic update
      setFriendsState(prev => ({
        ...prev,
        users: prev.users.map(user =>
          user.id === targetUser.id
            ? {
                ...user,
                isFollowing: !isCurrentlyFollowing,
                connectionType: !isCurrentlyFollowing
                  ? user.isFollower ? 'mutual' : 'following'
                  : user.isFollower ? 'follower' : 'none'
              }
            : user
        )
      }));
      
      // Perform database operation
      if (isCurrentlyFollowing) {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', authUser.id)
          .eq('following_id', targetUser.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_follows')
          .insert([{
            follower_id: authUser.id,
            following_id: targetUser.id,
            created_at: new Date().toISOString()
          }]);
        
        if (error) {
          // Handle duplicate follows gracefully
          if (error.code === '23505') {
            console.log('Already following this user');
          } else {
            throw error;
          }
        }
      }
      
      // Refresh data
      await loadFriendsData(authUser.id);
      
    } catch (error) {
      console.error(`❌ [FRIENDS] ${operation} failed:`, error);
      
      // Revert optimistic update
      setFriendsState(prev => ({
        ...prev,
        users: prev.users.map(user =>
          user.id === targetUser.id
            ? {
                ...user,
                isFollowing: isCurrentlyFollowing,
                connectionType: isCurrentlyFollowing
                  ? targetUser.isFollower ? 'mutual' : 'following'
                  : targetUser.isFollower ? 'follower' : 'none'
              }
            : user
        )
      }));
      
      // Show error (you can replace with toast notification)
      alert(`${operation} failed: ${error.message}`);
    } finally {
      setUiState(prev => ({ ...prev, operationInProgress: false }));
    }
  };

  // ===== UTILITIES =====
  const getInitials = (firstname, surname) => {
    return `${firstname?.[0] || ''}${surname?.[0] || ''}`.toUpperCase();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // ===== FILTERED DATA =====
  const filteredUsers = useMemo(() => {
    const { searchQuery, activeTab } = uiState;
    const { users } = friendsState;
    
    return users.filter(user => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        user.firstname?.toLowerCase().includes(searchLower) ||
        user.surname?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.university?.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
      
      // Tab filter
      switch (activeTab) {
        case 'following': return user.isFollowing;
        case 'followers': return user.isFollower;
        case 'mutual': return user.isFollowing && user.isFollower;
        default: return true;
      }
    });
  }, [uiState, friendsState.users]);

  // ===== STATS =====
  const stats = useMemo(() => {
    const { users, following, followers } = friendsState;
    
    const mutualCount = users.filter(u => u.isFollowing && u.isFollower).length;
    
    return {
      totalUsers: users.length,
      following: following.length,
      followers: followers.length,
      mutual: mutualCount
    };
  }, [friendsState]);

  // ===== RENDER STATES =====

  // Auth loading
  if (isAuthLoading) {
    return (
      <div className="friends-container">
        <div className="loading-state">
          <div className="loading-spinner large"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  // No auth
  if (!authUser) {
    return (
      <div className="friends-container">
        <div className="auth-required">
          <h3>🔒 Sign In Required</h3>
          <p>Please sign in to view campus connections</p>
          <button 
            className="auth-btn"
            onClick={() => window.location.href = '/login'}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  // Data loading
  if (friendsState.isLoading) {
    return (
      <div className="friends-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading campus network...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (friendsState.error) {
    return (
      <div className="friends-container">
        <div className="error-state">
          <h3>⚠️ Connection Error</h3>
          <p>{friendsState.error}</p>
          <button 
            className="retry-btn"
            onClick={() => loadFriendsData(authUser.id)}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ===== MAIN RENDER =====
  return (
    <div className="friends-container">
      {/* Header */}
      <div className="friends-header">
        <h1 className="friends-title">Campus Network</h1>
        <p className="friends-subtitle">
          Connect with {stats.totalUsers} students on campus
        </p>
        
        {/* User info */}
        <div className="current-user-info">
          <div className="user-avatar small">
            {authUser.user_metadata?.avatar_url ? (
              <img src={authUser.user_metadata.avatar_url} alt="You" />
            ) : (
              <div className="avatar-fallback">
                {getInitials(
                  authUser.user_metadata?.firstname,
                  authUser.user_metadata?.surname
                )}
              </div>
            )}
          </div>
          <div className="user-details">
            <div className="user-name">
              {authUser.user_metadata?.firstname || 'User'} {authUser.user_metadata?.surname || ''}
            </div>
            <div className="user-stats">
              <span className="stat-item">{stats.following} Following</span>
              <span className="stat-divider">•</span>
              <span className="stat-item">{stats.followers} Followers</span>
              <span className="stat-divider">•</span>
              <span className="stat-item">{stats.mutual} Mutual</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div 
          className={`stat-card ${uiState.activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setUiState(prev => ({ ...prev, activeTab: 'all' }))}
        >
          <div className="stat-icon">👤</div>
          <div className="stat-number">{stats.totalUsers}</div>
          <div className="stat-label">All Students</div>
        </div>
        
        <div 
          className={`stat-card ${uiState.activeTab === 'following' ? 'active' : ''}`}
          onClick={() => setUiState(prev => ({ ...prev, activeTab: 'following' }))}
        >
          <div className="stat-icon">➕</div>
          <div className="stat-number">{stats.following}</div>
          <div className="stat-label">Following</div>
        </div>
        
        <div 
          className={`stat-card ${uiState.activeTab === 'followers' ? 'active' : ''}`}
          onClick={() => setUiState(prev => ({ ...prev, activeTab: 'followers' }))}
        >
          <div className="stat-icon">👥</div>
          <div className="stat-number">{stats.followers}</div>
          <div className="stat-label">Followers</div>
        </div>
        
        <div 
          className={`stat-card ${uiState.activeTab === 'mutual' ? 'active' : ''}`}
          onClick={() => setUiState(prev => ({ ...prev, activeTab: 'mutual' }))}
        >
          <div className="stat-icon">🔄</div>
          <div className="stat-number">{stats.mutual}</div>
          <div className="stat-label">Mutual</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-container">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, email, or university..."
            value={uiState.searchQuery}
            onChange={(e) => setUiState(prev => ({ ...prev, searchQuery: e.target.value }))}
          />
          <span className="search-icon">🔍</span>
        </div>
        
        {uiState.searchQuery && (
          <div className="search-results-info">
            Found {filteredUsers.length} of {stats.totalUsers} students
          </div>
        )}
      </div>

      {/* Users List */}
      <div className="users-grid">
        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No connections found</h3>
            <p>
              {uiState.searchQuery 
                ? 'Try a different search term'
                : uiState.activeTab === 'following'
                ? "You're not following anyone yet"
                : uiState.activeTab === 'followers'
                ? 'No one is following you yet'
                : 'No students found'
              }
            </p>
            {uiState.searchQuery && (
              <button
                className="clear-search-btn"
                onClick={() => setUiState(prev => ({ ...prev, searchQuery: '' }))}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          filteredUsers.map(user => (
            <div key={user.id} className="user-card">
              <div className="user-card-header">
                <div className="user-avatar">
                  {user.profile_picture_url ? (
                    <img src={user.profile_picture_url} alt={`${user.firstname} ${user.surname}`} />
                  ) : (
                    <div className="avatar-fallback">
                      {getInitials(user.firstname, user.surname)}
                    </div>
                  )}
                  
                  {user.connectionType === 'mutual' && (
                    <div className="connection-badge mutual" title="Mutual Connection">
                      🔄
                    </div>
                  )}
                </div>
                
                <div className="user-badges">
                  {user.connectionType === 'mutual' && (
                    <span className="badge badge-mutual">Mutual</span>
                  )}
                  {user.connectionType === 'following' && (
                    <span className="badge badge-following">Following</span>
                  )}
                  {user.connectionType === 'follower' && (
                    <span className="badge badge-follower">Follows You</span>
                  )}
                  {user.university && (
                    <span className="badge badge-university">{user.university}</span>
                  )}
                </div>
              </div>
              
              <div className="user-info">
                <h3 className="user-name">
                  {user.firstname} {user.surname}
                </h3>
                <p className="user-email">{user.email}</p>
                
                {user.created_at && (
                  <div className="user-meta">
                    <span className="meta-item">
                      Joined {formatDate(user.created_at)}
                    </span>
                  </div>
                )}
                
                {(user.followDate || user.followerDate) && (
                  <div className="connection-info">
                    {user.followDate && (
                      <span className="connection-item">
                        You followed {formatDate(user.followDate)}
                      </span>
                    )}
                    {user.followerDate && (
                      <span className="connection-item">
                        Followed you {formatDate(user.followerDate)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              <div className="user-actions">
                <button
                  className={`action-btn ${
                    user.isFollowing ? 'btn-unfollow' : 'btn-follow'
                  } ${uiState.operationInProgress ? 'loading' : ''}`}
                  onClick={() => handleFollowToggle(user)}
                  disabled={uiState.operationInProgress}
                >
                  {uiState.operationInProgress ? (
                    <span className="btn-spinner"></span>
                  ) : user.isFollowing ? (
                    'Unfollow'
                  ) : (
                    'Follow'
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Panel */}
      <div className="info-panel">
        <h4>💡 How Following Works</h4>
        <ul>
          <li><strong>Follow someone</strong> to see their posts in your feed</li>
          <li><strong>Mutual connections</strong> can see each other's "Friends Only" posts</li>
          <li><strong>Followers</strong> can see your public and friends-only posts</li>
          <li><strong>Search</strong> for students by name, email, or university</li>
        </ul>
      </div>

      {/* Debug Info (remove in production) */}
      <div className="debug-info">
        <small>
          User: {authUser.id.slice(0, 8)}... | 
          Loaded: {stats.totalUsers} users | 
          Active: {uiState.activeTab} | 
          Search: "{uiState.searchQuery}"
        </small>
      </div>
    </div>
  );
};

export default Friends;