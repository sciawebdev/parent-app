import React, { useState, useEffect } from 'react';
import { supabase } from '../App';
import { createSampleNotifications } from '../utils/notificationHelper';

interface Notification {
  id: string;
  title: string;
  description: string;
  type: 'announcement' | 'marks' | 'attendance' | 'fee' | 'meeting' | 'urgent';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  read_status: boolean;
  sender?: string;
}

const notificationTypes = [
  { id: 'all', label: 'All', count: 0 },
  { id: 'unread', label: 'Unread', count: 0 },
  { id: 'urgent', label: 'Urgent', count: 0 },
  { id: 'announcement', label: 'Announcements', count: 0 },
  { id: 'marks', label: 'Marks', count: 0 },
  { id: 'attendance', label: 'Attendance', count: 0 },
];

const priorityColors = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

const typeColors = {
  announcement: 'bg-blue-100 text-blue-700',
  marks: 'bg-green-100 text-green-700',
  attendance: 'bg-purple-100 text-purple-700',
  fee: 'bg-orange-100 text-orange-700',
  meeting: 'bg-indigo-100 text-indigo-700',
  urgent: 'bg-red-100 text-red-700',
};

const typeIcons = {
  announcement: '📢',
  marks: '📊',
  attendance: '📅',
  fee: '💰',
  meeting: '👥',
  urgent: '🚨',
};

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Sample notifications data
  const sampleNotifications: Notification[] = [
    {
      id: '1',
      title: 'New Marks Updated',
      description: 'Mathematics marks for mid-term examination have been updated. Please check your student performance.',
      type: 'marks',
      priority: 'medium',
      created_at: '2025-01-14T10:30:00Z',
      read_status: false,
      sender: 'Math Department'
    },
    {
      id: '2',
      title: 'Parent-Teacher Meeting Scheduled',
      description: 'Annual parent-teacher conference scheduled for January 25th. Please confirm your attendance.',
      type: 'meeting',
      priority: 'high',
      created_at: '2025-01-14T09:15:00Z',
      read_status: false,
      sender: 'School Administration'
    },
    {
      id: '3',
      title: 'Attendance Alert',
      description: 'Your child attendance has fallen below 75%. Please ensure regular attendance.',
      type: 'attendance',
      priority: 'high',
      created_at: '2025-01-13T14:45:00Z',
      read_status: true,
      sender: 'Attendance Department'
    },
    {
      id: '4',
      title: 'Fee Payment Reminder',
      description: 'Quarter 2 fee payment is due by January 20th. Please complete the payment to avoid late charges.',
      type: 'fee',
      priority: 'medium',
      created_at: '2025-01-13T11:20:00Z',
      read_status: false,
      sender: 'Accounts Department'
    },
    {
      id: '5',
      title: 'School Holiday Notice',
      description: 'School will remain closed on January 26th for Republic Day celebration.',
      type: 'announcement',
      priority: 'low',
      created_at: '2025-01-12T16:00:00Z',
      read_status: true,
      sender: 'Principal Office'
    },
    {
      id: '6',
      title: 'URGENT: Early Dismissal Tomorrow',
      description: 'Due to maintenance work, school will dismiss 2 hours early tomorrow. Please arrange pickup accordingly.',
      type: 'urgent',
      priority: 'high',
      created_at: '2025-01-14T15:30:00Z',
      read_status: false,
      sender: 'Emergency Notice'
    }
  ];

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    filterNotifications();
  }, [notifications, activeFilter, searchQuery]);

  // Set up real-time subscription for new notifications
  useEffect(() => {
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'notifications' 
        }, 
        (payload) => {
          console.log('Notification change received:', payload);
          loadNotifications(); // Refresh notifications when changes occur
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      // If no notifications from database, use sample data
      if (!data || data.length === 0) {
        setNotifications(sampleNotifications);
      } else {
        setNotifications(data);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading notifications:', error);
      // Fallback to sample data on error
      setNotifications(sampleNotifications);
      setLoading(false);
    }
  };

  const filterNotifications = () => {
    let filtered = [...notifications];

    if (searchQuery.trim()) {
      filtered = filtered.filter(notif => 
        notif.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notif.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    switch (activeFilter) {
      case 'unread':
        filtered = filtered.filter(notif => !notif.read_status);
        break;
      case 'urgent':
        filtered = filtered.filter(notif => notif.type === 'urgent' || notif.priority === 'high');
        break;
      case 'announcement':
      case 'marks':
      case 'attendance':
        filtered = filtered.filter(notif => notif.type === activeFilter);
        break;
    }

    setFilteredNotifications(filtered);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      // Update in database
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read_status: true })
        .eq('id', notificationId);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, read_status: true }
            : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      // Update all unread notifications in database
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read_status: true })
        .eq('read_status', false);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read_status: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getTypeCounts = () => {
    const counts = {
      all: notifications.length,
      unread: notifications.filter(n => !n.read_status).length,
      urgent: notifications.filter(n => n.type === 'urgent' || n.priority === 'high').length,
      announcement: notifications.filter(n => n.type === 'announcement').length,
      marks: notifications.filter(n => n.type === 'marks').length,
      attendance: notifications.filter(n => n.type === 'attendance').length,
    };
    return counts;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const typeCounts = getTypeCounts();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-gray-600 mt-1">Stay updated with school announcements and alerts</p>
          </div>
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Mark All Read
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {notificationTypes.map(type => (
            <button
              key={type.id}
              onClick={() => setActiveFilter(type.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeFilter === type.id 
                  ? 'bg-blue-100 text-blue-700 border-blue-200 border' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type.label}
              {typeCounts[type.id as keyof typeof typeCounts] > 0 && (
                <span className={`px-2 py-1 rounded-full text-xs font-bold min-w-[20px] text-center ${
                  activeFilter === type.id 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-600 text-white'
                }`}>
                  {typeCounts[type.id as keyof typeof typeCounts]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications found</h3>
            <p className="text-gray-600">
              {searchQuery ? 'Try adjusting your search terms' : 'You are all caught up!'}
            </p>
          </div>
        ) : (
          filteredNotifications.map(notification => (
            <div
              key={notification.id}
              onClick={() => !notification.read_status && markAsRead(notification.id)}
              className={`bg-white rounded-lg border p-6 cursor-pointer transition-all hover:shadow-md ${
                !notification.read_status ? 'border-l-4 border-l-blue-500 bg-blue-50' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{typeIcons[notification.type]}</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        typeColors[notification.type]
                      }`}>
                        {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        priorityColors[notification.priority]
                      }`}>
                        {notification.priority.charAt(0).toUpperCase() + notification.priority.slice(1)} Priority
                      </span>
                      {!notification.read_status && (
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                      )}
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {notification.title}
                  </h3>
                  
                  <p className="text-gray-700 mb-3 leading-relaxed">
                    {notification.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span className="font-medium">{notification.sender}</span>
                    <span>{getRelativeTime(notification.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
