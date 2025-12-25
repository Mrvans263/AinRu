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
import AuthCallback from './components/Auth/AuthCallback'; // ADDED

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
  // ADD THESE 2 LINES - handles Google OAuth callback
  if (window.location.pathname === '/auth/callback' || window.location.hash.includes('access_token')) {
    return <AuthCallback />;
  }
  
  // EVERYTHING BELOW STAYS EXACTLY THE SAME
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('marketplace');
  const [showDashboardAfterSignup, setShowDashboardAfterSignup] = useState(false);
  
  // Track auth state: 'login', 'signup', 'complete-profile', 'app'
  const [authState, setAuthState] = useState('login');
  const [isNewUser, setIsNewUser] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      
      try {
        // 1. Get session from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // No session - show login
          setUser(null);
          setAuthState('login');
          setLoading(false);
          setInitialCheckDone(true);
          return;
        }
        
        // We have a session
        setUser(session.user);
        
        // 2. Check localStorage FIRST for fast loading
        const hasCompletedProfile = localStorage.getItem(`user_${session.user.id}_profile_complete`);
        
        if (hasCompletedProfile === 'true') {
          // Use localStorage for immediate load (fast)
          setAuthState('app');
          setIsNewUser(false);
          
          // Check for new signup flag
          const isNewSignup = localStorage.getItem('just_signed_up');
          if (isNewSignup) {
            setActiveTab('dashboard');
            setShowDashboardAfterSignup(true);
            localStorage.removeItem('just_signed_up');
          }
          
          // Verify with database in background (slow, but doesn't block UI)
          setTimeout(async () => {
            try {
              const { data: userProfile } = await supabase
                .from('users')
                .select('firstname, surname')
                .eq('id', session.user.id)
                .maybeSingle();
              
              if (!userProfile?.firstname || !userProfile?.surname) {
                // Database says profile is incomplete
                setAuthState('complete-profile');
                setIsNewUser(true);
                localStorage.removeItem(`user_${session.user.id}_profile_complete`);
              }
            } catch (error) {
              console.log('Background profile check failed:', error);
              // If database check fails, we keep the localStorage state
            }
          }, 0);
          
        } else {
          // No localStorage flag - go to complete profile
          setAuthState('complete-profile');
          setIsNewUser(true);
        }
        
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthState('login');
      } finally {
        setLoading(false);
        setInitialCheckDone(true);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);
      
      if (event === 'SIGNED_OUT') {
        // User logged out
        setUser(null);
        setAuthState('login');
        setIsNewUser(false);
        setShowDashboardAfterSignup(false);
        setActiveTab('marketplace');
      } else if (event === 'SIGNED_IN' && session?.user) {
        // User signed in
        setUser(session.user);
        
        // Check if user has completed profile
        const hasCompletedProfile = localStorage.getItem(`user_${session.user.id}_profile_complete`);
        
        if (hasCompletedProfile === 'true') {
          setAuthState('app');
          setIsNewUser(false);
        } else {
          setAuthState('complete-profile');
          setIsNewUser(true);
        }
      } else if (event === 'USER_UPDATED') {
        // User data was updated
        if (session?.user) {
          setUser(session.user);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignupComplete = () => {
    localStorage.setItem('just_signed_up', 'true');
  };

  const handleProfileComplete = () => {
    if (user) {
      // Mark profile as complete in localStorage
      localStorage.setItem(`user_${user.id}_profile_complete`, 'true');
    }
    
    setIsNewUser(false);
    setAuthState('app');
    
    // Show dashboard for new signups
    const isNewSignup = localStorage.getItem('just_signed_up');
    if (isNewSignup) {
      setActiveTab('dashboard');
      setShowDashboardAfterSignup(true);
      localStorage.removeItem('just_signed_up');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setShowDashboardAfterSignup(false);
      setActiveTab('marketplace');
      setAuthState('login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const renderContent = () => {
     console.log('🔍 [APP DEBUG] Rendering content:', {
    activeTab,
    user: user?.id,
    authState,
    loading
  });
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
      case 'messages': 
      console.log('🔍 [APP DEBUG] Rendering Messages with user:', user);
      return <Messages user={user} />;
      case 'events': return <Events />;
      case 'study-groups': return <StudyGroups />;
      case 'housing': return <Housing />;
      case 'campus-eats': return <CampusEats />;
      case 'settings': return <Settings />;
      default: return <Marketplace />;
    }
  };

  if (loading && !initialCheckDone) {
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
      // Show loading while user data is being fetched
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
      // Show loading while user data is being fetched
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