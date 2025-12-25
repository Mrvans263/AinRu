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
import AuthCallback from './components/Auth/AuthCallback';

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
  // Handle Google OAuth callback - MUST BE FIRST
  if (window.location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Load active tab from localStorage
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('activeTab');
    const validTabs = [
      'dashboard', 'marketplace', 'feed', 'travel', 'money',
      'services', 'jobs', 'friends', 'students', 'messages',
      'events', 'study-groups', 'housing', 'campus-eats', 'settings'
    ];
    return savedTab && validTabs.includes(savedTab) ? savedTab : 'marketplace';
  });
  
  // Auth state machine
  const [authState, setAuthState] = useState('checking'); // 'checking' | 'login' | 'signup' | 'complete-profile' | 'app'

  // Save active tab when in app
  useEffect(() => {
    if (authState === 'app') {
      localStorage.setItem('activeTab', activeTab);
    }
  }, [activeTab, authState]);

  // Main auth check - FIXED LOGIC
  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);
      
      try {
        console.log('🔍 Checking authentication...');
        
        // 1. Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('❌ No session found, showing login');
          setAuthState('login');
          setUser(null);
          setLoading(false);
          return;
        }
        
        console.log('✅ Session found for:', session.user.email);
        setUser(session.user);
        
        // 2. Check if user exists in your database
        const { data: userProfile, error: dbError } = await supabase
          .from('users')
          .select('profile_completed, auth_provider, firstname, surname')
          .eq('id', session.user.id)
          .single();
        
        if (dbError) {
          // User doesn't exist in database at all
          console.log('⚠️ User not in database, needs profile creation');
          setAuthState('complete-profile');
          setLoading(false);
          return;
        }
        
        console.log('📊 User profile status:', {
          profile_completed: userProfile.profile_completed,
          auth_provider: userProfile.auth_provider,
          hasName: !!(userProfile.firstname && userProfile.surname)
        });
        
        // 3. DECISION LOGIC: Handle Google vs Email users differently
        if (userProfile.auth_provider === 'google' && !userProfile.profile_completed) {
          // Google user without complete profile
          console.log('➡️ Google user without profile, redirecting to complete-profile');
          setAuthState('complete-profile');
        } else if (!userProfile.profile_completed) {
          // Email user without complete profile
          console.log('➡️ Email user without profile, redirecting to complete-profile');
          setAuthState('complete-profile');
        } else {
          // Profile is complete - go to app
          console.log('✅ Profile complete, redirecting to app');
          setAuthState('app');
        }
        
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        setAuthState('login');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 Auth state change:', event);
      
      if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        setUser(null);
        setAuthState('login');
      } 
      else if (event === 'SIGNED_IN' && session?.user) {
        console.log('👤 User signed in:', session.user.email);
        setUser(session.user);
        
        // Re-check profile status for new sign-ins
        const { data: userProfile } = await supabase
          .from('users')
          .select('profile_completed, auth_provider')
          .eq('id', session.user.id)
          .single();
        
        if (!userProfile?.profile_completed) {
          console.log('➡️ New sign-in needs profile completion');
          setAuthState('complete-profile');
        } else {
          console.log('✅ Returning user with complete profile');
          setAuthState('app');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle profile completion
  const handleProfileComplete = async () => {
    if (user) {
      // Update last login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);
    }
    setAuthState('app');
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setAuthState('login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Switch to signup
  const handleSwitchToSignup = () => {
    setAuthState('signup');
  };

  // Switch to login
  const handleSwitchToLogin = () => {
    setAuthState('login');
  };

  // Render page content based on active tab
  const renderPageContent = () => {
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
      case 'messages': return <Messages user={user} />;
      case 'events': return <Events />;
      case 'study-groups': return <StudyGroups />;
      case 'housing': return <Housing />;
      case 'campus-eats': return <CampusEats />;
      case 'settings': return <Settings />;
      default: return <Marketplace />;
    }
  };

  // Show loading while checking auth
  if (loading) {
    return <Loading fullscreen />;
  }

  // Render based on auth state
  switch (authState) {
    case 'checking':
      return <Loading fullscreen />;
    
    case 'login':
      return <Login onSwitchToSignup={handleSwitchToSignup} />;
    
    case 'signup':
      return (
        <Signup 
          onSwitchToLogin={handleSwitchToLogin}
          onSignupComplete={() => {
            // After signup, user will be automatically signed in
            // The auth listener will handle the state transition
          }}
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
                  {renderPageContent()}
                </div>
              </div>
            </div>
          </main>

          {/* Mobile Bottom Nav Spacing */}
          <div className="mobile-bottom-spacing"></div>
        </div>
      );
    
    default:
      return <Login onSwitchToSignup={handleSwitchToSignup} />;
  }
}

export default App;