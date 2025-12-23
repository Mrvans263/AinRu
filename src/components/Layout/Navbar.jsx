import React, { useState } from 'react';
import './Layout.css';

const Navbar = ({ user, onLogout, activeTab, setActiveTab }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const topNavItems = [
    { id: 'feed', label: 'Feed', icon: '📰' },
    { id: 'marketplace', label: 'Marketplace', icon: '🛒' },
    { id: 'travel', label: 'Travel', icon: '✈️' },
    { id: 'money', label: 'Money', icon: '💰' },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <div className="navbar-logo">
          <div className="logo-icon">CC</div>
          <div>
            <h1 className="logo-text">CampusConnect</h1>
            <p className="logo-subtitle">Student Community</p>
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
                  {user.user_metadata?.firstname?.[0] || 'U'}
                </div>
                <div className="user-info">
                  <span className="user-name">{user.user_metadata?.firstname || 'User'}</span>
                  <span className="user-role">Student</span>
                </div>
                <svg className="chevron-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {showUserMenu && (
                <div className="user-menu-dropdown">
                  <div className="user-menu-header">
                    <div className="user-avatar-lg">
                      {user.user_metadata?.firstname?.[0] || 'U'}
                    </div>
                    <div>
                      <h3 className="user-menu-name">{user.user_metadata?.firstname || 'User'}</h3>
                      <p className="user-menu-email">{user.email}</p>
                    </div>
                  </div>
                  
                  <div className="user-menu-items">
                    <button 
                      onClick={() => setActiveTab('dashboard')}
                      className="user-menu-item"
                    >
                      <span className="user-menu-icon">👤</span>
                      <span>My Profile</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('settings')}
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
              )}
            </div>
          ) : (
            <div className="navbar-auth">
              <button className="auth-btn auth-btn-login">Login</button>
              <button className="auth-btn auth-btn-signup">Sign Up</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;