import React, { useState, useEffect, useRef, Suspense } from 'react';
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

// ============================================
// APP STATE PERSISTENCE SYSTEM
// ============================================

// Global state persistence
let globalAppState = {
  user: null,
  authState: 'checking',
  activeTab: localStorage.getItem('activeTab') || 'marketplace',
  timestamp: Date.now(),
  isInitialized: false
};

// Persistent storage with error handling
const persistState = (key, value) => {
  try {
    if (typeof value === 'object') {
      sessionStorage.setItem(key, JSON.stringify(value));
    } else {
      sessionStorage.setItem(key, value);
    }
  } catch (e) {
    console.log('Storage error (non-critical):', e);
  }
};

const restoreState = (key, fallback) => {
  try {
    const item = sessionStorage.getItem(key);
    if (!item) return fallback;
    
    if (item.startsWith('{') || item.startsWith('[')) {
      return JSON.parse(item);
    }
    return item;
  } catch (e) {
    console.log('Storage restore error:', e);
    return fallback;
  }
};

// Mobile-specific utilities
const MOBILE_AGENTS = /iPhone|iPad|iPod|Android|webOS|BlackBerry|Windows Phone/i;

function App() {
  // ============================================
  // STATE WITH PERSISTENCE
  // ============================================
  const [user, _setUser] = useState(() => {
    return globalAppState.user || restoreState('user', null);
  });
  
  const [loading, setLoading] = useState(true);
  
  const [authState, _setAuthState] = useState(() => {
    return globalAppState.authState || restoreState('authState', 'checking');
  });
  
  const [activeTab, _setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('activeTab');
    const validTabs = [
      'dashboard', 'marketplace', 'feed', 'travel', 'money',
      'services', 'jobs', 'friends', 'students', 'messages',
      'events', 'study-groups', 'housing', 'campus-eats', 'settings'
    ];
    return savedTab && validTabs.includes(savedTab) ? savedTab : 'marketplace';
  });

  // Refs for preventing re-initialization
  const isMountedRef = useRef(true);
  const isInitializedRef = useRef(false);
  const supabaseSubscriptionRef = useRef(null);
  const visibilityHandlersRef = useRef([]);
  const isProcessingOAuthRef = useRef(false);

  // ============================================
  // PERSISTENT STATE SETTERS
  // ============================================
  const setUser = (newUser) => {
    globalAppState.user = newUser;
    persistState('user', newUser);
    _setUser(newUser);
  };

  const setAuthState = (newAuthState) => {
    globalAppState.authState = newAuthState;
    persistState('authState', newAuthState);
    _setAuthState(newAuthState);
  };

  const setActiveTab = (newTab) => {
    globalAppState.activeTab = newTab;
    localStorage.setItem('activeTab', newTab);
    _setActiveTab(newTab);
  };

  // ============================================
  // CHECK IF WE'RE IN OAUTH FLOW
  // ============================================
  const isOAuthCallback = () => {
    return window.location.pathname === '/auth/callback' ||
           window.location.hash.includes('access_token') ||
           window.location.search.includes('code=');
  };

  // ============================================
  // PREVENT TAB SWITCH REFRESH - CORE FIX
  // ============================================
  useEffect(() => {
    console.log('🚀 App mounted - preventing tab refresh');
    
    // Flag to prevent re-initialization
    isMountedRef.current = true;
    
    // 1. DISABLE PAGE UNLOAD/RELOAD BEHAVIORS
    const preventUnload = (e) => {
      // Only prevent if we're in the app (not during auth flows)
      if (authState === 'app') {
        // Cancel the event
        e.preventDefault();
        // Chrome requires returnValue
        e.returnValue = '';
        return '';
      }
    };
    
    window.addEventListener('beforeunload', preventUnload);
    
    // 2. HANDLE VISIBILITY CHANGES WITHOUT REFRESHING
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('👻 Tab hidden - preserving state');
        // Save everything to sessionStorage for safety
        persistState('appSnapshot', {
          user: user,
          authState: authState,
          activeTab: activeTab,
          timestamp: Date.now()
        });
      }
      
      if (document.visibilityState === 'visible') {
        console.log('👁️ Tab visible - NO REFRESH');
        // DO NOTHING - preserve current state
        // The app should continue exactly where it left off
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 3. HANDLE PAGESHOW (bfcache restore)
    const handlePageShow = (event) => {
      if (event.persisted) {
        console.log('📱 Restored from bfcache - keeping state intact');
        // Restore from sessionStorage if needed
        const snapshot = restoreState('appSnapshot', null);
        if (snapshot && Date.now() - snapshot.timestamp < 300000) { // 5 minutes
          console.log('🔄 Restoring recent snapshot');
          if (snapshot.user && !user) _setUser(snapshot.user);
          if (snapshot.authState && authState !== snapshot.authState) _setAuthState(snapshot.authState);
          if (snapshot.activeTab && activeTab !== snapshot.activeTab) _setActiveTab(snapshot.activeTab);
        }
      }
    };
    
    window.addEventListener('pageshow', handlePageShow);
    
    // 4. PREVENT MOBILE PULL-TO-REFRESH
    document.body.style.overscrollBehavior = 'contain';
    
    // Store handlers for cleanup
    visibilityHandlersRef.current = [
      () => window.removeEventListener('beforeunload', preventUnload),
      () => document.removeEventListener('visibilitychange', handleVisibilityChange),
      () => window.removeEventListener('pageshow', handlePageShow),
      () => { document.body.style.overscrollBehavior = ''; }
    ];

    // 5. INITIALIZE APP ONLY ONCE - but skip if we're in OAuth callback
    if (!isInitializedRef.current && !isOAuthCallback()) {
      initializeApp();
      isInitializedRef.current = true;
    }

    return () => {
      console.log('🧹 Cleaning up app');
      isMountedRef.current = false;
      visibilityHandlersRef.current.forEach(cleanup => cleanup());
    };
  }, []); // EMPTY DEPS - RUN ONLY ONCE

  // ============================================
  // ONE-TIME APP INITIALIZATION - FIXED VERSION
  // ============================================
  const initializeApp = async () => {
    if (isProcessingOAuthRef.current) return;
    
    console.log('⚡ One-time app initialization');
    setLoading(true);
    
    try {
      // Check for existing session WITHOUT triggering re-auth on tab switch
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session check error:', error);
        if (isMountedRef.current) setAuthState('login');
        return;
      }
      
      if (!session) {
        console.log('No active session');
        if (isMountedRef.current) setAuthState('login');
        return;
      }
      
      console.log('✅ Session exists:', session.user.email);
      
      // Set user immediately
      if (isMountedRef.current) {
        setUser(session.user);
        
        // Check profile status
        let profile = null;
        try {
          const { data, error: profileError } = await supabase
            .from('users')
            .select('profile_completed')
            .eq('id', session.user.id)
            .single();
          
          if (!profileError) {
            profile = data;
          }
        } catch (profileError) {
          console.log('Profile check error (non-critical):', profileError);
          profile = null;
        }
        
        if (!profile || !profile.profile_completed) {
          setAuthState('complete-profile');
        } else {
          setAuthState('app');
        }
      }
      
    } catch (error) {
      console.error('Initialization error:', error);
      if (isMountedRef.current) setAuthState('login');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
    
    // Set up ONE-TIME auth listener
    if (!supabaseSubscriptionRef.current) {
      supabaseSubscriptionRef.current = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!isMountedRef.current) return;
          
          console.log('🔔 Auth event (one-time):', event);
          
          switch (event) {
            case 'SIGNED_IN':
            case 'INITIAL_SESSION':
              if (session?.user) {
                console.log('👤 Setting user from', event, ':', session.user.email);
                setUser(session.user);
                isProcessingOAuthRef.current = true;
                
                // Check profile after a delay for OAuth users
                setTimeout(async () => {
                  try {
                    let profile = null;
                    try {
                      const { data, error: profileError } = await supabase
                        .from('users')
                        .select('profile_completed')
                        .eq('id', session.user.id)
                        .single();
                      
                      if (!profileError) {
                        profile = data;
                      }
                    } catch (profileError) {
                      console.log('Profile check error:', profileError);
                    }
                    
                    console.log('📋 Profile result:', profile);
                    
                    if (!profile || !profile.profile_completed) {
                      setAuthState('complete-profile');
                    } else {
                      setAuthState('app');
                    }
                  } catch (error) {
                    console.error('Profile check error:', error);
                    setAuthState('complete-profile');
                  } finally {
                    isProcessingOAuthRef.current = false;
                  }
                }, 1000);
              }
              break;
              
            case 'SIGNED_OUT':
              setUser(null);
              setAuthState('login');
              // Clear persisted state
              sessionStorage.removeItem('user');
              sessionStorage.removeItem('authState');
              sessionStorage.removeItem('appSnapshot');
              break;
              
            case 'TOKEN_REFRESHED':
              // Silent token refresh - DO NOTHING
              console.log('🔄 Token refreshed silently');
              break;
              
            case 'USER_UPDATED':
              if (session?.user) {
                setUser(session.user);
              }
              break;
          }
        }
      );
    }
  };

  // ============================================
  // HANDLE OAUTH CALLBACK REDIRECT
  // ============================================
  useEffect(() => {
    // If we just came from OAuth callback and URL is clean, initialize
    if (window.location.pathname === '/' && 
        !window.location.hash && 
        !window.location.search &&
        !isInitializedRef.current) {
      console.log('🔄 Coming from OAuth callback - initializing app');
      initializeApp();
      isInitializedRef.current = true;
    }
  }, []);

  // ============================================
  // OAUTH CALLBACK HANDLER - MUST BE BEFORE ANY OTHER LOGIC
  // ============================================
  if (window.location.pathname === '/auth/callback') {
    console.log('🔑 Rendering AuthCallback component');
    return <AuthCallback />;
  }

  // ============================================
  // AUTH HANDLERS
  // ============================================
  const handleProfileComplete = async () => {
    if (user) {
      await supabase
        .from('users')
        .update({ 
          profile_completed: true,
          last_login: new Date().toISOString() 
        })
        .eq('id', user.id);
    }
    setAuthState('app');
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setAuthState('login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSwitchToSignup = () => {
    setAuthState('signup');
  };

  const handleSwitchToLogin = () => {
    setAuthState('login');
  };

  // ============================================
  // PAGE CONTENT RENDERER
  // ============================================
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
      case 'messages': return <Messages user={user} onClose={() => setActiveTab('feed')} />;
      case 'events': return <Events />;
      case 'study-groups': return <StudyGroups />;
      case 'housing': return <Housing />;
      case 'campus-eats': return <CampusEats />;
      case 'settings': return <Settings />;
      default: return <Marketplace />;
    }
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return <Loading fullscreen />;
  }

  // ============================================
  // MAIN RENDER BASED ON AUTH STATE
  // ============================================
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
            // Auth listener will handle transition
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
              {/* Desktop Sidebar */}
              <Sidebar 
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                user={user}
              />

              {/* Page Content */}
              <div className={`page-content ${activeTab === 'messages' ? 'messages-active' : ''}`}>
                <div className="animate-fade-in">
                  {renderPageContent()}
                </div>
              </div>
            </div>
          </main>

          {/* Mobile Bottom Nav Spacing */}
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