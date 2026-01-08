import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './Layout.css';

const Sidebar = ({ activeTab, setActiveTab, user }) => {
  const [stats, setStats] = useState({
    unreadMessages: 0,
    pendingConnections: 0,
    activeListings: 0,
    upcomingEvents: 0
  });
  const [loading, setLoading] = useState(false);
  const [platformStats, setPlatformStats] = useState({
    activeMembers: 1234,
    newListings: 42
  });
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Loading skeleton components
  const StatLoadingSkeleton = () => (
    <div className="stat-item">
      <div className="stat-value shimmer" style={{ width: '60px', height: '20px', margin: '0 auto' }}></div>
      <div className="stat-label shimmer" style={{ width: '80px', height: '12px', margin: '4px auto 0' }}></div>
    </div>
  );

  const ItemLoadingSkeleton = () => (
    <div className="sidebar-item" style={{ cursor: 'default' }}>
      <div className="sidebar-item-content">
        <span className="item-icon shimmer" style={{ width: '24px', height: '24px' }}></span>
        <span className="item-label shimmer" style={{ width: '100px', height: '16px' }}></span>
      </div>
      <div className="sidebar-item-badges">
        <span className="item-count item-count-loading"></span>
      </div>
    </div>
  );

  // FIXED: Updated item.id values to match App.jsx tab names
  const sidebarSections = [
    {
      title: 'Discover',
      items: [
        { id: 'feed', label: 'Community Feed', icon: '📰', badge: 'New' },
        { id: 'marketplace', label: 'Marketplace', icon: '🛒', count: stats.activeListings },
        { id: 'travel', label: 'Travel Deals', icon: '✈️' },
        { id: 'money', label: 'Money Deals', icon: '💰' },
        { id: 'services', label: 'Services', icon: '🔧' },
      ]
    },
    {
      title: 'Connect',
      items: [
        { id: 'friends', label: 'Connections', icon: '👥', count: stats.pendingConnections },
        { id: 'students', label: 'All Members', icon: '🌍' },
        { 
          id: 'messages', 
          label: 'Messages', 
          icon: '💬', 
          count: stats.unreadMessages,
          hasNotifications: true,
          onClick: () => {
            setActiveTab('messages');
            markMessageNotificationsAsRead();
          }
        },
        { id: 'study-groups', label: 'Study Groups', icon: '📚' },
      ]
    },
    {
      title: 'Opportunities',
      items: [
        { id: 'jobs', label: 'Job Board', icon: '💼' },
        { id: 'events', label: 'Events', icon: '📅', count: stats.upcomingEvents },
        { id: 'housing', label: 'Housing', icon: '🏠' },
        { id: 'campus-eats', label: 'African Food', icon: '🍛' },
      ]
    },
    {
      title: 'Account',
      items: [
        { id: 'dashboard', label: 'My Profile', icon: '👤' },
        { id: 'settings', label: 'Settings', icon: '⚙️' },
      ]
    }
  ];

  useEffect(() => {
    if (user) {
      fetchSidebarStats();
      fetchRealNotifications();
      setupRealtimeSubscriptions();
    }
  }, [user]);

  useEffect(() => {
    fetchPlatformStats();
  }, []);

  const setupRealtimeSubscriptions = () => {
    if (!user) return;

    // Subscribe to new messages
    const messagesSubscription = supabase
      .channel('sidebar-messages')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `sender_id=neq.${user.id}`
        }, 
        (payload) => {
          checkForNewMessage(payload.new);
        }
      )
      .subscribe();

    // Subscribe to new connection requests
    const connectionsSubscription = supabase
      .channel('sidebar-connections')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'friends',
          filter: `friend_id=eq.${user.id}`
        }, 
        (payload) => {
          if (payload.new.status === 'pending') {
            addNotification({
              type: 'connection_request',
              title: 'New Connection Request',
              message: `${payload.new.user_id ? 'Someone' : 'A user'} wants to connect with you`,
              timestamp: new Date().toISOString(),
              unread: true
            });
            setStats(prev => ({
              ...prev,
              pendingConnections: prev.pendingConnections + 1
            }));
          }
        }
      )
      .subscribe();

    // Subscribe to new event invites
    const eventsSubscription = supabase
      .channel('sidebar-events')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'event_attendees',
          filter: `user_id=eq.${user.id}`
        }, 
        (payload) => {
          if (payload.new.status === 'invited') {
            addNotification({
              type: 'event_invite',
              title: 'Event Invitation',
              message: 'You\'ve been invited to an event',
              timestamp: new Date().toISOString(),
              unread: true
            });
          }
        }
      )
      .subscribe();

    // Subscribe to listing interactions
    const listingsSubscription = supabase
      .channel('sidebar-listings')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'saved_listings',
          filter: `listing_id=in.(${getUserListingIds()})`
        }, 
        (payload) => {
          if (payload.eventType === 'INSERT') {
            addNotification({
              type: 'listing_saved',
              title: 'Your listing was saved',
              message: 'Someone saved your listing',
              timestamp: new Date().toISOString(),
              unread: true
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesSubscription);
      supabase.removeChannel(connectionsSubscription);
      supabase.removeChannel(eventsSubscription);
      supabase.removeChannel(listingsSubscription);
    };
  };

  const getUserListingIds = () => {
    return '';
  };

  const checkForNewMessage = async (message) => {
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', message.conversation_id);

    if (participants?.some(p => p.user_id === user.id)) {
      addNotification({
        type: 'new_message',
        title: 'New Message',
        message: message.content?.substring(0, 50) || 'New message received',
        timestamp: message.created_at,
        unread: true,
        conversationId: message.conversation_id
      });
      
      setStats(prev => ({
        ...prev,
        unreadMessages: prev.unreadMessages + 1
      }));
    }
  };

  const addNotification = (notification) => {
    setNotifications(prev => {
      if (prev.some(n => n.id === notification.id)) {
        return prev;
      }
      
      const newNotification = {
        ...notification,
        id: Date.now().toString(),
        timestamp: notification.timestamp || new Date().toISOString()
      };
      
      return [newNotification, ...prev].slice(0, 20);
    });
  };

  const fetchSidebarStats = async () => {
    try {
      setLoading(true);
      
      const [
        { data: conversations, error: convError },
        { count: pendingConnections, error: connError },
        { count: activeListings, error: listError },
        { count: upcomingEvents, error: eventError }
      ] = await Promise.all([
        supabase
          .from('conversation_participants')
          .select('unread_count')
          .eq('user_id', user.id),
        
        supabase
          .from('friends')
          .select('*', { count: 'exact', head: true })
          .eq('friend_id', user.id)
          .eq('status', 'pending'),
        
        supabase
          .from('marketplace_listings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'active'),
        
        supabase
          .from('event_attendees')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'going')
      ]);

      let unreadMessagesTotal = 0;
      if (conversations && !convError) {
        unreadMessagesTotal = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
      }

      setStats({
        unreadMessages: unreadMessagesTotal,
        pendingConnections: pendingConnections || 0,
        activeListings: activeListings || 0,
        upcomingEvents: upcomingEvents || 0
      });
      
    } catch (error) {
      console.error('Error fetching sidebar stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRealNotifications = async () => {
    try {
      if (!user) return;

      const [
        { data: recentMessages },
        { data: friendRequests },
        { data: eventInvites }
      ] = await Promise.all([
        supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            conversation_id,
            sender:users!messages_sender_id_fkey(firstname, surname)
          `)
          .eq('conversations.conversation_participants.user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        
        supabase
          .from('friends')
          .select(`
            id,
            created_at,
            user:users!friends_user_id_fkey(firstname, surname)
          `)
          .eq('friend_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5),
        
        supabase
          .from('event_attendees')
          .select(`
            id,
            created_at,
            events(title)
          `)
          .eq('user_id', user.id)
          .eq('status', 'invited')
          .order('created_at', { ascending: false })
          .limit(3)
      ]);

      const newNotifications = [];

      if (recentMessages) {
        recentMessages.forEach(msg => {
          newNotifications.push({
            id: `msg_${msg.id}`,
            type: 'new_message',
            title: `New message from ${msg.sender?.firstname || 'Someone'}`,
            message: msg.content?.substring(0, 50) || 'New message',
            timestamp: msg.created_at,
            unread: true,
            conversationId: msg.conversation_id
          });
        });
      }

      if (friendRequests) {
        friendRequests.forEach(req => {
          newNotifications.push({
            id: `friend_${req.id}`,
            type: 'connection_request',
            title: 'Connection Request',
            message: `${req.user?.firstname || 'Someone'} wants to connect`,
            timestamp: req.created_at,
            unread: true,
            requestId: req.id
          });
        });
      }

      if (eventInvites) {
        eventInvites.forEach(invite => {
          newNotifications.push({
            id: `event_${invite.id}`,
            type: 'event_invite',
            title: 'Event Invitation',
            message: `Invited to ${invite.events?.title || 'an event'}`,
            timestamp: invite.created_at,
            unread: true
          });
        });
      }

      newNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setNotifications(newNotifications);

    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchPlatformStats = async () => {
    try {
      const [
        { count: activeMembers },
        { count: newListings }
      ] = await Promise.all([
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('profile_completed', true),
        
        supabase
          .from('marketplace_listings')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      ]);

      setPlatformStats({
        activeMembers: activeMembers || 1234,
        newListings: newListings || 42
      });
    } catch (error) {
      console.error('Error fetching platform stats:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    markNotificationAsRead(notification);

    switch (notification.type) {
      case 'new_message':
        setActiveTab('messages');
        break;
      case 'connection_request':
        setActiveTab('friends');
        break;
      case 'event_invite':
        setActiveTab('events');
        break;
      default:
        break;
    }

    setShowNotifications(false);
  };

  const markNotificationAsRead = (notification) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notification.id ? { ...n, unread: false } : n
      )
    );
  };

  const markMessageNotificationsAsRead = async () => {
    try {
      await supabase
        .from('conversation_participants')
        .update({ unread_count: 0 })
        .eq('user_id', user.id);

      setStats(prev => ({ ...prev, unreadMessages: 0 }));
      
      setNotifications(prev => 
        prev.map(n => 
          n.type === 'new_message' ? { ...n, unread: false } : n
        )
      );

    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, unread: false }))
    );
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const getUnreadNotificationCount = () => {
    return notifications.filter(n => n.unread).length;
  };

  const formatNotificationTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_message': return '💬';
      case 'connection_request': return '👥';
      case 'event_invite': return '📅';
      case 'listing_saved': return '⭐';
      default: return '🔔';
    }
  };

  const handleCreateListing = () => {
    setActiveTab('marketplace');
  };

  const handleQuickHelp = () => {
    window.location.href = '/support';
  };

  const handleCommunityGuidelines = () => {
    window.location.href = '/guidelines';
  };

  const getUserInitials = () => {
    if (user?.user_metadata?.firstname) {
      return user.user_metadata.firstname[0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return '👤';
  };

  const getUserName = () => {
    if (user?.user_metadata?.firstname) {
      return user.user_metadata.firstname;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'My Profile';
  };

  const getUserUniversity = () => {
    if (user?.user_metadata?.university) {
      return user.user_metadata.university;
    }
    if (user?.user_metadata?.location) {
      return user.user_metadata.location;
    }
    return 'African in Russia';
  };

  const getAvatarUrl = () => {
    return user?.user_metadata?.avatar_url || null;
  };

  return (
    <aside className="sidebar" role="complementary" aria-label="Sidebar navigation">
      {/* Quick Profile with Notifications */}
      <div className="sidebar-profile">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`profile-card ${activeTab === 'dashboard' ? 'profile-card-active' : ''}`}
          aria-current={activeTab === 'dashboard' ? 'page' : undefined}
          aria-label="Go to my profile"
        >
          <div className="profile-avatar" aria-hidden="true">
            {getAvatarUrl() ? (
              <img 
                src={getAvatarUrl()} 
                alt="Profile" 
                className="avatar-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.textContent = getUserInitials();
                }}
              />
            ) : (
              <span className="avatar-icon">
                {getUserInitials()}
              </span>
            )}
            {getUnreadNotificationCount() > 0 && (
              <span className="profile-notification-badge">
                {getUnreadNotificationCount()}
              </span>
            )}
          </div>
          <div className="profile-info">
            <h3 className="profile-name">
              {getUserName()}
            </h3>
            <p className="profile-status">
              {getUserUniversity()}
            </p>
          </div>
        </button>

        {/* Notifications Button */}
        <div className="notifications-container">
          <button
            className="notifications-button"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label={`Notifications ${getUnreadNotificationCount() > 0 ? `, ${getUnreadNotificationCount()} unread` : ''}`}
          >
            <span className="notifications-icon">🔔</span>
            {getUnreadNotificationCount() > 0 && (
              <span className="notifications-badge">
                {getUnreadNotificationCount()}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="notifications-dropdown">
              <div className="notifications-header">
                <h4>Notifications</h4>
                <div className="notifications-actions">
                  {notifications.some(n => n.unread) && (
                    <button
                      onClick={markAllNotificationsAsRead}
                      className="notifications-action-btn"
                      aria-label="Mark all as read"
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAllNotifications}
                      className="notifications-action-btn clear-btn"
                      aria-label="Clear all notifications"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>
              
              <div className="notifications-list">
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`notification-item ${notification.unread ? 'unread' : ''}`}
                      aria-label={`${notification.title}: ${notification.message}`}
                    >
                      <div className="notification-icon">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="notification-content">
                        <div className="notification-title">
                          {notification.title}
                          {notification.unread && (
                            <span className="unread-indicator" aria-hidden="true"></span>
                          )}
                        </div>
                        <div className="notification-message">
                          {notification.message}
                        </div>
                        <div className="notification-time">
                          {formatNotificationTime(notification.timestamp)}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="no-notifications">
                    <span className="no-notifications-icon">🔕</span>
                    <p>No notifications</p>
                  </div>
                )}
              </div>
              
              <div className="notifications-footer">
                <button
                  onClick={() => {
                    setActiveTab('messages');
                    setShowNotifications(false);
                  }}
                  className="view-all-btn"
                >
                  View All Messages
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="sidebar-sections" aria-label="Main navigation">
        {sidebarSections.map((section, sectionIndex) => (
          <div 
            key={`section-${sectionIndex}`} 
            className="sidebar-section"
            role="group"
            aria-labelledby={`section-heading-${sectionIndex}`}
          >
            <h3 
              id={`section-heading-${sectionIndex}`}
              className="section-title"
            >
              {section.title}
            </h3>
            <div className="section-items">
              {section.items.map((item) => (
                loading && item.count !== undefined ? (
                  <ItemLoadingSkeleton key={item.id} />
                ) : (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.onClick) {
                        item.onClick();
                      } else {
                        setActiveTab(item.id);
                      }
                      if (item.hasNotifications) {
                        setNotifications(prev => 
                          prev.map(n => 
                            n.type === 'new_message' ? { ...n, unread: false } : n
                          )
                        );
                      }
                    }}
                    className={`sidebar-item ${activeTab === item.id ? 'sidebar-item-active' : ''} ${item.hasNotifications ? 'has-notifications' : ''}`}
                    aria-current={activeTab === item.id ? 'page' : undefined}
                    aria-label={`${item.label}${item.count ? `, ${item.count} notifications` : ''}`}
                  >
                    <div className="sidebar-item-content">
                      <span className="item-icon" aria-hidden="true">{item.icon}</span>
                      <span className="item-label">{item.label}</span>
                    </div>
                    <div className="sidebar-item-badges">
                      {item.badge && (
                        <span 
                          className="item-badge"
                          aria-hidden="true"
                        >
                          {item.badge}
                        </span>
                      )}
                      {item.count !== undefined && item.count > 0 && (
                        <span 
                          className="item-count"
                          aria-label={`${item.count} notifications`}
                        >
                          {item.count}
                        </span>
                      )}
                    </div>
                  </button>
                )
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Quick Actions */}
      <div className="sidebar-actions" role="group" aria-label="Quick actions">
        <button 
          className="action-button action-button-primary"
          onClick={handleCreateListing}
          aria-label="Create new listing"
        >
          <span className="action-icon" aria-hidden="true">➕</span>
          <span className="action-label">Create Listing</span>
        </button>
        <div className="action-button-group">
          <button 
            className="action-button action-button-secondary"
            onClick={handleQuickHelp}
            aria-label="Get quick help"
          >
            <span className="action-icon" aria-hidden="true">🎯</span>
            <span className="action-label">Quick Help</span>
          </button>
          <button 
            className="action-button action-button-tertiary"
            onClick={handleCommunityGuidelines}
            aria-label="View community guidelines"
          >
            <span className="action-icon" aria-hidden="true">📜</span>
            <span className="action-label">Guidelines</span>
          </button>
        </div>
      </div>

      {/* Platform Stats */}
      <div 
        className="sidebar-stats" 
        role="region" 
        aria-label="Platform statistics"
      >
        <div className="stat-header">
          <h4 className="stat-title">AinRu Community</h4>
          <p className="stat-subtitle">Africans in Russia</p>
        </div>
        <div className="stat-items">
          {loading ? (
            <>
              <StatLoadingSkeleton />
              <StatLoadingSkeleton />
            </>
          ) : (
            <>
              <div 
                className="stat-item" 
                role="status"
                aria-label={`${platformStats.activeMembers.toLocaleString()} active members`}
              >
                <div className="stat-value">
                  {platformStats.activeMembers.toLocaleString()}
                </div>
                <div className="stat-label">Active Members</div>
              </div>
              <div 
                className="stat-item"
                role="status"
                aria-label={`${platformStats.newListings} new listings in last 24 hours`}
              >
                <div className="stat-value">{platformStats.newListings}</div>
                <div className="stat-label">New Listings</div>
                <div className="stat-timeframe">Last 24h</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tagline */}
      <div className="sidebar-tagline" role="contentinfo">
        <p className="tagline-text">Foreign Hardships, Home Blessings</p>
        <p className="tagline-subtext">Supporting Africans in Russia</p>
      </div>
    </aside>
  );
};

export default Sidebar;