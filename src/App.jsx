// App.jsx
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
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('marketplace');
  const [showDashboardAfterSignup, setShowDashboardAfterSignup] = useState(false);
  
  // Track auth state: 'login', 'signup', 'complete-profile', 'app', 'callback'
  const [authState, setAuthState] = useState('login');
  const [isNewUser, setIsNewUser] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setAuthState('login');
          setLoading(false);
          return;
        }
        
        console.log('Session found:', session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('User found:', session.user.id);
          
          // Check if user exists in users table
          const { data: userData, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
            console.log('Profile not found, user needs to complete profile');
            // New user or profile incomplete
            setIsNewUser(true);
            setAuthState('complete-profile');
          } else if (userData?.firstname && userData?.surname) {
            // Profile is complete
            localStorage.setItem(`user_${session.user.id}_profile_complete`, 'true');
            setIsNewUser(false);
            setAuthState('app');
            
            const isNewSignup = localStorage.getItem('just_signed_up');
            if (isNewSignup) {
              setActiveTab('dashboard');
              setShowDashboardAfterSignup(true);
              localStorage.removeItem('just_signed_up');
            }
          } else {
            // Profile exists but incomplete
            setIsNewUser(true);
            setAuthState('complete-profile');
          }
        } else {
          // No user - show login
          setAuthState('login');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setAuthState('login');
      }
      
      setLoading(false);
      setInitialCheckDone(true);
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth state changed:', _event, session?.user?.id);
      
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Check if user exists in database
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userData?.firstname && userData?.surname) {
          // Profile is complete
          localStorage.setItem(`user_${session.user.id}_profile_complete`, 'true');
          setIsNewUser(false);
          setAuthState('app');
        } else {
          // Profile incomplete
          setIsNewUser(true);
          setAuthState('complete-profile');
        }
      } else {
        // User logged out
        setAuthState('login');
        setIsNewUser(false);
        setShowDashboardAfterSignup(false);
        setActiveTab('marketplace');
        
        // Clear localStorage flags
        localStorage.removeItem('just_signed_up');
      }
      
      setLoading(false);
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

  if (loading && !initialCheckDone) {
    return <Loading fullscreen />;
  }

  // Render based on authState
  switch (authState) {
    case 'callback':
      return <AuthCallback onComplete={() => setAuthState('app')} />;
    
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