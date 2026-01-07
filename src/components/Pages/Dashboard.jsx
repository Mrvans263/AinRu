import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Loading from '../Common/Loading';
import './Dashboard.css';

const Dashboard = ({ user }) => {
  const [dashboardData, setDashboardData] = useState({
    userProfile: null,
    stats: {
      activeListings: 0,
      totalListings: 0,
      unreadMessages: 0,
      totalMessages: 0,
      friends: 0,
      pendingFriends: 0,
      upcomingEvents: 0,
      eventsAttending: 0,
      marketplaceItems: 0,
      travelDeals: 0,
      moneyDeals: 0,
      feedPosts: 0,
      postLikes: 0,
      savedListings: 0
    },
    activityData: {
      todayListings: 0,
      responseRate: 85,
      totalViews: 0,
      savesReceived: 0,
      engagementRate: 0,
      newFollowers: 0
    },
    recentListings: [],
    recentMessages: [],
    upcomingEvents: [],
    feedPosts: [],
    savedListings: [],
    marketplaceItems: [],
    notifications: []
  });
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (user) {
      initializeDashboard();
    }
  }, [user]);

  const initializeDashboard = async () => {
    try {
      console.log('🔄 Initializing dashboard...');
      setLoading(true);
      
      // Fetch user profile first
      const userProfile = await fetchUserProfile();
      
      // Fetch basic stats
      const statsData = await fetchBasicStats();
      
      // Set initial data
      setDashboardData(prev => ({
        ...prev,
        userProfile,
        stats: statsData
      }));
      
      setLoading(false);
      console.log('✅ Dashboard basic data loaded');
      
      // Load additional data in background
      loadAdditionalData();
      
    } catch (error) {
      console.error('❌ Error initializing dashboard:', error);
      setLoading(false);
    }
  };

  const loadAdditionalData = async () => {
    try {
      console.log('🔄 Loading additional data...');
      
      const [
        recentListings,
        recentMessages,
        upcomingEvents,
        feedPosts
      ] = await Promise.all([
        fetchRecentListings(),
        fetchRecentMessages(),
        fetchUpcomingEvents(),
        fetchFeedPosts()
      ]);

      setDashboardData(prev => ({
        ...prev,
        recentListings,
        recentMessages,
        upcomingEvents,
        feedPosts
      }));

      console.log('✅ Additional data loaded');
      
    } catch (error) {
      console.error('❌ Error loading additional data:', error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        profileCompletion: calculateProfileCompletion(data)
      };
      
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  const calculateProfileCompletion = (profile) => {
    if (!profile) return 0;
    let score = 0;
    if (profile.firstname) score += 15;
    if (profile.surname) score += 15;
    if (profile.profile_picture_url) score += 15;
    if (profile.university) score += 15;
    if (profile.bio) score += 10;
    if (profile.interests && profile.interests.length > 0) score += 10;
    if (profile.year_of_study) score += 10;
    if (profile.education) score += 10;
    return Math.min(score, 100);
  };

  const fetchBasicStats = async () => {
    try {
      const [
        { count: activeListings },
        { count: totalListings },
        { data: conversations },
        { count: totalMessages },
        { count: friends }
      ] = await Promise.all([
        supabase
          .from('marketplace_listings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'active'),
        
        supabase
          .from('marketplace_listings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        
        supabase
          .from('conversation_participants')
          .select('unread_count')
          .eq('user_id', user.id),
        
        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', user.id),
        
        supabase
          .from('friends')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'accepted')
      ]);

      // Calculate unread messages
      let unreadMessagesTotal = 0;
      if (conversations) {
        unreadMessagesTotal = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
      }

      return {
        activeListings: activeListings || 0,
        totalListings: totalListings || 0,
        unreadMessages: unreadMessagesTotal,
        totalMessages: totalMessages || 0,
        friends: friends || 0,
        pendingFriends: 0,
        upcomingEvents: 0,
        eventsAttending: 0,
        marketplaceItems: 0,
        travelDeals: 0,
        moneyDeals: 0,
        feedPosts: 0,
        postLikes: 0,
        savedListings: 0
      };
      
    } catch (error) {
      console.error('Error fetching stats:', error);
      return dashboardData.stats;
    }
  };

  const fetchRecentListings = async () => {
    try {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('id, title, price, description, created_at, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      return data || [];
      
    } catch (error) {
      console.error('Error fetching listings:', error);
      return [];
    }
  };

  const fetchRecentMessages = async () => {
    try {
      // Simple query to get conversations
      const { data: participants, error } = await supabase
        .from('conversation_participants')
        .select('conversation_id, unread_count')
        .eq('user_id', user.id)
        .limit(3);

      if (error) throw error;

      if (!participants || participants.length === 0) return [];

      const conversationIds = participants.map(p => p.conversation_id);
      
      const { data: convs, error: convsError } = await supabase
        .from('conversations')
        .select('id, last_message_at, last_message_preview, is_group, group_name')
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false })
        .limit(3);

      if (convsError) throw convsError;

      return (convs || []).map(conv => ({
        id: conv.id,
        unread: participants.find(p => p.conversation_id === conv.id)?.unread_count > 0,
        content: conv.last_message_preview || 'No messages',
        sender: null,
        created_at: conv.last_message_at,
        isGroup: conv.is_group,
        groupName: conv.group_name
      }));
      
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  };

  const fetchUpcomingEvents = async () => {
    try {
      // Simple events query
      const { data: events, error } = await supabase
        .from('events')
        .select('id, title, event_date, location')
        .gt('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(3);

      if (error) throw error;

      return (events || []).map(event => ({
        ...event,
        status: 'going',
        daysUntil: Math.ceil((new Date(event.event_date) - new Date()) / (1000 * 60 * 60 * 24))
      }));
      
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  };

  const fetchFeedPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('feed_posts')
        .select('id, content, created_at, like_count, comment_count')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(2);

      if (error) throw error;
      
      return data || [];
      
    } catch (error) {
      console.error('Error fetching feed posts:', error);
      return [];
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    initializeDashboard();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return '0';
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  // UI Components
  const StatCard = ({ icon, value, label, color }) => (
    <div className={`stat-card stat-card-${color}`}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-content">
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
      </div>
    </div>
  );

  const ProgressRing = ({ percentage, size = 60, strokeWidth = 6 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (Math.min(percentage, 100) / 100) * circumference;

    return (
      <div className="progress-ring">
        <svg width={size} height={size}>
          <circle
            className="progress-ring-background"
            strokeWidth={strokeWidth}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            className="progress-ring-foreground"
            strokeWidth={strokeWidth}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            style={{
              strokeDasharray: `${circumference} ${circumference}`,
              strokeDashoffset,
            }}
          />
        </svg>
        <div className="progress-ring-text">
          <div className="progress-ring-percentage">{Math.min(percentage, 100)}%</div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <Loading message="Loading your dashboard..." />;
  }

  const { userProfile, stats, activityData } = dashboardData;

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-header-content">
          <div className="dashboard-header-left">
            {userProfile?.profile_picture_url ? (
              <img 
                src={userProfile.profile_picture_url} 
                alt="Profile"
                className="dashboard-profile-avatar-lg"
              />
            ) : (
              <div className="dashboard-profile-avatar-placeholder">
                {userProfile?.firstname?.[0] || 'U'}{userProfile?.surname?.[0] || 'S'}
              </div>
            )}
            <div className="dashboard-header-info">
              <h1 className="dashboard-welcome-text">
                Welcome back, <span className="dashboard-highlight">{userProfile?.firstname || 'User'}</span>!
              </h1>
              <p className="dashboard-user-email">{userProfile?.email || ''}</p>
              <div className="dashboard-user-meta">
                <span className="dashboard-meta-item">
                  <span className="dashboard-meta-icon">🎓</span>
                  {userProfile?.university || 'No university set'}
                </span>
                <span className="dashboard-meta-item">
                  <span className="dashboard-meta-icon">📍</span>
                  {userProfile?.city || 'No location set'}
                </span>
              </div>
            </div>
          </div>
          <div className="dashboard-header-right">
            <button 
              onClick={handleRefresh}
              className="dashboard-refresh-btn"
              title="Refresh dashboard"
            >
              <span className="dashboard-refresh-icon">↻</span>
              Refresh
            </button>
            <div className="profile-completion-small">
              <div className="completion-text">Profile: {userProfile?.profileCompletion || 0}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="dashboard-tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={`tab-btn ${activeTab === 'marketplace' ? 'active' : ''}`}
          onClick={() => setActiveTab('marketplace')}
        >
          🛍️ Marketplace
        </button>
        <button 
          className={`tab-btn ${activeTab === 'social' ? 'active' : ''}`}
          onClick={() => setActiveTab('social')}
        >
          👥 Social
        </button>
      </div>

      {/* Main Content - Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Stats Grid */}
          <div className="dashboard-stats-grid">
            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon dashboard-stat-icon-blue">🛒</div>
              <div className="dashboard-stat-content">
                <div className="dashboard-stat-value">{stats.activeListings}</div>
                <div className="dashboard-stat-label">Active Listings</div>
                <div className="dashboard-stat-subtext">{stats.totalListings} total</div>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon dashboard-stat-icon-purple">💬</div>
              <div className="dashboard-stat-content">
                <div className="dashboard-stat-value">{stats.unreadMessages}</div>
                <div className="dashboard-stat-label">Unread Messages</div>
                <div className="dashboard-stat-subtext">{stats.totalMessages} sent</div>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon dashboard-stat-icon-green">👥</div>
              <div className="dashboard-stat-content">
                <div className="dashboard-stat-value">{stats.friends}</div>
                <div className="dashboard-stat-label">Friends</div>
                <div className="dashboard-stat-subtext">{stats.pendingFriends} pending</div>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon dashboard-stat-icon-orange">📅</div>
              <div className="dashboard-stat-content">
                <div className="dashboard-stat-value">{stats.eventsAttending}</div>
                <div className="dashboard-stat-label">Events</div>
                <div className="dashboard-stat-subtext">{stats.upcomingEvents} upcoming</div>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon dashboard-stat-icon-red">📝</div>
              <div className="dashboard-stat-content">
                <div className="dashboard-stat-value">{stats.feedPosts}</div>
                <div className="dashboard-stat-label">Feed Posts</div>
                <div className="dashboard-stat-subtext">{stats.postLikes} likes</div>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon dashboard-stat-icon-teal">⭐</div>
              <div className="dashboard-stat-content">
                <div className="dashboard-stat-value">{stats.savedListings}</div>
                <div className="dashboard-stat-label">Saved Items</div>
                <div className="dashboard-stat-subtext">Watchlist</div>
              </div>
            </div>
          </div>

          {/* Dashboard Content Grid */}
          <div className="dashboard-content">
            {/* Left Column */}
            <div className="dashboard-left">
              {/* Recent Listings */}
              <div className="dashboard-info-card">
                <div className="dashboard-card-header">
                  <h2 className="dashboard-card-title">
                    <span className="dashboard-card-icon">🛍️</span>
                    Recent Listings
                  </h2>
                </div>
                
                <div className="dashboard-card-content">
                  {dashboardData.recentListings.length > 0 ? (
                    <div className="dashboard-listings-list">
                      {dashboardData.recentListings.map((listing) => (
                        <div key={listing.id} className="dashboard-listing-item">
                          <div className="dashboard-listing-info">
                            <h4 className="dashboard-listing-title">{listing.title}</h4>
                            <p className="dashboard-listing-description">
                              {listing.description?.substring(0, 100)}...
                            </p>
                            <div className="dashboard-listing-meta">
                              <span className="dashboard-listing-price">
                                {formatCurrency(listing.price)}
                              </span>
                              <span className="dashboard-listing-date">
                                {formatDate(listing.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="dashboard-empty-state">
                      <span className="dashboard-empty-icon">📦</span>
                      <p className="dashboard-empty-text">No active listings</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Feed Posts */}
              {dashboardData.feedPosts.length > 0 && (
                <div className="dashboard-info-card">
                  <div className="dashboard-card-header">
                    <h2 className="dashboard-card-title">
                      <span className="dashboard-card-icon">📝</span>
                      Your Recent Posts
                    </h2>
                  </div>
                  
                  <div className="dashboard-card-content">
                    <div className="dashboard-posts-list">
                      {dashboardData.feedPosts.map((post) => (
                        <div key={post.id} className="dashboard-post-item">
                          <div className="dashboard-post-content">
                            <p className="dashboard-post-text">{post.content?.substring(0, 150)}...</p>
                            <div className="dashboard-post-meta">
                              <span className="dashboard-post-date">{formatDate(post.created_at)}</span>
                              <span className="dashboard-post-stats">
                                {post.like_count || 0} likes • {post.comment_count || 0} comments
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="dashboard-right">
              {/* Recent Messages */}
              <div className="dashboard-info-card">
                <div className="dashboard-card-header">
                  <h2 className="dashboard-card-title">
                    <span className="dashboard-card-icon">💬</span>
                    Recent Conversations
                  </h2>
                </div>
                
                <div className="dashboard-card-content">
                  {dashboardData.recentMessages.length > 0 ? (
                    <div className="dashboard-conversations-list">
                      {dashboardData.recentMessages.map((message) => (
                        <div key={message.id} className={`dashboard-conversation-item ${message.unread ? 'dashboard-conversation-unread' : ''}`}>
                          <div className="dashboard-conversation-avatar">
                            <div className="dashboard-avatar-fallback">
                              {message.sender?.firstname?.[0] || 'U'}
                            </div>
                          </div>
                          <div className="dashboard-conversation-content">
                            <div className="dashboard-conversation-header">
                              <span className="dashboard-conversation-name">
                                {message.isGroup ? message.groupName || 'Group' : 
                                 `${message.sender?.firstname || 'User'} ${message.sender?.surname || ''}`}
                              </span>
                              <span className="dashboard-conversation-time">
                                {formatDate(message.created_at)}
                              </span>
                            </div>
                            <p className="dashboard-conversation-preview">{message.content}</p>
                          </div>
                          {message.unread && <div className="dashboard-unread-dot"></div>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="dashboard-empty-state">
                      <span className="dashboard-empty-icon">💬</span>
                      <p className="dashboard-empty-text">No conversations yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Upcoming Events */}
              <div className="dashboard-info-card">
                <div className="dashboard-card-header">
                  <h2 className="dashboard-card-title">
                    <span className="dashboard-card-icon">📅</span>
                    Upcoming Events
                  </h2>
                </div>
                
                <div className="dashboard-card-content">
                  {dashboardData.upcomingEvents.length > 0 ? (
                    <div className="dashboard-events-list">
                      {dashboardData.upcomingEvents.map((event) => (
                        <div key={event.id} className="dashboard-event-item">
                          <div className="dashboard-event-date">
                            <div className="dashboard-event-day">
                              {new Date(event.event_date).getDate()}
                            </div>
                            <div className="dashboard-event-month">
                              {new Date(event.event_date).toLocaleString('default', { month: 'short' })}
                            </div>
                          </div>
                          <div className="dashboard-event-details">
                            <h4 className="dashboard-event-title">{event.title}</h4>
                            <p className="dashboard-event-location">{event.location || 'No location'}</p>
                            <p className="dashboard-event-days">
                              In {event.daysUntil} day{event.daysUntil !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="dashboard-empty-state">
                      <span className="dashboard-empty-icon">📅</span>
                      <p className="dashboard-empty-text">No upcoming events</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Marketplace Tab */}
      {activeTab === 'marketplace' && (
        <div className="marketplace-tab">
          <div className="dashboard-info-card">
            <div className="dashboard-card-header">
              <h2 className="dashboard-card-title">
                <span className="dashboard-card-icon">🏪</span>
                Marketplace Overview
              </h2>
            </div>
            <div className="dashboard-card-content">
              <div className="marketplace-stats-simple">
                <div className="marketplace-stat-item">
                  <div className="marketplace-stat-value">{stats.activeListings}</div>
                  <div className="marketplace-stat-label">Active Listings</div>
                </div>
                <div className="marketplace-stat-item">
                  <div className="marketplace-stat-value">{formatCurrency(stats.activeListings * 100)}</div>
                  <div className="marketplace-stat-label">Total Value</div>
                </div>
                <div className="marketplace-stat-item">
                  <div className="marketplace-stat-value">{activityData.totalViews}</div>
                  <div className="marketplace-stat-label">Total Views</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Social Tab */}
      {activeTab === 'social' && (
        <div className="social-tab">
          <div className="dashboard-info-card">
            <div className="dashboard-card-header">
              <h2 className="dashboard-card-title">
                <span className="dashboard-card-icon">👥</span>
                Social Activity
              </h2>
            </div>
            <div className="dashboard-card-content">
              <div className="social-stats-simple">
                <div className="social-stat-item">
                  <div className="social-stat-value">{stats.friends}</div>
                  <div className="social-stat-label">Friends</div>
                </div>
                <div className="social-stat-item">
                  <div className="social-stat-value">{stats.feedPosts}</div>
                  <div className="social-stat-label">Posts</div>
                </div>
                <div className="social-stat-item">
                  <div className="social-stat-value">{stats.postLikes}</div>
                  <div className="social-stat-label">Likes Received</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;