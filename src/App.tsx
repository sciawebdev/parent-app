import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Dashboard } from './components/Dashboard';
import { AttendanceHistory } from './components/AttendanceHistory';
import { MarksView } from './components/MarksView';
import { AdminConsole } from './components/AdminConsole';
import { AuthScreen } from './components/AuthScreen';
import { Notifications } from './components/Notifications';
import { registerFCMToken } from './utils/fcmHelper';

// Initialize Supabase client - use environment variables if available, fallback to parent app project values
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xxwpbyxymzubrkfaojac.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4d3BieXh5bXp1YnJrZmFvamFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NDIyNDgsImV4cCI6MjA2NzExODI0OH0.fgmNbzEhJb2-9gtSTkbfNVEKBQ1yz34dHKqwZE0xIbo';

export const supabase = createClient(supabaseUrl, supabaseKey);

type Screen = 'dashboard' | 'attendance' | 'marks' | 'admin' | 'announcements' | 'events' | 'profile';

interface NavigationItem {
  id: Screen;
  title: string;
  icon: string;
  badge?: number;
}

interface UserRole {
  type: 'admin' | 'parent';
  name: string;
}

const navigationItems: NavigationItem[] = [
  { id: 'dashboard', title: 'Dashboard', icon: '🏠' },
  { id: 'attendance', title: 'Attendance', icon: '📅' },
  { id: 'marks', title: 'Marks', icon: '📊' },
  { id: 'announcements', title: 'Announcements', icon: '📢' },
  { id: 'events', title: 'Events', icon: '📆' },
  { id: 'admin', title: 'Admin Panel', icon: '⚙️' },
  { id: 'profile', title: 'Profile', icon: '👤' },
];

function App() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>({ type: 'parent', name: 'Parent Account' });
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(5); // Sample count

  useEffect(() => {
    checkUser();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await checkUserRole(session.user);
      } else {
        setUserRole({ type: 'parent', name: 'Parent Account' });
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        await checkUserRole(session.user);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkUserRole = async (user: any) => {
    try {
      console.log('Checking user role for:', user.id);
      
      // Check if user is an admin in the teachers table (using maybeSingle to avoid errors)
      const { data: teacher, error: teacherError } = await supabase
        .from('teachers')
        .select('name, role')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (teacherError && !teacherError.message.includes('No rows')) {
        console.warn('Teacher query error:', teacherError.message);
      }

      if (teacher && teacher.role === 'admin') {
        console.log('User is admin:', teacher);
        setUserRole({
          type: 'admin',
          name: teacher.name || 'System Administrator'
        });
        
        // Register FCM token for push notifications after successful role check
        try {
          await registerFCMToken(supabase);
        } catch (fcmError) {
          console.log('FCM registration non-critical error:', fcmError);
        }
        
        return;
      }

      // Check if user is a parent (using maybeSingle to avoid errors)
      const { data: parent, error: parentError } = await supabase
        .from('parents')
        .select('id, name')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (parentError && !parentError.message.includes('No rows')) {
        console.warn('Parent query error:', parentError.message);
      }

      console.log('Parent check result:', parent);
      
      // Set user role with proper name
      setUserRole({
        type: 'parent',
        name: parent?.name || user.email?.split('@')[0] || 'Parent Account'
      });

      // Register FCM token for push notifications after successful role check
      try {
        await registerFCMToken(supabase);
      } catch (fcmError) {
        console.log('FCM registration non-critical error:', fcmError);
      }

      // Register FCM token for push notifications after successful role check
      try {
        await registerFCMToken(supabase);
      } catch (fcmError) {
        console.log('FCM registration non-critical error:', fcmError);
      }

    } catch (error) {
      console.error('Error checking user role:', error);
      // Graceful fallback - set as parent with email-based name
      setUserRole({ 
        type: 'parent', 
        name: user.email?.split('@')[0] || 'User Account'
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserRole({ type: 'parent', name: 'Parent Account' });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleSideMenu = () => {
    setIsSideMenuOpen(!isSideMenuOpen);
  };

  const handleNavigation = (screen: Screen) => {
    setCurrentScreen(screen);
    setIsSideMenuOpen(false); // Close menu after navigation
  };

  const getAccountTypeDisplay = () => {
    return userRole.type === 'admin' ? 'Admin Account' : 'Parent Account';
  };

  const getDashboardTitle = () => {
    return userRole.type === 'admin' ? 'Admin Dashboard' : 'Parent Dashboard';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard />;
      case 'attendance':
        return <AttendanceHistory />;
      case 'marks':
        return <MarksView />;
      case 'admin':
        return <AdminConsole />;
      case 'announcements':
        return <Notifications />;
      case 'events':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Events</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Events section coming soon...</p>
            </div>
          </div>
        );
      case 'profile':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-semibold text-blue-600">
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{userRole.name || user?.email || 'User'}</h2>
                  <p className="text-gray-600">{getAccountTypeDisplay()}</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side - Logo and Menu */}
            <div className="flex items-center gap-4">
              <button
                onClick={toggleSideMenu}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {isSideMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">🏫</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">College Portal</h1>
                  <p className="text-sm text-gray-600 hidden sm:block">{getDashboardTitle()}</p>
                </div>
              </div>
            </div>

            {/* Right side - User info */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900">{user?.email || 'User'}</p>
                <p className="text-xs text-gray-600">{getAccountTypeDisplay()}</p>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold text-blue-600">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Side Menu Overlay */}
      {isSideMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 lg:hidden"
          onClick={() => setIsSideMenuOpen(false)}
        />
      )}

      {/* Side Menu */}
      <div className={`fixed top-0 left-0 h-full w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${
        isSideMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Menu Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">🏫</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">College Portal</h2>
                <p className="text-sm text-gray-600">{getDashboardTitle()}</p>
              </div>
            </div>
            <button
              onClick={() => setIsSideMenuOpen(false)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 lg:hidden"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-2">
          {navigationItems.filter(item => item.id !== 'admin' || userRole.type === 'admin').map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg text-left transition-colors ${
                currentScreen === item.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.title}</span>
              {item.id === 'announcements' && notificationCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                  {notificationCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom Section - User Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold text-blue-600">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{user?.email || 'User'}</p>
              <p className="text-sm text-gray-600">{getAccountTypeDisplay()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className={`pt-16 transition-all duration-300 ${isSideMenuOpen ? 'lg:ml-80' : ''}`}>
        {renderScreen()}
      </main>
    </div>
  );
}

export default App; 