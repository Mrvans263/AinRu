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
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('marketplace');
  const [showDashboardAfterSignup, setShowDashboardAfterSignup] = useState(false);
  
  // Track auth state: 'login', 'signup', 'complete-profile', 'app'
  const [authState, setAuthState] = useState('login');
  const [isNewUser, setIsNewUser] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  const checkUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('Profile not found for user:', userId);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error checking user profile:', error);
      return null;
    }
  };

  const determineAuthState = (session, profile) => {
    if (!session) {
      return 'login';
    }

    if (!profile) {
      return 'complete-profile';
    }

    // Check if profile is complete
    if (profile.firstname && profile.surname && profile.education && profile.is_student && profile.date_of_birth) {
      return 'app';
    }

    return 'complete-profile';
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        
        // First, get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          if (mounted) {
            setAuthState('login');
            setLoading(false);
          }
          return;
        }

        console.log('Session found:', session ? 'Yes' : 'No');

        if (!session) {
          if (mounted) {
            setUser(null);
            setUserProfile(null);
            setAuthState('login');
            setLoading(false);
            setInitialCheckDone(true);
          }
          return;
        }

        if (mounted) {
          setUser(session.user);
        }

        // Check user profile
        const profile = await checkUserProfile(session.user.id);
        
        if (mounted) {
          setUserProfile(profile);
          
          const newAuthState = determineAuthState(session, profile);
          setAuthState(newAuthState);
          
          if (newAuthState === 'app') {
            setIsNewUser(false);
          } else if (newAuthState === 'complete-profile') {
            setIsNewUser(true);
          }

          const isNewSignup = localStorage.getItem('just_signed_up');
          if (isNewSignup && newAuthState === 'app') {
            setActiveTab('dashboard');
            setShowDashboardAfterSignup(true);
            localStorage.removeItem('just_signed_up');
          }

          setLoading(false);
          setInitialCheckDone(true);
        }

      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setAuthState('login');
          setLoading(false);
          setInitialCheckDone(true);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      if (!mounted) return;

      setUser(session?.user ?? null);

      if (!session) {
        setUserProfile(null);
        setAuthState('login');
        setIsNewUser(false);
        setShowDashboardAfterSignup(false);
        setActiveTab('marketplace');
        localStorage.removeItem('just_signed_up');
        return;
      }

      // For SIGNED_IN event, check profile
      if (event === 'SIGNED_IN') {
        const profile = await checkUserProfile(session.user.id);
        setUserProfile(profile);
        
        const newAuthState = determineAuthState(session, profile);
        setAuthState(newAuthState);
        
        if (newAuthState === 'app') {
          setIsNewUser(false);
        } else if (newAuthState === 'complete-profile') {
          setIsNewUser(true);
        }
      }
      
      // For other events, maintain current state
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignupComplete = () => {
    localStorage.setItem('just_signed_up', 'true');
  };

  const handleProfileComplete = async () => {
    try {
      if (user) {
        // Refresh the profile
        const profile = await checkUserProfile(user.id);
        setUserProfile(profile);
        
        if (profile?.firstname && profile?.surname) {
          setIsNewUser(false);
          setAuthState('app');
        }
      }
    } catch (error) {
      console.error('Error in handleProfileComplete:', error);
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
    switch (activeTab) {
      case 'dashboard': return <Dashboard user={user} profile={userProfile} />;
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
      case 'settings': return <Settings user={user} profile={userProfile} />;
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
      if (!user || !userProfile) {
        return <Loading fullscreen />;
      }
      
      return (
        <div className="app-container">
          {/* Desktop Navigation */}
          <Navbar 
            user={user}
            profile={userProfile}
            onLogout={handleLogout}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          {/* Mobile Navigation */}
          <MobileNav 
            user={user}
            profile={userProfile}
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