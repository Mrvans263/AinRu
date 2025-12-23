import React from 'react';
import './Layout.css';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const sidebarSections = [
    {
      title: 'Discover',
      items: [
        { id: 'feed', label: 'Campus Feed', icon: '📰', badge: 'New' },
        { id: 'marketplace', label: 'Marketplace', icon: '🛒', count: 12 },
        { id: 'travel', label: 'Travel Deals', icon: '✈️' },
        { id: 'money', label: 'Money Deals', icon: '💰' },
        { id: 'services', label: 'Services', icon: '🔧' },
      ]
    },
    {
      title: 'Connect',
      items: [
        { id: 'friends', label: 'Friends', icon: '👥', count: 3 },
        { id: 'students', label: 'All Students', icon: '🎓' },
        { id: 'messages', label: 'Messages', icon: '💬', count: 5 },
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
    <aside className="sidebar">
      {/* Quick Profile */}
      <div className="sidebar-profile">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`profile-card ${activeTab === 'dashboard' ? 'profile-card-active' : ''}`}
        >
          <div className="profile-avatar">
            <span className="avatar-icon">👤</span>
          </div>
          <div className="profile-info">
            <h3 className="profile-name">My Profile</h3>
            <p className="profile-status">View & edit profile</p>
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
                >
                  <div className="sidebar-item-content">
                    <span className="item-icon">{item.icon}</span>
                    <span className="item-label">{item.label}</span>
                  </div>
                  <div className="sidebar-item-badges">
                    {item.badge && (
                      <span className="item-badge">{item.badge}</span>
                    )}
                    {item.count && (
                      <span className="item-count">{item.count}</span>
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
        <button className="action-button action-button-primary">
          <span className="action-icon">➕</span>
          <span className="action-label">Create Listing</span>
        </button>
        <button className="action-button">
          <span className="action-icon">🎯</span>
          <span className="action-label">Quick Help</span>
        </button>
      </div>

      {/* Stats */}
      <div className="sidebar-stats">
        <div className="stat-item">
          <div className="stat-value">1,234</div>
          <div className="stat-label">Active Students</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">42</div>
          <div className="stat-label">New Listings</div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;