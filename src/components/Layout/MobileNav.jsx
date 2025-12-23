import React, { useState } from 'react';
import './Layout.css';

const MobileNav = ({ user, onLogout, activeTab, setActiveTab }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const mobileNavItems = [
    { id: 'feed', label: 'Feed', icon: '📰' },
    { id: 'marketplace', label: 'Market', icon: '🛒' },
    { id: 'travel', label: 'Travel', icon: '✈️' },
    { id: 'money', label: 'Money', icon: '💰' },
    { id: 'dashboard', label: 'Profile', icon: '👤' },
  ];

  const menuSections = [
    {
      title: 'Discover',
      items: [
        { id: 'feed', label: 'Campus Feed', icon: '📰' },
        { id: 'marketplace', label: 'Marketplace', icon: '🛒' },
        { id: 'travel', label: 'Travel Deals', icon: '✈️' },
        { id: 'money', label: 'Money Deals', icon: '💰' },
        { id: 'services', label: 'Services', icon: '🔧' },
      ]
    },
    {
      title: 'Connect',
      items: [
        { id: 'friends', label: 'Friends', icon: '👥' },
        { id: 'students', label: 'All Students', icon: '🎓' },
        { id: 'messages', label: 'Messages', icon: '💬' },
        { id: 'study-groups', label: 'Study Groups', icon: '📚' },
      ]
    },
    {
      title: 'Opportunities',
      items: [
        { id: 'jobs', label: 'Student Jobs', icon: '💼' },
        { id: 'events', label: 'Events', icon: '📅' },
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

  return (
    <>
      {/* Mobile Top Bar */}
      <nav className="mobile-nav">
        <div className="mobile-nav-container">
          <div className="mobile-nav-brand">
            <div className="logo-icon">CC</div>
            <h1 className="mobile-logo-text">CampusConnect</h1>
          </div>

          <button
            onClick={() => setIsMenuOpen(true)}
            className="mobile-menu-button"
          >
            <span className="menu-icon">☰</span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="mobile-menu-overlay">
          <div className="mobile-menu-container">
            {/* Menu Header */}
            <div className="mobile-menu-header">
              <div className="mobile-menu-brand">
                <div className="logo-icon">CC</div>
                <h2>CampusConnect</h2>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="mobile-menu-close"
              >
                <span className="close-icon">✕</span>
              </button>
            </div>

            {/* User Info */}
            {user && (
              <div className="mobile-user-info">
                <div className="mobile-user-avatar">
                  {user.user_metadata?.firstname?.[0] || 'U'}
                </div>
                <div>
                  <h3 className="mobile-user-name">{user.user_metadata?.firstname || 'User'}</h3>
                  <p className="mobile-user-email">{user.email}</p>
                </div>
              </div>
            )}

            {/* Menu Content */}
            <div className="mobile-menu-content">
              {menuSections.map((section, index) => (
                <div key={index} className="mobile-menu-section">
                  <h3 className="mobile-menu-section-title">{section.title}</h3>
                  <div className="mobile-menu-items">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setIsMenuOpen(false);
                        }}
                        className={`mobile-menu-item ${activeTab === item.id ? 'mobile-menu-item-active' : ''}`}
                      >
                        <span className="mobile-menu-icon">{item.icon}</span>
                        <span className="mobile-menu-label">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Logout Button */}
            {user && (
              <div className="mobile-menu-footer">
                <button
                  onClick={() => {
                    onLogout();
                    setIsMenuOpen(false);
                  }}
                  className="mobile-logout-button"
                >
                  <span className="logout-icon">🚪</span>
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="bottom-nav">
        <div className="bottom-nav-container">
          {mobileNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`bottom-nav-item ${activeTab === item.id ? 'bottom-nav-item-active' : ''}`}
            >
              <span className="bottom-nav-icon">{item.icon}</span>
              <span className="bottom-nav-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default MobileNav;