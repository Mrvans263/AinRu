import React, { useState, useEffect, useRef } from 'react';
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

// Mobile-specific utilities
const MOBILE_AGENTS = /iPhone|iPad|iPod|Android|webOS|BlackBerry|Windows Phone/i;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authState, setAuthState] = useState('checking');
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('activeTab');
    const validTabs = [
      'dashboard', 'marketplace', 'feed', 'travel', 'money',
      'services', 'jobs', 'friends', 'students', 'messages',
      'events', 'study-groups', 'housing', 'campus-eats', 'settings'
    ];
    return savedTab && validTabs.includes(savedTab) ? savedTab : 'marketplace';
  });

  // Refs for mobile optimization
  const isMobileRef = useRef(false);
  const authInitializedRef = useRef(false);
  const visibilityHandlersRef = useRef([]);
  const fileSelectionGuardRef = useRef(null);

  // ============================================
  // MOBILE OPTIMIZATION: Page Lifecycle Management
  // ============================================
  useEffect(() => {
    // Detect mobile
    isMobileRef.current = MOBILE_AGENTS.test(navigator.userAgent);
    
    if (isMobileRef.current) {
      console.log('📱 Mobile device detected, applying optimizations');
      
      // 1. Prevent iOS Safari from unloading the page during file selection
      const preventUnload = (e) => {
        // Check if we're in the middle of file selection
        const isSelectingFile = sessionStorage.getItem('isSelectingFile') === 'true';
        if (isSelectingFile) {
          e.preventDefault();
          e.returnValue = '';
          return '';
        }
      };
      
      window.addEventListener('beforeunload', preventUnload);
      visibilityHandlersRef.current.push(() => {
        window.removeEventListener('beforeunload', preventUnload);
      });

      // 2. Handle iOS page cache issues
      window.onpageshow = (event) => {
        if (event.persisted) {
          console.log('📱 Page restored from bfcache (iOS)');
          // Restore file selection state if needed
          restoreFileSelectionState();
        }
      };

      // 3. Disable pull-to-refresh on mobile (causes accidental reloads)
      document.body.style.overscrollBehavior = 'contain';

      // 4. Prevent zoom on file input focus (iOS specific)
      const preventZoom = (e) => {
        if (e.target.type === 'file') {
          e.target.style.fontSize = '16px'; // iOS won't zoom if font >= 16px
        }
      };
      
      document.addEventListener('focus', preventZoom, true);
      visibilityHandlersRef.current.push(() => {
        document.removeEventListener('focus', preventZoom, true);
      });

      // 5. File selection guard - monitors when file picker is opened
      fileSelectionGuardRef.current = setInterval(() => {
        const selectingFile = sessionStorage.getItem('isSelectingFile');
        const selectionStart = parseInt(sessionStorage.getItem('fileSelectionStart') || '0');
        
        if (selectingFile === 'true' && Date.now() - selectionStart > 30000) {
          // Clean up if selection took too long (probably canceled)
          sessionStorage.removeItem('isSelectingFile');
          sessionStorage.removeItem('fileSelectionStart');
        }
      }, 1000);
    }

    return () => {
      // Cleanup all mobile-specific handlers
      visibilityHandlersRef.current.forEach(cleanup => cleanup());
      if (fileSelectionGuardRef.current) {
        clearInterval(fileSelectionGuardRef.current);
      }
      document.body.style.overscrollBehavior = '';
    };
  }, []);

  const restoreFileSelectionState = () => {
    // This would be implemented by child components
    // Each file input component can check for pending selections
    console.log('📱 Checking for pending file selections...');
  };

  // ============================================
  // AUTHENTICATION MANAGEMENT (Optimized for Mobile)
  // ============================================
  useEffect(() => {
    let mounted = true;
    let authCheckTimeout = null;
    let isCheckingAuth = false;

    const initializeAuth = async () => {
      if (!mounted || isCheckingAuth) return;
      
      isCheckingAuth = true;
      setLoading(true);
      
      try {
        console.log('🔐 Initializing authentication...');
        
        // Get session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          if (mounted) setAuthState('login');
          return;
        }
        
        if (!session) {
          console.log('No session found');
          if (mounted) setAuthState('login');
          return;
        }
        
        console.log('✅ Session found:', session.user.email);
        if (mounted) setUser(session.user);
        
        // Check user profile with retry logic (important for mobile)
        let userProfile = null;
        let retries = 3;
        
        while (retries > 0) {
          try {
            const { data, error } = await supabase
              .from('users')
              .select('profile_completed, auth_provider, firstname, surname')
              .eq('id', session.user.id)
              .single();
            
            if (error) throw error;
            
            userProfile = data;
            break;
          } catch (error) {
            retries--;
            if (retries === 0) throw error;
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        if (!userProfile) {
          console.log('User profile not found, redirecting to complete-profile');
          if (mounted) setAuthState('complete-profile');
        } else if (!userProfile.profile_completed) {
          console.log('Profile incomplete');
          if (mounted) setAuthState('complete-profile');
        } else {
          console.log('✅ Authentication complete, entering app');
          if (mounted) setAuthState('app');
        }
        
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) setAuthState('login');
      } finally {
        if (mounted) {
          setLoading(false);
          isCheckingAuth = false;
          authInitializedRef.current = true;
        }
      }
    };

    // Single auth state change listener (optimized)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('🔔 Auth event:', event);
        
        // Debounce rapid auth events (common on mobile)
        if (authCheckTimeout) clearTimeout(authCheckTimeout);
        
        authCheckTimeout = setTimeout(async () => {
          if (event === 'SIGNED_OUT') {
            console.log('👋 User signed out');
            setUser(null);
            setAuthState('login');
          } 
          else if (session?.user) {
            setUser(session.user);
            
            if (event === 'SIGNED_IN') {
              // Only do full check for SIGNED_IN events
              initializeAuth();
            }
            // For TOKEN_REFRESHED, just update user if needed
            else if (event === 'TOKEN_REFRESHED' && authState === 'app') {
              // Stay in app, don't reinitialize
              console.log('🔄 Token refreshed, staying in app');
            }
          }
        }, 100);
      }
    );

    // Start auth initialization
    initializeAuth();

    return () => {
      mounted = false;
      if (authCheckTimeout) clearTimeout(authCheckTimeout);
      subscription?.unsubscribe();
    };
  }, []);

  // ============================================
  // OAuth Callback Handler (Must be first!)
  // ============================================
  if (window.location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }

  // ============================================
  // Save active tab when in app
  // ============================================
  useEffect(() => {
    if (authState === 'app') {
      localStorage.setItem('activeTab', activeTab);
    }
  }, [activeTab, authState]);

  // ============================================
  // Auth Handlers
  // ============================================
  const handleProfileComplete = async () => {
    if (user) {
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
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
  // Page Content Renderer
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
  // Loading State
  // ============================================
  if (loading) {
    return <Loading fullscreen />;
  }

  // ============================================
  // Main Render Based on Auth State
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