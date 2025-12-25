import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Loading from '../Common/Loading';
import './Dashboard.css';

const Dashboard = ({ user }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
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
  });
  const [recentListings, setRecentListings] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [feedPosts, setFeedPosts] = useState([]);
  const [savedListings, setSavedListings] = useState([]);
  const [marketplaceItems, setMarketplaceItems] = useState([]);

  useEffect(() => {
    if (user) {
      initializeDashboard();
    }
  }, [user]);

  const initializeDashboard = async () => {
    try {
      console.log('🔄 Initializing dashboard for user:', user.id);
      
      // Fetch all data in parallel
      await Promise.all([
        fetchUserProfile(),
        fetchAllStats(),
        fetchRecentListings(),
        fetchRecentMessages(),
        fetchUpcomingEvents(),
        fetchFeedPosts(),
        fetchSavedListings(),
        fetchMarketplaceItems()
      ]);
      
    } catch (error) {
      console.error('❌ Error initializing dashboard:', error);
    } finally {
      setLoading(false);
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
      
      setUserProfile(data);
      console.log('✅ User profile loaded:', data.email);
      
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchAllStats = async () => {
    try {
      // Fetch all stats in parallel
      const [
        { count: activeListings },
        { count: totalListings },
        { count: unreadMessages },
        { count: totalMessages },
        { count: friends },
        { count: pendingFriends },
        { count: upcomingEvents },
        { count: eventsAttending },
        { count: marketplaceItems },
        { count: travelDeals },
        { count: moneyDeals },
        { count: feedPosts },
        { count: postLikes },
        { count: savedListings }
      ] = await Promise.all([
        // Active listings
        supabase
          .from('listings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_active', true),
        
        // Total listings
        supabase
          .from('listings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        
        // Unread messages (using conversation logic)
        supabase
          .from('conversation_participants')
          .select('unread_count', { count: 'exact', head: true })
          .eq('user_id', user.id),
        
        // Total messages sent
        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', user.id),
        
        // Friends (accepted)
        supabase
          .from('friends')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'accepted'),
        
        // Pending friend requests
        supabase
          .from('friends')
          .select('*', { count: 'exact', head: true })
          .eq('friend_id', user.id)
          .eq('status', 'pending'),
        
        // Upcoming events
        supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .gt('event_date', new Date().toISOString()),
        
        // Events user is attending
        supabase
          .from('event_attendees')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'going'),
        
        // Marketplace items
        supabase
          .from('marketplace_items')
          .select('*', { count: 'exact', head: true }),
        
        // Travel deals
        supabase
          .from('travel_deals')
          .select('*', { count: 'exact', head: true }),
        
        // Money deals
        supabase
          .from('money_deals')
          .select('*', { count: 'exact', head: true }),
        
        // Feed posts
        supabase
          .from('feed_posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        
        // Post likes received
        supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_owner_id', user.id),
        
        // Saved listings
        supabase
          .from('saved_listings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
      ]);

      setStats({
        activeListings: activeListings || 0,
        totalListings: totalListings || 0,
        unreadMessages: unreadMessages || 0,
        totalMessages: totalMessages || 0,
        friends: friends || 0,
        pendingFriends: pendingFriends || 0,
        upcomingEvents: upcomingEvents || 0,
        eventsAttending: eventsAttending || 0,
        marketplaceItems: marketplaceItems || 0,
        travelDeals: travelDeals || 0,
        moneyDeals: moneyDeals || 0,
        feedPosts: feedPosts || 0,
        postLikes: postLikes || 0,
        savedListings: savedListings || 0
      });
      
      console.log('📊 Stats loaded successfully');
      
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchRecentListings = async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          category:marketplace_categories(name),
          images:listing_images(url)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentListings(data || []);
      
    } catch (error) {
      console.error('Error fetching listings:', error);
    }
  };

  const fetchRecentMessages = async () => {
    try {
      // Get recent conversations
      const { data: conversations, error: convError } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          unread_count,
          conversations (
            id,
            last_message_at,
            messages!conversation_id (
              content,
              created_at,
              sender:users!messages_sender_id_fkey (
                firstname,
                surname,
                profile_picture_url
              )
            )
          )
        `)
        .eq('user_id', user.id)
        .order('last_read_at', { ascending: false })
        .limit(5);

      if (convError) throw convError;
      
      // Process conversation data
      const messages = conversations?.map(conv => ({
        id: conv.conversation_id,
        unread: conv.unread_count > 0,
        content: conv.conversations?.messages?.[0]?.content || 'No messages',
        sender: conv.conversations?.messages?.[0]?.sender,
        created_at: conv.conversations?.last_message_at
      })) || [];
      
      setRecentMessages(messages);
      
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchUpcomingEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('event_attendees')
        .select(`
          status,
          events (
            id,
            title,
            description,
            event_date,
            location,
            organizer:users!events_organizer_id_fkey (
              firstname,
              surname
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'going')
        .gt('events.event_date', new Date().toISOString())
        .order('events.event_date', { ascending: true })
        .limit(5);

      if (error) throw error;
      
      const events = data?.map(item => ({
        ...item.events,
        status: item.status
      })) || [];
      
      setUpcomingEvents(events);
      
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchFeedPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('feed_posts')
        .select(`
          *,
          user:users!feed_posts_user_id_fkey (
            firstname,
            surname,
            profile_picture_url
          ),
          likes:post_likes(count),
          comments:post_comments(count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setFeedPosts(data || []);
      
    } catch (error) {
      console.error('Error fetching feed posts:', error);
    }
  };

  const fetchSavedListings = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_listings')
        .select(`
          *,
          listing:listings!saved_listings_listing_id_fkey (
            id,
            title,
            price,
            description,
            is_active,
            category:marketplace_categories(name)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setSavedListings(data || []);
      
    } catch (error) {
      console.error('Error fetching saved listings:', error);
    }
  };

  const fetchMarketplaceItems = async () => {
    try {
      const { data, error } = await supabase
        .from('marketplace_items')
        .select(`
          *,
          category:marketplace_categories(name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setMarketplaceItems(data || []);
      
    } catch (error) {
      console.error('Error fetching marketplace items:', error);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    initializeDashboard();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return <Loading message="Loading your dashboard..." />;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-wrapper">
        {/* Welcome Header */}
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
                  {userProfile?.firstname?.[0]}{userProfile?.surname?.[0]}
                </div>
              )}
              <div className="dashboard-header-info">
                <h1 className="dashboard-welcome-text">
                  Welcome back, <span className="dashboard-highlight">{userProfile?.firstname}</span>!
                </h1>
                <p className="dashboard-user-email">{userProfile?.email}</p>
                <div className="dashboard-user-meta">
                  <span className="dashboard-meta-item">
                    <span className="dashboard-meta-icon">🎓</span>
                    {userProfile?.university || 'No university set'}
                  </span>
                  <span className="dashboard-meta-item">
                    <span className="dashboard-meta-icon">📍</span>
                    {userProfile?.city || 'No location set'}
                  </span>
                  <span className="dashboard-meta-item">
                    <span className="dashboard-meta-icon">📅</span>
                    Joined {new Date(userProfile?.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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
            </div>
          </div>
        </div>

        {/* Stats Grid - Extended */}
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
            {/* Personal Information Card */}
            <div className="dashboard-info-card">
              <div className="dashboard-card-header">
                <h2 className="dashboard-card-title">
                  <span className="dashboard-card-icon">👤</span>
                  Personal Information
                </h2>
                <button className="dashboard-edit-btn">Edit</button>
              </div>
              
              <div className="dashboard-card-content">
                <div className="dashboard-info-grid">
                  <div className="dashboard-info-item">
                    <span className="dashboard-info-label">Full Name</span>
                    <span className="dashboard-info-value">
                      {userProfile?.firstname} {userProfile?.surname}
                    </span>
                  </div>
                  
                  <div className="dashboard-info-item">
                    <span className="dashboard-info-label">Education</span>
                    <span className="dashboard-info-value">{userProfile?.education || 'Not specified'}</span>
                  </div>
                  
                  <div className="dashboard-info-item">
                    <span className="dashboard-info-label">Student Status</span>
                    <span className={`dashboard-status-badge ${userProfile?.is_student ? 'dashboard-status-student' : 'dashboard-status-not-student'}`}>
                      {userProfile?.is_student ? 'Student' : 'Not Student'}
                    </span>
                  </div>
                  
                  <div className="dashboard-info-item">
                    <span className="dashboard-info-label">Date of Birth</span>
                    <span className="dashboard-info-value">
                      {userProfile?.date_of_birth ? new Date(userProfile.date_of_birth).toLocaleDateString() : 'Not provided'}
                    </span>
                  </div>
                  
                  <div className="dashboard-info-item">
                    <span className="dashboard-info-label">Verification</span>
                    <span className="dashboard-info-value">{userProfile?.verification_board || 'Not verified'}</span>
                  </div>
                  
                  <div className="dashboard-info-item">
                    <span className="dashboard-info-label">Program Field</span>
                    <span className="dashboard-info-value">{userProfile?.program_field || 'Not specified'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Feed Posts */}
            {feedPosts.length > 0 && (
              <div className="dashboard-info-card">
                <div className="dashboard-card-header">
                  <h2 className="dashboard-card-title">
                    <span className="dashboard-card-icon">📝</span>
                    Your Recent Posts
                  </h2>
                </div>
                
                <div className="dashboard-card-content">
                  <div className="dashboard-posts-list">
                    {feedPosts.map((post) => (
                      <div key={post.id} className="dashboard-post-item">
                        <div className="dashboard-post-content">
                          <p className="dashboard-post-text">{post.content}</p>
                          <div className="dashboard-post-meta">
                            <span className="dashboard-post-date">{formatDate(post.created_at)}</span>
                            <span className="dashboard-post-stats">
                              {post.likes?.[0]?.count || 0} likes • {post.comments?.[0]?.count || 0} comments
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
                {recentMessages.length > 0 ? (
                  <div className="dashboard-conversations-list">
                    {recentMessages.map((message) => (
                      <div key={message.id} className={`dashboard-conversation-item ${message.unread ? 'dashboard-conversation-unread' : ''}`}>
                        <div className="dashboard-conversation-avatar">
                          {message.sender?.profile_picture_url ? (
                            <img src={message.sender.profile_picture_url} alt={message.sender.firstname} />
                          ) : (
                            <div className="dashboard-avatar-fallback">
                              {message.sender?.firstname?.[0]}
                            </div>
                          )}
                        </div>
                        <div className="dashboard-conversation-content">
                          <div className="dashboard-conversation-header">
                            <span className="dashboard-conversation-name">
                              {message.sender?.firstname} {message.sender?.surname}
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
                {upcomingEvents.length > 0 ? (
                  <div className="dashboard-events-list">
                    {upcomingEvents.map((event) => (
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
                          <p className="dashboard-event-location">{event.location}</p>
                          <p className="dashboard-event-organizer">
                            By {event.organizer?.firstname} {event.organizer?.surname}
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

            {/* Saved Listings */}
            {savedListings.length > 0 && (
              <div className="dashboard-info-card">
                <div className="dashboard-card-header">
                  <h2 className="dashboard-card-title">
                    <span className="dashboard-card-icon">⭐</span>
                    Saved Items
                  </h2>
                </div>
                
                <div className="dashboard-card-content">
                  <div className="dashboard-saved-items-list">
                    {savedListings.map((item) => (
                      <div key={item.id} className="dashboard-saved-item">
                        <div className="dashboard-saved-item-info">
                          <h4 className="dashboard-saved-item-title">{item.listing?.title}</h4>
                          <p className="dashboard-saved-item-category">{item.listing?.category?.name}</p>
                          <div className="dashboard-saved-item-meta">
                            <span className="dashboard-saved-item-price">
                              {formatCurrency(item.listing?.price || 0)}
                            </span>
                            <span className="dashboard-saved-item-date">
                              Saved {formatDate(item.created_at)}
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
        </div>

        {/* Quick Actions */}
        <div className="dashboard-quick-actions">
          <h3 className="dashboard-actions-title">Quick Actions</h3>
          <div className="dashboard-actions-grid">
            <button className="dashboard-action-btn">
              <span className="dashboard-action-icon">➕</span>
              <span className="dashboard-action-text">New Listing</span>
            </button>
            <button className="dashboard-action-btn">
              <span className="dashboard-action-icon">✏️</span>
              <span className="dashboard-action-text">Create Post</span>
            </button>
            <button className="dashboard-action-btn">
              <span className="dashboard-action-icon">📅</span>
              <span className="dashboard-action-text">Create Event</span>
            </button>
            <button className="dashboard-action-btn">
              <span className="dashboard-action-icon">🔍</span>
              <span className="dashboard-action-text">Find Friends</span>
            </button>
            <button className="dashboard-action-btn">
              <span className="dashboard-action-icon">💼</span>
              <span className="dashboard-action-text">Marketplace</span>
            </button>
            <button className="dashboard-action-btn">
              <span className="dashboard-action-icon">✈️</span>
              <span className="dashboard-action-text">Travel Deals</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;