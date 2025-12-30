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
        { id: 'feed', label: 'Community Feed', icon: '📰' },
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
        { id: 'community', label: 'All Members', icon: '🌍' },
        { id: 'messages', label: 'Messages', icon: '💬' },
        { id: 'study-groups', label: 'Study Groups', icon: '📚' },
      ]
    },
    {
      title: 'Opportunities',
      items: [
        { id: 'jobs', label: 'Job Board', icon: '💼' },
        { id: 'events', label: 'Events', icon: '📅' },
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

  const getUserInitials = () => {
    if (user?.user_metadata?.firstname) {
      return user.user_metadata.firstname[0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const getUserName = () => {
    if (user?.user_metadata?.firstname) {
      return user.user_metadata.firstname;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Member';
  };

  const getUserRole = () => {
    if (user?.user_metadata?.university) {
      return user.user_metadata.university;
    }
    return 'African in Russia';
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <nav className="mobile-nav" role="navigation" aria-label="Mobile navigation">
        <div className="mobile-nav-container">
          <div className="mobile-nav-brand">
            <div className="logo-icon">AinRu</div>
            <div>
              <h1 className="mobile-logo-text">AinRu</h1>
              <p className="mobile-logo-subtitle">Africans in Russia</p>
            </div>
          </div>

          <button
            onClick={() => setIsMenuOpen(true)}
            className="mobile-menu-button"
            aria-label="Open menu"
            aria-expanded={isMenuOpen}
          >
            <span className="menu-icon" aria-hidden="true">☰</span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div 
          className="mobile-menu-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Main menu"
        >
          <div className="mobile-menu-container">
            {/* Menu Header */}
            <div className="mobile-menu-header">
              <div className="mobile-menu-brand">
                <div className="logo-icon">AinRu</div>
                <div>
                  <h2>AinRu</h2>
                  <p className="mobile-menu-subtitle">Africans in Russia</p>
                </div>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="mobile-menu-close"
                aria-label="Close menu"
              >
                <span className="close-icon" aria-hidden="true">✕</span>
              </button>
            </div>

            {/* User Info */}
            {user && (
              <div className="mobile-user-info">
                <div className="mobile-user-avatar" aria-hidden="true">
                  {getUserInitials()}
                </div>
                <div>
                  <h3 className="mobile-user-name">{getUserName()}</h3>
                  <p className="mobile-user-email">{user.email}</p>
                  <p className="mobile-user-role">{getUserRole()}</p>
                </div>
              </div>
            )}

            {/* Menu Content */}
            <div className="mobile-menu-content">
              {menuSections.map((section, sectionIndex) => (
                <div 
                  key={`section-${sectionIndex}`} 
                  className="mobile-menu-section"
                  role="group"
                  aria-labelledby={`section-heading-${sectionIndex}`}
                >
                  <h3 
                    id={`section-heading-${sectionIndex}`}
                    className="mobile-menu-section-title"
                  >
                    {section.title}
                  </h3>
                  <div className="mobile-menu-items">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setIsMenuOpen(false);
                        }}
                        className={`mobile-menu-item ${activeTab === item.id ? 'mobile-menu-item-active' : ''}`}
                        role="menuitem"
                        aria-current={activeTab === item.id ? 'page' : undefined}
                      >
                        <span className="mobile-menu-icon" aria-hidden="true">{item.icon}</span>
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
                  role="menuitem"
                >
                  <span className="logout-icon" aria-hidden="true">🚪</span>
                  <span>Logout</span>
                </button>
              </div>
            )}

            {/* Login/Join Buttons for non-authenticated users */}
            {!user && (
              <div className="mobile-auth-buttons">
                <button
                  onClick={() => {
                    window.location.href = '/';
                    setIsMenuOpen(false);
                  }}
                  className="mobile-auth-btn mobile-auth-login"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    window.location.href = '/?state=signup';
                    setIsMenuOpen(false);
                  }}
                  className="mobile-auth-btn mobile-auth-join"
                >
                  Join Community
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="bottom-nav" role="navigation" aria-label="Bottom navigation">
        <div className="bottom-nav-container">
          {mobileNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`bottom-nav-item ${activeTab === item.id ? 'bottom-nav-item-active' : ''}`}
              role="tab"
              aria-selected={activeTab === item.id}
              aria-controls={item.id}
            >
              <span className="bottom-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="bottom-nav-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default MobileNav;