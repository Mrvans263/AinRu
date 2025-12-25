import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './Layout.css';

const Sidebar = ({ activeTab, setActiveTab, user }) => {
  const [stats, setStats] = useState({
    unreadMessages: 0,
    pendingFriends: 0,
    activeListings: 0,
    upcomingEvents: 0
  });
  const [loading, setLoading] = useState(false);

  const sidebarSections = [
    {
      title: 'Discover',
      items: [
        { id: 'feed', label: 'Campus Feed', icon: '📰', badge: 'New' },
        { id: 'marketplace', label: 'Marketplace', icon: '🛒', count: stats.activeListings },
        { id: 'travel', label: 'Travel Deals', icon: '✈️' },
        { id: 'money', label: 'Money Deals', icon: '💰' },
        { id: 'services', label: 'Services', icon: '🔧' },
      ]
    },
    {
      title: 'Connect',
      items: [
        { id: 'friends', label: 'Friends', icon: '👥', count: stats.pendingFriends },
        { id: 'students', label: 'All Students', icon: '🎓' },
        { id: 'messages', label: 'Messages', icon: '💬', count: stats.unreadMessages },
        { id: 'study-groups', label: 'Study Groups', icon: '📚' },
      ]
    },
    {
      title: 'Opportunities',
      items: [
        { id: 'jobs', label: 'Student Jobs', icon: '💼' },
        { id: 'events', label: 'Events', icon: '📅', count: stats.upcomingEvents },
        { id: 'housing', label: 'Housing', icon: '🏠' },
        { id: 'campus-eats', label: 'Campus Eats', icon: '🍕' },
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

  const fetchSidebarStats = async () => {
    try {
      setLoading(true);
      
      const [
        { count: unreadMessages },
        { count: pendingFriends },
        { count: activeListings },
        { count: upcomingEvents }
      ] = await Promise.all([
        // Unread messages count
        supabase
          .from('conversation_participants')
          .select('unread_count', { count: 'exact', head: true })
          .eq('user_id', user.id),
        
        // Pending friend requests
        supabase
          .from('friends')
          .select('*', { count: 'exact', head: true })
          .eq('friend_id', user.id)
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
        pendingFriends: pendingFriends || 0,
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
        { count: activeStudents },
        { count: newListings }
      ] = await Promise.all([
        // Active students (users with profile_completed = true)
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

      return {
        activeStudents: activeStudents || 1234, // Fallback to default
        newListings: newListings || 42
      };
    } catch (error) {
      return {
        activeStudents: 1234,
        newListings: 42
      };
    }
  };

  const [platformStats, setPlatformStats] = useState({
    activeStudents: 1234,
    newListings: 42
  });

  useEffect(() => {
    fetchPlatformStats().then(setPlatformStats);
  }, []);

  const handleCreateListing = () => {
    // Open create listing modal or navigate
    console.log('Create listing clicked');
    // You can implement modal or navigation here
  };

  const handleQuickHelp = () => {
    // Open help modal or navigate
    console.log('Quick help clicked');
  };

  return (
    <aside className="sidebar">
      {/* Quick Profile */}
      <div className="sidebar-profile">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`profile-card ${activeTab === 'dashboard' ? 'profile-card-active' : ''}`}
        >
          <div className="profile-avatar">
            {user?.user_metadata?.avatar_url ? (
              <img 
                src={user.user_metadata.avatar_url} 
                alt="Profile" 
                className="avatar-image"
              />
            ) : (
              <span className="avatar-icon">
                {user?.user_metadata?.firstname?.[0] || user?.email?.[0] || '👤'}
              </span>
            )}
          </div>
          <div className="profile-info">
            <h3 className="profile-name">
              {user?.user_metadata?.firstname || 'My Profile'}
            </h3>
            <p className="profile-status">
              {user?.user_metadata?.university || 'View profile'}
            </p>
          </div>
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="sidebar-sections">
        {sidebarSections.map((section, index) => (
          <div key={index} className="sidebar-section">
            <h3 className="section-title">{section.title}</h3>
            <div className="section-items">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`sidebar-item ${activeTab === item.id ? 'sidebar-item-active' : ''}`}
                  disabled={loading && item.count !== undefined}
                >
                  <div className="sidebar-item-content">
                    <span className="item-icon">{item.icon}</span>
                    <span className="item-label">{item.label}</span>
                  </div>
                  <div className="sidebar-item-badges">
                    {item.badge && (
                      <span className="item-badge">{item.badge}</span>
                    )}
                    {item.count !== undefined && (
                      <span className={`item-count ${loading ? 'item-count-loading' : ''}`}>
                        {loading ? '...' : item.count > 0 ? item.count : null}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="sidebar-actions">
        <button 
          className="action-button action-button-primary"
          onClick={handleCreateListing}
        >
          <span className="action-icon">➕</span>
          <span className="action-label">Create Listing</span>
        </button>
        <button 
          className="action-button"
          onClick={handleQuickHelp}
        >
          <span className="action-icon">🎯</span>
          <span className="action-label">Quick Help</span>
        </button>
      </div>

      {/* Platform Stats */}
      <div className="sidebar-stats">
        <div className="stat-item">
          <div className="stat-value">
            {platformStats.activeStudents.toLocaleString()}
          </div>
          <div className="stat-label">Active Students</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{platformStats.newListings}</div>
          <div className="stat-label">New Listings</div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;