import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './Friends.css';

const Friends = ({ user }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [users, setUsers] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    if (user) {
      loadFriendsData();
    }
  }, [user]);

  const loadFriendsData = async () => {
    console.log('🔄 Loading friends data...');
    setLoading(true);
    setError(null);
    
    try {
      // First, check if user_follows table exists and has data
      console.log('Checking user_follows table...');
      const { data: followsTest, error: followsError } = await supabase
        .from('user_follows')
        .select('*')
        .limit(1);
      
      if (followsError) {
        console.error('user_follows table error:', followsError);
        setDebugInfo(`Follows table error: ${followsError.message}`);
      } else {
        console.log('user_follows table check:', followsTest?.length || 0, 'rows');
      }

      // Get all users (simplified query)
      console.log('Fetching users...');
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('id, email, raw_user_meta_data')
        .neq('id', user.id)
        .limit(50);

      if (usersError) {
        console.error('Users query error:', usersError);
        throw new Error(`Failed to load users: ${usersError.message}`);
      }

      console.log('Found', allUsers?.length || 0, 'users');

      // Get who I follow
      const { data: followingData } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user.id);

      // Get who follows me
      const { data: followersData } = await supabase
        .from('user_follows')
        .select('follower_id')
        .eq('following_id', user.id);

      // Process users with fallback names
      const processedUsers = (allUsers || []).map(u => {
        const meta = u.raw_user_meta_data || {};
        const emailName = u.email?.split('@')[0] || 'User';
        
        return {
          id: u.id,
          email: u.email,
          firstname: meta.firstname || meta.name || emailName,
          surname: meta.surname || '',
          profile_picture_url: meta.avatar_url || meta.picture || null,
          university: meta.university || null,
          isFollowing: followingData?.some(f => f.following_id === u.id) || false,
          isFollower: followersData?.some(f => f.follower_id === u.id) || false
        };
      });

      setUsers(processedUsers);
      setFollowing(followingData || []);
      setFollowers(followersData || []);
      
      console.log('✅ Data loaded successfully');
      setDebugInfo(`Loaded ${processedUsers.length} users, ${followingData?.length || 0} following, ${followersData?.length || 0} followers`);
      
    } catch (error) {
      console.error('❌ Error in loadFriendsData:', error);
      setError(error.message);
      setDebugInfo(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (targetUserId, targetUser) => {
    console.log(`Following user: ${targetUserId}`);
    
    try {
      const { error } = await supabase
        .from('user_follows')
        .insert([{
          follower_id: user.id,
          following_id: targetUserId
        }]);

      if (error) throw error;

      // Update UI immediately
      setUsers(prev => prev.map(u => 
        u.id === targetUserId ? { ...u, isFollowing: true } : u
      ));
      
      setFollowing(prev => [...prev, { following_id: targetUserId }]);
      
      console.log(`✅ Successfully followed ${targetUser.firstname}`);
      
    } catch (error) {
      console.error('❌ Follow error:', error);
      alert(`Failed to follow: ${error.message}`);
    }
  };

  const handleUnfollow = async (targetUserId, targetUser) => {
    console.log(`Unfollowing user: ${targetUserId}`);
    
    try {
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId);

      if (error) throw error;

      // Update UI immediately
      setUsers(prev => prev.map(u => 
        u.id === targetUserId ? { ...u, isFollowing: false } : u
      ));
      
      setFollowing(prev => prev.filter(f => f.following_id !== targetUserId));
      
      console.log(`✅ Successfully unfollowed ${targetUser.firstname}`);
      
    } catch (error) {
      console.error('❌ Unfollow error:', error);
      alert(`Failed to unfollow: ${error.message}`);
    }
  };

  const runDebugTest = async () => {
    console.clear();
    console.log('=== 🐛 DEBUG TEST START ===');
    
    setDebugInfo('Running debug tests...');
    
    try {
      // Test 1: Check database connection
      console.log('1. Testing database connection...');
      const { data: session } = await supabase.auth.getSession();
      console.log('Session:', session?.user?.id);
      
      // Test 2: Check users table
      console.log('\n2. Checking users table...');
      const { data: usersData } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      console.log('Users count test:', usersData);
      
      // Test 3: Check user_follows table
      console.log('\n3. Checking user_follows table...');
      const { data: followsData } = await supabase
        .from('user_follows')
        .select('*')
        .limit(5);
      console.log('Follows data:', followsData);
      
      // Test 4: Test insert/delete
      console.log('\n4. Testing follow functionality...');
      if (users.length > 0) {
        const testUser = users[0];
        console.log('Test user:', testUser);
        
        // Try to follow
        const { error: followError } = await supabase
          .from('user_follows')
          .insert([{
            follower_id: user.id,
            following_id: testUser.id
          }]);
        
        console.log('Follow test result:', followError ? `Error: ${followError.message}` : 'Success');
        
        if (!followError) {
          // Clean up
          await supabase
            .from('user_follows')
            .delete()
            .eq('follower_id', user.id)
            .eq('following_id', testUser.id);
          console.log('Test follow cleaned up');
        }
      }
      
      console.log('=== ✅ DEBUG TEST COMPLETE ===');
      setDebugInfo('Debug test completed. Check console for details.');
      
    } catch (error) {
      console.error('Debug test failed:', error);
      setDebugInfo(`Debug test failed: ${error.message}`);
    }
  };

  const filteredUsers = users.filter(user => {
    const searchText = `${user.firstname} ${user.surname} ${user.email || ''} ${user.university || ''}`.toLowerCase();
    return searchText.includes(searchQuery.toLowerCase());
  }).filter(user => {
    if (activeTab === 'following') return user.isFollowing;
    if (activeTab === 'followers') return user.isFollower;
    return true;
  });

  const getInitials = (firstname, surname) => {
    return `${firstname?.[0] || ''}${surname?.[0] || ''}`.toUpperCase();
  };

  if (loading && users.length === 0) {
    return (
      <div className="friends-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading campus connections...</p>
          <button className="debug-btn" onClick={runDebugTest}>
            Run Debug Test
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="friends-container">
      {/* Debug Button */}
      <button 
        className="debug-button"
        onClick={runDebugTest}
        title="Click to run debug tests"
      >
        🐛 Debug
      </button>

      <div className="friends-header">
        <h1>👥 Campus Connections</h1>
        <p>Follow students to see their posts in your feed</p>
        {debugInfo && (
          <div className="debug-info">
            <small>{debugInfo}</small>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="search-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="friends-stats">
        <div 
          className={`stat-card ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <div className="stat-icon">👤</div>
          <div className="stat-number">{users.length}</div>
          <div className="stat-label">All Students</div>
        </div>
        
        <div 
          className={`stat-card ${activeTab === 'following' ? 'active' : ''}`}
          onClick={() => setActiveTab('following')}
        >
          <div className="stat-icon">➕</div>
          <div className="stat-number">{following.length}</div>
          <div className="stat-label">Following</div>
        </div>
        
        <div 
          className={`stat-card ${activeTab === 'followers' ? 'active' : ''}`}
          onClick={() => setActiveTab('followers')}
        >
          <div className="stat-icon">👥</div>
          <div className="stat-number">{followers.length}</div>
          <div className="stat-label">Followers</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="friends-tabs">
        <button 
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Students
        </button>
        <button 
          className={`tab-btn ${activeTab === 'following' ? 'active' : ''}`}
          onClick={() => setActiveTab('following')}
        >
          Following ({following.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'followers' ? 'active' : ''}`}
          onClick={() => setActiveTab('followers')}
        >
          Followers ({followers.length})
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <p>⚠️ {error}</p>
          <button onClick={loadFriendsData}>Retry</button>
        </div>
      )}

      {/* Users List */}
      <div className="users-list">
        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No connections found</h3>
            <p>{searchQuery ? 'Try a different search' : 'Start following other students'}</p>
            <button 
              className="refresh-btn"
              onClick={loadFriendsData}
            >
              Refresh List
            </button>
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
                <h4>{user.firstname} {user.surname}</h4>
                <p className="user-email">{user.email}</p>
                {user.university && (
                  <p className="user-university">🎓 {user.university}</p>
                )}
                
                <div className="user-status">
                  {user.isFollowing && user.isFollower && (
                    <span className="status-badge mutual">🔄 Mutual</span>
                  )}
                  {user.isFollowing && !user.isFollower && (
                    <span className="status-badge following">➕ You Follow</span>
                  )}
                  {!user.isFollowing && user.isFollower && (
                    <span className="status-badge follower">👥 Follows You</span>
                  )}
                  {!user.isFollowing && !user.isFollower && (
                    <span className="status-badge new">👋 New</span>
                  )}
                </div>
              </div>
              
              <div className="user-actions">
                {user.isFollowing ? (
                  <button 
                    className="btn-unfollow"
                    onClick={() => handleUnfollow(user.id, user)}
                  >
                    Unfollow
                  </button>
                ) : (
                  <button 
                    className="btn-follow"
                    onClick={() => handleFollow(user.id, user)}
                  >
                    Follow
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Help Info */}
      <div className="help-info">
        <h4>💡 How following works:</h4>
        <ul>
          <li>• Click "Follow" to see someone's posts in your feed</li>
          <li>• No approval needed - follow instantly</li>
          <li>• "Friends Only" posts are visible to followers</li>
          <li>• Check "Following" tab to see who you follow</li>
        </ul>
      </div>
    </div>
  );
};

export default Friends;