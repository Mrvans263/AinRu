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
  const [showDashboardAfterSignup, setShowDashboardAfterSignup] = useState(false);
  
  // Track auth state: 'login', 'signup', 'complete-profile', 'app'
  const [authState, setAuthState] = useState('login');
  const [isNewUser, setIsNewUser] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let timeoutId;

    const checkAuth = async () => {
      try {
        // Safety timeout: if auth check takes too long, show login
        timeoutId = setTimeout(() => {
          if (isMounted && loading) {
            console.log('Auth check timeout - falling back to login');
            setAuthState('login');
            setLoading(false);
            setInitialCheckDone(true);
          }
        }, 8000); // 8 second timeout

        // 1. Get session from Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          if (isMounted) {
            setAuthState('login');
            setLoading(false);
            setInitialCheckDone(true);
          }
          return;
        }

        if (!session) {
          // No session found - user is not logged in
          if (isMounted) {
            setUser(null);
            setAuthState('login');
            setLoading(false);
            setInitialCheckDone(true);
          }
          return;
        }

        // We have a session - user is logged in
        if (isMounted) {
          setUser(session.user);
        }

        // 2. Check if profile exists in database (with retry logic)
        let retryCount = 0;
        const maxRetries = 2;
        
        const checkProfile = async () => {
          try {
            const { data: userProfile, error: profileError } = await supabase
              .from('users')
              .select('firstname, surname, education, is_student, date_of_birth')
              .eq('id', session.user.id)
              .maybeSingle(); // Use maybeSingle to avoid throwing error

            if (!isMounted) return;

            if (profileError) {
              console.log('Profile check error:', profileError.message);
              
              // If it's a "no rows" error or network issue, retry
              if (retryCount < maxRetries && 
                  (profileError.code === 'PGRST116' || profileError.message.includes('fetch'))) {
                retryCount++;
                console.log(`Retrying profile check (${retryCount}/${maxRetries})...`);
                setTimeout(checkProfile, 1000 * retryCount);
                return;
              }
              
              // Profile doesn't exist or can't be fetched
              setAuthState('complete-profile');
              setIsNewUser(true);
            } else if (userProfile && userProfile.firstname && userProfile.surname) {
              // Profile exists and has required fields
              setAuthState('app');
              setIsNewUser(false);
              
              // Set localStorage flag for consistency
              localStorage.setItem(`user_${session.user.id}_profile_complete`, 'true');
              
              // Check if this is a new signup
              const isNewSignup = localStorage.getItem('just_signed_up');
              if (isNewSignup) {
                setActiveTab('dashboard');
                setShowDashboardAfterSignup(true);
                localStorage.removeItem('just_signed_up');
              }
            } else {
              // Profile exists but is incomplete
              setAuthState('complete-profile');
              setIsNewUser(true);
            }
            
            setLoading(false);
            setInitialCheckDone(true);
            clearTimeout(timeoutId);
            
          } catch (error) {
            console.error('Error in profile check:', error);
            if (isMounted) {
              setAuthState('complete-profile');
              setIsNewUser(true);
              setLoading(false);
              setInitialCheckDone(true);
              clearTimeout(timeoutId);
            }
          }
        };

        // Start profile check
        checkProfile();

      } catch (error) {
        console.error('Auth check failed:', error);
        if (isMounted) {
          setAuthState('login');
          setLoading(false);
          setInitialCheckDone(true);
          clearTimeout(timeoutId);
        }
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event);
      
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        // User logged out
        setUser(null);
        setAuthState('login');
        setIsNewUser(false);
        setShowDashboardAfterSignup(false);
        setActiveTab('marketplace');
        
        // Clear any leftover flags
        localStorage.removeItem('just_signed_up');
      } else if (event === 'SIGNED_IN' && session?.user) {
        // User signed in
        setUser(session.user);
        setLoading(true);
        
        // Check profile after sign in
        try {
          const { data: userProfile } = await supabase
            .from('users')
            .select('firstname, surname')
            .eq('id', session.user.id)
            .maybeSingle();
          
          if (userProfile?.firstname && userProfile?.surname) {
            // Profile is complete
            setAuthState('app');
            setIsNewUser(false);
            localStorage.setItem(`user_${session.user.id}_profile_complete`, 'true');
          } else {
            // Profile incomplete or missing
            setAuthState('complete-profile');
            setIsNewUser(true);
          }
        } catch (error) {
          console.error('Error checking profile after sign in:', error);
          setAuthState('complete-profile');
          setIsNewUser(true);
        } finally {
          setLoading(false);
        }
      } else if (event === 'USER_UPDATED') {
        // User data updated
        if (session?.user) {
          setUser(session.user);
        }
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const handleSignupComplete = () => {
    localStorage.setItem('just_signed_up', 'true');
  };

  const handleProfileComplete = () => {
    if (user) {
      // Mark profile as complete
      localStorage.setItem(`user_${user.id}_profile_complete`, 'true');
    }
    
    setIsNewUser(false);
    setAuthState('app');
    
    // Show dashboard for new users
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