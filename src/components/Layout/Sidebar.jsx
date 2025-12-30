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
        { id: 'community', label: 'All Members', icon: '🌍' },
        { id: 'messages', label: 'Messages', icon: '💬', count: stats.unreadMessages },
        { id: 'study-groups', label: 'Study Groups', icon: '📚' },
      ]
    },
    {
      title: 'Opportunities',
      items: [
        { id: 'jobs', label: 'Job Board', icon: '💼' },
        { id: 'events', label: 'Events', icon: '📅', count: stats.upcomingEvents },
        { id: 'housing', label: 'Housing', icon: '🏠' },
        { id: 'food', label: 'African Food', icon: '🍛' },
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
    }
  }, [user]);

  useEffect(() => {
    fetchPlatformStats();
  }, []);

  const fetchSidebarStats = async () => {
    try {
      setLoading(true);
      
      const [
        { count: unreadMessages },
        { count: pendingConnections },
        { count: activeListings },
        { count: upcomingEvents }
      ] = await Promise.all([
        // Unread messages count
        supabase
          .from('conversation_participants')
          .select('unread_count', { count: 'exact', head: true })
          .eq('user_id', user.id),
        
        // Pending connection requests
        supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .eq('target_user_id', user.id)
          .eq('status', 'pending'),
        
        // Active listings
        supabase
          .from('listings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_active', true),
        
        // Upcoming events
        supabase
          .from('event_attendees')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'going')
          .gt('events.event_date', new Date().toISOString())
      ]);

      setStats({
        unreadMessages: unreadMessages || 0,
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

  const fetchPlatformStats = async () => {
    try {
      const [
        { count: activeMembers },
        { count: newListings }
      ] = await Promise.all([
        // Active members (users with profile_completed = true)
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('profile_completed', true),
        
        // New listings in last 24 hours
        supabase
          .from('listings')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      ]);

      setPlatformStats({
        activeMembers: activeMembers || 1234,
        newListings: newListings || 42
      });
    } catch (error) {
      console.error('Error fetching platform stats:', error);
      // Keep default values on error
    }
  };

  const handleCreateListing = () => {
    // Open create listing modal or navigate
    console.log('Create listing clicked');
    // You can implement modal or navigation here
  };

  const handleQuickHelp = () => {
    // Open help modal or navigate to support
    console.log('Quick help clicked');
    window.location.href = '/support';
  };

  const handleCommunityGuidelines = () => {
    // Open community guidelines
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
      {/* Quick Profile */}
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
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`sidebar-item ${activeTab === item.id ? 'sidebar-item-active' : ''}`}
                  disabled={loading && item.count !== undefined}
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
                    {item.count !== undefined && (
                      <span 
                        className={`item-count ${loading ? 'item-count-loading' : ''}`}
                        aria-label={`${item.count} notifications`}
                      >
                        {loading ? (
                          <span className="loading-dots" aria-hidden="true">...</span>
                        ) : (
                          item.count > 0 && item.count
                        )}
                      </span>
                    )}
                  </div>
                </button>
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