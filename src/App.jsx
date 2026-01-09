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
  useEffect(() => {
    console.log('=== APP.JSX DEBUG ===');
    console.log('🔍 Initial check - URL:', window.location.href);
    console.log('🔍 Has hash:', !!window.location.hash);
    console.log('🔍 Hash content:', window.location.hash.substring(0, 100));
    
    const checkAuth = async () => {
      setLoading(true);
      
      try {
        console.log('🔄 Step 1: Getting session...');
        
        // 1. Get session
        const { data: { session } } = await supabase.auth.getSession();
        
        console.log('📋 Session result:', {
          hasSession: !!session,
          userEmail: session?.user?.email,
          userId: session?.user?.id,
          provider: session?.user?.app_metadata?.provider
        });
        
        if (!session) {
          console.log('❌ No session, showing login');
          setAuthState('login');
          setLoading(false);
          return;
        }
        
        console.log('✅ Session found for:', session.user.email);
        setUser(session.user);
        
        // 2. Check if user exists in database
        console.log('🔄 Step 2: Checking database...');
        const { data: userProfile, error: dbError } = await supabase
          .from('users')
          .select('profile_completed, auth_provider, firstname, surname')
          .eq('id', session.user.id)
          .single();
        
        console.log('📋 Database check:', {
          hasProfile: !!userProfile,
          dbError: dbError?.message,
          profileCompleted: userProfile?.profile_completed,
          authProvider: userProfile?.auth_provider,
          hasName: !!(userProfile?.firstname && userProfile?.surname)
        });
        
        // 3. DECISION LOGIC
        if (dbError || !userProfile) {
          console.log('⚠️ User not in database yet');
          setAuthState('complete-profile');
        } else if (!userProfile.profile_completed) {
          console.log('⚠️ Profile incomplete');
          setAuthState('complete-profile');
        } else {
          console.log('✅ Profile complete - going to app');
          setAuthState('app');
        }
        
      } catch (error) {
        console.error('❌ Auth check error:', error);
        setAuthState('login');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
    
    // Auth listener with debugging
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 Auth state change:', event, {
        hasSession: !!session,
        userEmail: session?.user?.email
      });
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setAuthState('login');
      } 
      else if (session) {
        setUser(session.user);
        // Re-check after auth change
        setTimeout(() => checkAuth(), 300);
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
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

  // Main auth check - FIXED with proper OAuth handling
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      if (!mounted) return;
      
      setLoading(true);
      
      try {
        console.log('🔍 Checking authentication...');
        
        // 1. Get current session - WAIT for it
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          if (mounted) {
            setAuthState('login');
            setLoading(false);
          }
          return;
        }
        
        console.log('📊 Session check result:', {
          hasSession: !!session,
          userEmail: session?.user?.email
        });
        
        if (!session) {
          console.log('❌ No session found, showing login');
          if (mounted) {
            setAuthState('login');
            setLoading(false);
          }
          return;
        }
        
        console.log('✅ Session found for:', session.user.email);
        
        if (mounted) {
          setUser(session.user);
        }
        
        // 2. Small delay to ensure database is ready (for new OAuth users)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 3. Check if user exists in your database
        const { data: userProfile, error: dbError } = await supabase
          .from('users')
          .select('profile_completed, auth_provider, firstname, surname')
          .eq('id', session.user.id)
          .single();
        
        if (dbError) {
          console.log('⚠️ User not in database yet:', dbError.message);
          
          // Check if this is a brand new OAuth user
          if (session.user.app_metadata?.provider === 'google') {
            console.log('➡️ New Google user, redirecting to complete-profile');
            if (mounted) setAuthState('complete-profile');
          } else {
            console.log('➡️ User needs profile creation');
            if (mounted) setAuthState('complete-profile');
          }
          
          if (mounted) setLoading(false);
          return;
        }
        
        console.log('📊 User profile status:', {
          profile_completed: userProfile.profile_completed,
          auth_provider: userProfile.auth_provider,
          hasName: !!(userProfile.firstname && userProfile.surname)
        });
        
        if (mounted) {
          // 4. DECISION LOGIC
          if (!userProfile.profile_completed) {
            console.log('➡️ Incomplete profile, redirecting to complete-profile');
            setAuthState('complete-profile');
          } else {
            console.log('✅ Profile complete, redirecting to app');
            setAuthState('app');
          }
          setLoading(false);
        }
        
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        if (mounted) {
          setAuthState('login');
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes - SIMPLIFIED
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 Auth state change:', event);
      
      if (!mounted) return;
      
      if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        setUser(null);
        setAuthState('login');
      } 
      else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        console.log('👤 Auth event:', event, 'for user:', session?.user?.email);
        
        if (session?.user) {
          setUser(session.user);
          
          // Small delay for database sync
          setTimeout(async () => {
            if (!mounted) return;
            
            const { data: userProfile } = await supabase
              .from('users')
              .select('profile_completed')
              .eq('id', session.user.id)
              .single();
            
            if (!userProfile?.profile_completed) {
              console.log('➡️ Needs profile completion');
              setAuthState('complete-profile');
            } else {
              console.log('✅ Profile complete, going to app');
              setAuthState('app');
            }
          }, 300);
        }
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
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
          {/* Desktop Navigation - Always show */}
          <Navbar 
            user={user}
            onLogout={handleLogout}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          {/* Mobile Navigation - Hide when in Messages */}
          {activeTab !== 'messages' && (
            <MobileNav 
              user={user}
              onLogout={handleLogout}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          )}

          {/* Main Content */}
          <main className="main-content">
            <div className="content-wrapper">
              {/* Desktop Sidebar - Always show */}
              <Sidebar 
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />

              {/* Page Content */}
              <div className={`page-content ${activeTab === 'messages' ? 'messages-active' : ''}`}>
                <div className="animate-fade-in">
                  {renderPageContent()}
                </div>
              </div>
            </div>
          </main>

          {/* Mobile Bottom Nav Spacing - Hide when in Messages */}
          {activeTab !== 'messages' && (
            <div className="mobile-bottom-spacing"></div>
          )}
        </div>
      );
    
    default:
      return <Login onSwitchToSignup={handleSwitchToSignup} />;
  }
}

export default App;