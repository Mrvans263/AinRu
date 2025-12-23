import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

// Layout Components
import Navbar from './components/Layout/Navbar';
import MobileNav from './components/Layout/MobileNav';
import Sidebar from './components/Layout/Sidebar';

// Auth Components
import Login from './components/Auth/Login';
import Signup from './components/Auth/Signup';
import CompleteProfile from './components/Auth/CompleteProfile';

// Page Components
import Dashboard from './components/Pages/Dashboard';
import Marketplace from './components/Pages/Marketplace';
import Feed from './components/Pages/Feed';
import TravelDeals from './components/Pages/TravelDeals';
import MoneyDeals from './components/Pages/MoneyDeals';
import Services from './components/Pages/Services';
import StudentJobs from './components/Pages/StudentJobs';
import Friends from './components/Pages/Friends';
import AllStudents from './components/Pages/AllStudents';
import Messages from './components/Pages/Messages';
import Events from './components/Pages/Events';
import StudyGroups from './components/Pages/StudyGroups';
import Housing from './components/Pages/Housing';
import CampusEats from './components/Pages/CampusEats';
import Settings from './components/Pages/Settings';

// Common Components
import Loading from './components/Common/Loading';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('marketplace');
  
  // Track auth state: 'login', 'signup', 'complete-profile', 'app'
  const [authState, setAuthState] = useState('login');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 1. Check if we have a session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // No session - show login
          setAuthState('login');
          setLoading(false);
          return;
        }
        
        setUser(session.user);
        
        // 2. Check if user has a complete profile in the database
        const { data: userProfile, error } = await supabase
          .from('users')
          .select('firstname, surname, education, is_student, date_of_birth')
          .eq('id', session.user.id)
          .maybeSingle(); // Use maybeSingle to avoid throwing error if no profile
        
        if (error || !userProfile) {
          // No profile found - need to complete profile
          setAuthState('complete-profile');
        } else if (userProfile.firstname && userProfile.surname) {
          // Profile exists and has required fields - go to app
          setAuthState('app');
        } else {
          // Profile exists but missing required fields - complete profile
          setAuthState('complete-profile');
        }
        
      } catch (error) {
        console.error('Auth check error:', error);
        setAuthState('login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setAuthState('login');
        setActiveTab('marketplace');
      } else if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        
        // After sign in, check profile
        const { data: userProfile } = await supabase
          .from('users')
          .select('firstname, surname')
          .eq('id', session.user.id)
          .maybeSingle();
        
        if (userProfile?.firstname && userProfile?.surname) {
          setAuthState('app');
        } else {
          setAuthState('complete-profile');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignupComplete = () => {
    // This just switches to login after signup
    // The actual signup flow will handle the rest
    setAuthState('login');
  };

  const handleProfileComplete = () => {
    // After completing profile, refresh the auth check
    const refreshAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: userProfile } = await supabase
          .from('users')
          .select('firstname, surname')
          .eq('id', session.user.id)
          .maybeSingle();
        
        if (userProfile?.firstname && userProfile?.surname) {
          setAuthState('app');
        }
      }
    };
    refreshAuth();
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setAuthState('login');
      setActiveTab('marketplace');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard user={user} />;
      case 'marketplace': return <Marketplace />;
      case 'feed': return <Feed />;
      case 'travel': return <TravelDeals />;
      case 'money': return <MoneyDeals />;
      case 'services': return <Services />;
      case 'jobs': return <StudentJobs />;
      case 'friends': return <Friends />;
      case 'students': return <AllStudents />;
      case 'messages': return <Messages />;
      case 'events': return <Events />;
      case 'study-groups': return <StudyGroups />;
      case 'housing': return <Housing />;
      case 'campus-eats': return <CampusEats />;
      case 'settings': return <Settings />;
      default: return <Marketplace />;
    }
  };

  if (loading) {
    return <Loading fullscreen />;
  }

  // Render based on authState
  switch (authState) {
    case 'login':
      return <Login onSwitchToSignup={() => setAuthState('signup')} />;
    
    case 'signup':
      return (
        <Signup 
          onSwitchToLogin={() => setAuthState('login')}
          onSignupComplete={handleSignupComplete}
        />
      );
    
    case 'complete-profile':
      if (!user) {
        return <Loading fullscreen />;
      }
      
      return (
        <CompleteProfile 
          user={user}
          onProfileComplete={handleProfileComplete}
          onLogout={handleLogout}
        />
      );
    
    case 'app':
      if (!user) {
        return <Loading fullscreen />;
      }
      
      return (
        <div className="app-container">
          {/* Desktop Navigation */}
          <Navbar 
            user={user}
            onLogout={handleLogout}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          {/* Mobile Navigation */}
          <MobileNav 
            user={user}
            onLogout={handleLogout}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          {/* Main Content */}
          <main className="main-content">
            <div className="content-wrapper">
              {/* Desktop Sidebar */}
              <Sidebar 
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />

              {/* Page Content */}
              <div className="page-content">
                <div className="animate-fade-in">
                  {renderContent()}
                </div>
              </div>
            </div>
          </main>

          {/* Mobile Bottom Nav Spacing */}
          <div className="mobile-bottom-spacing"></div>
        </div>
      );
    
    default:
      return <Login onSwitchToSignup={() => setAuthState('signup')} />;
  }
}

export default App;