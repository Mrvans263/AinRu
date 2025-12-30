import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './Layout.css';

const Navbar = ({ user, onLogout, activeTab, setActiveTab }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const topNavItems = [
    { id: 'feed', label: 'Feed', icon: '📰' },
    { id: 'marketplace', label: 'Marketplace', icon: '🛒' },
    { id: 'travel', label: 'Travel', icon: '✈️' },
    { id: 'money', label: 'Money', icon: '💰' },
  ];

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchUnreadCount();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('firstname, surname, profile_picture_url, university')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('unread_count')
        .eq('user_id', user.id);

      if (!error && data) {
        const totalUnread = data.reduce((sum, item) => sum + (item.unread_count || 0), 0);
        setUnreadCount(totalUnread);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const getUserInitials = () => {
    if (userProfile?.firstname && userProfile?.surname) {
      return `${userProfile.firstname[0]}${userProfile.surname[0]}`.toUpperCase();
    }
    if (user?.user_metadata?.firstname && user.user_metadata?.surname) {
      return `${user.user_metadata.firstname[0]}${user.user_metadata.surname[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const getUserName = () => {
    if (userProfile?.firstname) {
      return userProfile.firstname;
    }
    if (user?.user_metadata?.firstname) {
      return user.user_metadata.firstname;
    }
    return 'User';
  };

  const getUserAvatar = () => {
    if (userProfile?.profile_picture_url) {
      return userProfile.profile_picture_url;
    }
    if (user?.user_metadata?.avatar_url) {
      return user.user_metadata.avatar_url;
    }
    return null;
  };

  const getUserUniversity = () => {
    if (userProfile?.university) {
      return userProfile.university;
    }
    if (user?.user_metadata?.university) {
      return user.user_metadata.university;
    }
    return 'Student';
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <div className="navbar-logo">
          <div className="logo-icon">CC</div>
          <div>
            <h1 className="logo-text">AinRu</h1>
            <p className="logo-subtitle">Africans in Russia</p>
          </div>
        </div>

        {/* Desktop Navigation */}
        <div className="navbar-nav">
          {topNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-item ${activeTab === item.id ? 'nav-item-active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>

        {/* User Menu */}
        <div className="navbar-user">
          {user ? (
            <div className="user-menu-container">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="user-menu-trigger"
              >
                <div className="user-avatar">
                  {getUserAvatar() ? (
                    <img 
                      src={getUserAvatar()} 
                      alt="Profile" 
                      className="avatar-image"
                    />
                  ) : (
                    getUserInitials()
                  )}
                </div>
                <div className="user-info">
                  <span className="user-name">{getUserName()}</span>
                  <span className="user-role">{getUserUniversity()}</span>
                </div>
                <div className="notification-indicator">
                  {unreadCount > 0 && (
                    <span className="notification-count">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                  <svg className="chevron-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </button>

              {showUserMenu && (
                <>
                  <div 
                    className="user-menu-backdrop"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="user-menu-dropdown">
                    <div className="user-menu-header">
                      <div className="user-avatar-lg">
                        {getUserAvatar() ? (
                          <img 
                            src={getUserAvatar()} 
                            alt="Profile" 
                            className="avatar-image"
                          />
                        ) : (
                          getUserInitials()
                        )}
                      </div>
                      <div>
                        <h3 className="user-menu-name">{getUserName()}</h3>
                        <p className="user-menu-email">{user.email}</p>
                        <p className="user-menu-university">{getUserUniversity()}</p>
                      </div>
                    </div>
                    
                    <div className="user-menu-items">
                      <button 
                        onClick={() => {
                          setActiveTab('dashboard');
                          setShowUserMenu(false);
                        }}
                        className="user-menu-item"
                      >
                        <span className="user-menu-icon">👤</span>
                        <span>My Profile</span>
                        {unreadCount > 0 && (
                          <span className="user-menu-notification">
                            {unreadCount}
                          </span>
                        )}
                      </button>
                      <button 
                        onClick={() => {
                          setActiveTab('messages');
                          setShowUserMenu(false);
                        }}
                        className="user-menu-item"
                      >
                        <span className="user-menu-icon">💬</span>
                        <span>Messages</span>
                        {unreadCount > 0 && (
                          <span className="user-menu-notification">
                            {unreadCount}
                          </span>
                        )}
                      </button>
                      <button 
                        onClick={() => {
                          setActiveTab('settings');
                          setShowUserMenu(false);
                        }}
                        className="user-menu-item"
                      >
                        <span className="user-menu-icon">⚙️</span>
                        <span>Settings</span>
                      </button>
                    </div>
                    
                    <div className="user-menu-footer">
                      <button 
                        onClick={onLogout}
                        className="user-menu-logout"
                      >
                        <span className="logout-icon">🚪</span>
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="navbar-auth">
              <button 
                className="auth-btn auth-btn-login"
                onClick={() => window.location.href = '/'}
              >
                Login
              </button>
              <button 
                className="auth-btn auth-btn-signup"
                onClick={() => window.location.href = '/?state=signup'}
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;