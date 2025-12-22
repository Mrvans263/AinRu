import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Login from './components/Auth/Login';
import Signup from './components/Auth/Signup';
import Dashboard from './components/Dashboard';
import Marketplace from './components/Marketplace';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSignup, setShowSignup] = useState(false);
  const [activeTab, setActiveTab] = useState('marketplace');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showDashboardAfterSignup, setShowDashboardAfterSignup] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setActiveTab('marketplace');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      setLoading(false);
      
      if (newUser) {
        // Check if this is a new signup (you might want to track this differently)
        const isNewSignup = localStorage.getItem('just_signed_up');
        if (isNewSignup) {
          setActiveTab('dashboard');
          setShowDashboardAfterSignup(true);
          localStorage.removeItem('just_signed_up');
        } else {
          setActiveTab('marketplace');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Function to handle signup completion
  const handleSignupComplete = () => {
    localStorage.setItem('just_signed_up', 'true');
    setShowSignup(false);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setShowDashboardAfterSignup(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const navigationItems = [
    { id: 'feed', label: 'Feed', icon: '📰' },
    { id: 'marketplace', label: 'Marketplace', icon: '🛒' },
    { id: 'travel', label: 'Travel Deals', icon: '✈️' },
    { id: 'money', label: 'Money Deals', icon: '💰' },
    { id: 'services', label: 'Services', icon: '🔧' },
    { id: 'jobs', label: 'Student Jobs', icon: '💼' },
    { id: 'friends', label: 'Friends', icon: '👥' },
    { id: 'all-students', label: 'All Students', icon: '🎓' },
    { id: 'messages', label: 'Messages', icon: '💬' },
    { id: 'events', label: 'Events', icon: '📅' },
    { id: 'study-groups', label: 'Study Groups', icon: '📚' },
    { id: 'housing', label: 'Housing', icon: '🏠' },
    { id: 'campus-eats', label: 'Campus Eats', icon: '🍕' },
    { id: 'dashboard', label: 'My Profile', icon: '👤' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard user={user} />;
      case 'marketplace':
        return <Marketplace />;
      case 'feed':
        return <PlaceholderComponent title="Campus Feed" message="Latest updates from your campus community" />;
      case 'travel':
        return <PlaceholderComponent title="Travel Deals" message="Find cheap flights and travel packages for students" />;
      case 'money':
        return <PlaceholderComponent title="Money Deals" message="Student discounts, banking offers, and financial tips" />;
      case 'services':
        return <PlaceholderComponent title="Services" message="Student services, tutoring, and freelancing" />;
      case 'jobs':
        return <PlaceholderComponent title="Student Jobs" message="Part-time jobs, internships, and work opportunities" />;
      case 'friends':
        return <PlaceholderComponent title="Friends" message="Connect with friends and classmates" />;
      case 'all-students':
        return <PlaceholderComponent title="All Students" message="Browse student profiles and connect" />;
      case 'messages':
        return <PlaceholderComponent title="Messages" message="Chat with other students" />;
      case 'events':
        return <PlaceholderComponent title="Events" message="Upcoming campus events and activities" />;
      case 'study-groups':
        return <PlaceholderComponent title="Study Groups" message="Find or create study groups" />;
      case 'housing':
        return <PlaceholderComponent title="Housing" message="Find roommates and housing options" />;
      case 'campus-eats':
        return <PlaceholderComponent title="Campus Eats" message="Restaurant deals and meal plans" />;
      case 'settings':
        return <PlaceholderComponent title="Settings" message="Account settings and preferences" />;
      default:
        return <Marketplace />;
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Placeholder component for unimplemented pages
  const PlaceholderComponent = ({ title, message }) => (
    <div className="dashboard-container">
      <h2 className="welcome-text">{title}</h2>
      <div className="user-info">
        <p style={{ fontSize: '16px', color: '#666', textAlign: 'center', padding: '40px' }}>
          {message}<br /><br />
          <span style={{ color: '#667eea' }}>Coming Soon!</span>
        </p>
      </div>
    </div>
  );

  // Navigation bar for desktop
  const DesktopNavBar = () => (
    <nav style={{
      background: 'white',
      padding: '15px 30px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      marginBottom: '30px',
      borderRadius: '10px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <h1 style={{ 
            margin: 0, 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: '24px',
            fontWeight: 'bold'
          }}>
            CampusConnect
          </h1>
          
          {user && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {navigationItems.slice(0, 5).map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    padding: '8px 16px',
                    background: activeTab === item.id ? '#667eea' : 'transparent',
                    color: activeTab === item.id ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '14px',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ color: '#666', fontSize: '14px' }}>
              Hi, {user.user_metadata?.firstname || 'User'}!
            </span>
            <button 
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setShowSignup(false)}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                color: '#667eea',
                border: '2px solid #667eea',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Login
            </button>
            <button
              onClick={() => setShowSignup(true)}
              style={{
                padding: '10px 20px',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Sign Up
            </button>
          </div>
        )}
      </div>
    </nav>
  );

  // Mobile bottom navigation
  const MobileNavBar = () => (
    <>
      {/* Mobile Header */}
      <div style={{
        background: 'white',
        padding: '15px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ 
          margin: 0, 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontSize: '20px',
          fontWeight: 'bold'
        }}>
          CampusConnect
        </h1>
        
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#666', fontSize: '12px' }}>
              Hi, {user.user_metadata?.firstname?.substring(0, 10) || 'User'}!
            </span>
            <button 
              onClick={() => setShowMobileMenu(true)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#667eea'
              }}
            >
              ☰
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSignup(true)}
            style={{
              padding: '8px 16px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Sign In
          </button>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      {user && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'white',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-around',
          padding: '10px 5px',
          zIndex: 1000
        }}>
          {navigationItems.slice(0, 5).map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                background: 'none',
                border: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '5px',
                cursor: 'pointer',
                color: activeTab === item.id ? '#667eea' : '#666',
                minWidth: '60px'
              }}
            >
              <span style={{ fontSize: '20px' }}>{item.icon}</span>
              <span style={{ fontSize: '10px', marginTop: '2px' }}>
                {item.label.length > 10 ? item.label.substring(0, 8) + '..' : item.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Mobile Menu Modal */}
      {showMobileMenu && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            background: 'white',
            height: '100vh',
            width: '80%',
            maxWidth: '300px',
            overflowY: 'auto',
            animation: 'slideIn 0.3s ease'
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #eee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, color: '#333' }}>Menu</h2>
              <button 
                onClick={() => setShowMobileMenu(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '10px 0' }}>
              {navigationItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setShowMobileMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '15px 20px',
                    background: activeTab === item.id ? '#f0f0ff' : 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px',
                    color: activeTab === item.id ? '#667eea' : '#333',
                    fontSize: '16px',
                    borderBottom: '1px solid #f5f5f5'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div style={{ padding: '20px', borderTop: '1px solid #eee' }}>
              <button 
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="app-container">
      {/* Show different nav based on screen size */}
      <div style={{ display: 'none', '@media (min-width: 768px)': { display: 'block' } }}>
        <DesktopNavBar />
      </div>
      <div style={{ display: 'block', '@media (min-width: 768px)': { display: 'none' } }}>
        <MobileNavBar />
      </div>
      
      <div style={{
        paddingBottom: user ? '70px' : '0',
        '@media (min-width: 768px)': { paddingBottom: '0' }
      }}>
        {user ? (
          renderContent()
        ) : showSignup ? (
          <Signup 
            onSwitchToLogin={() => setShowSignup(false)} 
            onSignupComplete={handleSignupComplete}
          />
        ) : (
          <Login onSwitchToSignup={() => setShowSignup(true)} />
        )}
      </div>
    </div>
  );
}

export default App;