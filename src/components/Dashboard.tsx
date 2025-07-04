import React, { useState, useEffect } from 'react';
import { supabase } from '../App';

interface DashboardProps {}

interface Student {
  id: string;
  name: string;
  class: string;
  section: string;
}

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  type: string;
}

interface Notification {
  id: string;
  title: string;
  description: string;
  type: 'announcement' | 'marks' | 'attendance' | 'fee' | 'meeting';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  read_status: boolean;
}

export function Dashboard({}: DashboardProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'urgent'>('all');

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    filterNotifications();
  }, [notifications, searchTerm, filterType]);

  const loadDashboardData = async () => {
    try {
      // Load students
      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .limit(5);
      
      // Load recent events
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date')
        .limit(3);

      // Create sample notifications inspired by the design
      const sampleNotifications: Notification[] = [
        {
          id: '1',
          title: 'Annual Sports Day Announcement',
          description: 'We are excited to announce that the Annual Sports Day will be held on December 15th, 2024. Trials for various events will begin next week. Encourage your child to participate.',
          type: 'announcement',
          priority: 'medium',
          created_at: '2025-01-14T10:23:00Z',
          read_status: false
        },
        {
          id: '2', 
          title: 'Science Exhibition \'Vigyan Mela\'',
          description: 'The annual Science Exhibition \'Vigyan Mela\' is scheduled for January 20th, 2025. This is a great opportunity for students to showcase their innovative projects.',
          type: 'announcement',
          priority: 'medium',
          created_at: '2025-01-14T10:23:00Z',
          read_status: false
        },
        {
          id: '3',
          title: 'Fee Payment Reminder',
          description: 'This is a reminder that the quarterly fee payment is due by January 31st, 2024. Please make the payment to avoid any late fees.',
          type: 'fee',
          priority: 'high',
          created_at: '2025-01-14T09:28:00Z',
          read_status: false
        },
        {
          id: '4',
          title: 'Parent-Teacher Meeting Scheduled',
          description: 'We are organizing a Parent-Teacher Meeting on January 25th, 2024 from 10:00 AM to 4:00 PM. Please mark your calendar.',
          type: 'meeting',
          priority: 'high',
          created_at: '2025-01-14T09:28:00Z',
          read_status: true
        },
        {
          id: '5',
          title: 'Monthly Test Results Published',
          description: 'The results for the monthly tests conducted in December are now available. Check your child\'s performance in the marks section.',
          type: 'marks',
          priority: 'medium',
          created_at: '2025-01-14T08:15:00Z',
          read_status: true
        }
      ];

      setStudents(studentsData || []);
      setEvents(eventsData || []);
      setNotifications(sampleNotifications);
      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoading(false);
    }
  };

  const filterNotifications = () => {
    let filtered = notifications;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(notification =>
        notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notification.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    switch (filterType) {
      case 'unread':
        filtered = filtered.filter(n => !n.read_status);
        break;
      case 'urgent':
        filtered = filtered.filter(n => n.priority === 'high');
        break;
      default:
        break;
    }

    setFilteredNotifications(filtered);
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read_status: true })));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'announcement': return '📢';
      case 'marks': return '📊';
      case 'attendance': return '📅';
      case 'fee': return '💳';
      case 'meeting': return '👥';
      default: return '📝';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'announcement': return 'bg-purple-100 text-purple-800';
      case 'marks': return 'bg-blue-100 text-blue-800';
      case 'attendance': return 'bg-green-100 text-green-800';
      case 'fee': return 'bg-orange-100 text-orange-800';
      case 'meeting': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const unreadCount = notifications.filter(n => !n.read_status).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, Parent! 👋
        </h1>
        <p className="text-gray-600 text-lg">
          Stay updated with your child's academic journey
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* My Children */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">👨‍👩‍👧‍👦</span>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">My Children</h3>
          <p className="text-3xl font-bold text-gray-900 mb-1">{students.length}</p>
          <p className="text-sm text-gray-600">Students</p>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🔔</span>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Notifications</h3>
          <p className="text-3xl font-bold text-gray-900 mb-1">{unreadCount}</p>
          <p className="text-sm text-gray-600">Unread</p>
        </div>

        {/* Events */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📅</span>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Events</h3>
          <p className="text-3xl font-bold text-gray-900 mb-1">{events.length}</p>
          <p className="text-sm text-gray-600">Upcoming</p>
        </div>

        {/* Results */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🏆</span>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Results</h3>
          <p className="text-3xl font-bold text-gray-900 mb-1">0</p>
          <p className="text-sm text-gray-600">Recent</p>
        </div>
      </div>

      {/* Recent Notifications Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔔</span>
              <h2 className="text-2xl font-bold text-gray-900">Recent Notifications</h2>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                ✓ Mark All Read
              </button>
            )}
          </div>

          {/* Search and Filters */}
          <div className="space-y-4">
            {unreadCount > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <span className="text-blue-800 font-medium">{unreadCount} unread</span>
              </div>
            )}
            
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="absolute left-3 top-3.5 text-gray-400 text-lg">🔍</span>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('unread')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === 'unread'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => setFilterType('urgent')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === 'urgent'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Urgent
              </button>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="p-6">
          <div className="space-y-4">
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-6xl mb-4 block">📭</span>
                <p className="text-gray-500 text-lg">No notifications found</p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`border-l-4 rounded-lg p-4 transition-all hover:shadow-md ${
                    notification.read_status 
                      ? 'border-gray-200 bg-gray-50' 
                      : 'border-blue-500 bg-blue-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {notification.title}
                        </h3>
                        <div className="flex gap-2 flex-shrink-0">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(notification.type)}`}>
                            {notification.type}
                          </span>
                          {!notification.read_status && (
                            <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-600 mb-3 leading-relaxed">
                        {notification.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-500">
                          🕒 {formatDate(notification.created_at)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(notification.priority)}`}>
                          {notification.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 