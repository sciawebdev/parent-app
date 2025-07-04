import React, { useState, useEffect } from 'react';
import { supabase } from '../App';
import { sendNotification } from '../utils/notificationHelper';

type AdminSection = 'dashboard' | 'users' | 'csv-import' | 'calendar' | 'notifications' | 'settings';

interface AdminNavItem {
  id: AdminSection;
  name: string;
  icon: string;
  description: string;
}

const adminNavItems: AdminNavItem[] = [
  { id: 'dashboard', name: 'Dashboard', icon: '', description: 'Overview and analytics' },
  { id: 'users', name: 'User Management', icon: '', description: 'Manage parents and bulk login generation' },
  { id: 'csv-import', name: 'CSV Import', icon: '', description: 'Import student data' },
  { id: 'calendar', name: 'Calendar & Events', icon: '', description: 'Manage events with RSVP' },
  { id: 'notifications', name: 'Notification Center', icon: '', description: 'Send notifications to parents' },
  { id: 'settings', name: 'Settings', icon: '', description: 'System configuration' },
];

interface Stats {
  totalStudents: number;
  totalParents: number;
  todayAttendance: number;
  pendingNotifications: number;
  recentActivity: Array<{
    id: string;
    type: 'attendance' | 'marks' | 'notification' | 'user';
    message: string;
    timestamp: string;
  }>;
}

interface ImportStats {
  success: boolean;
  inserted: number;
  type: string;
  message: string;
}

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  type: 'announcement' | 'holiday' | 'exam' | 'meeting' | 'event';
  created_by: string;
  created_at: string;
  rsvp_count?: {
    attending: number;
    not_attending: number;
    maybe: number;
    total: number;
  };
}

interface EventForm {
  title: string;
  description: string;
  date: string;
  type: 'announcement' | 'holiday' | 'exam' | 'meeting' | 'event';
}

export function AdminConsole() {
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    totalParents: 0,
    todayAttendance: 0,
    pendingNotifications: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);

  // CSV Import States
  const [importing, setImporting] = useState(false);
  const [importType, setImportType] = useState<'students' | 'attendance' | 'marks'>('students');
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // User Management States
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [generationConfig, setGenerationConfig] = useState({
    classSection: '',
    loginPrefix: 'parent',
    passwordLength: 8,
    notifyParents: true
  });

  // Notification States
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    description: '',
    type: 'announcement' as const,
    priority: 'medium' as const,
    recipients: 'all'
  });
  const [sendingNotification, setSendingNotification] = useState(false);

  // Event management state
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventForm, setEventForm] = useState<EventForm>({
    title: '',
    description: '',
    date: '',
    type: 'event'
  });
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);

  useEffect(() => {
    loadStats();
    loadEvents();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Load actual stats from database
      const [studentsRes, parentsRes, attendanceRes] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }),
        supabase.from('parents').select('id', { count: 'exact', head: true }),
        supabase.from('attendance').select('id', { count: 'exact', head: true }).gte('date', new Date().toISOString().split('T')[0])
      ]);

      setStats({
        totalStudents: studentsRes.count || 0,
        totalParents: parentsRes.count || 0,
        todayAttendance: attendanceRes.count || 0,
        pendingNotifications: 3, // TODO: Calculate from actual pending notifications
        recentActivity: [
          { id: '1', type: 'attendance', message: 'Daily attendance recorded', timestamp: '10 minutes ago' },
          { id: '2', type: 'notification', message: 'Parent notification sent', timestamp: '30 minutes ago' },
          { id: '3', type: 'user', message: 'New parent account created', timestamp: '1 hour ago' },
        ]
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setImportStats(null);

    try {
      const csvText = await file.text();
      const response = await supabase.functions.invoke('import_csv', {
        body: csvText,
        headers: { 'Content-Type': 'text/csv' },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Import failed');
      }

      setImportStats(response.data);
      loadStats(); // Refresh stats after import
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const downloadTemplate = (type: string) => {
    const templates = {
      students: 'Student Name,Student Id,Class,Section,Date of Birth,Parent Email,Parent Phone\nJohn Doe,1001,10,A,2008-05-15,john.parent@email.com,9876543210\nJane Smith,1002,10,B,2008-03-22,jane.parent@email.com,9876543211',
      attendance: 'Student Id,Date,Status,Time\n1001,2024-01-15,Present,09:15\n1002,2024-01-15,Absent,',
      marks: 'Student Id,Subject,Score,Max Score,Term,Exam Type\n1001,Mathematics,85,100,Term 1,Unit Test\n1002,Science,78,100,Term 1,Unit Test'
    };

    const content = templates[type as keyof typeof templates];
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkLoginGeneration = async () => {
    setBulkGenerating(true);
    try {
      // TODO: Implement bulk login generation
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      alert('Bulk login generation feature will be implemented next!');
    } catch (error) {
      console.error('Error generating bulk logins:', error);
    } finally {
      setBulkGenerating(false);
    }
  };

  const handleSendNotification = async () => {
    setSendingNotification(true);
    try {
      await sendNotification({
        type: notificationForm.type,
        title: notificationForm.title,
        description: notificationForm.description,
        priority: notificationForm.priority,
        sender: 'Admin',
        recipients: { all_parents: true },
        send_push: true
      });

      setNotificationForm({
        title: '',
        description: '',
        type: 'announcement',
        priority: 'medium',
        recipients: 'all'
      });

      alert('Notification sent successfully!');
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Failed to send notification');
    } finally {
      setSendingNotification(false);
    }
  };

  // Event management functions
  const loadEvents = async () => {
    try {
      setLoadingEvents(true);
      
      const { data: eventsData, error } = await supabase
        .from('events')
        .select(`
          *,
          rsvp_count:event_rsvps(count)
        `)
        .order('date', { ascending: true });

      if (error) throw error;

      // Get RSVP counts for each event
      const eventsWithRSVP = await Promise.all(
        (eventsData || []).map(async (event) => {
          const { data: rsvpData } = await supabase
            .from('event_rsvps')
            .select('response')
            .eq('event_id', event.id);

          const rsvpCounts = {
            attending: rsvpData?.filter(r => r.response === 'attending').length || 0,
            not_attending: rsvpData?.filter(r => r.response === 'not_attending').length || 0,
            maybe: rsvpData?.filter(r => r.response === 'maybe').length || 0,
            total: rsvpData?.length || 0
          };

          return {
            ...event,
            rsvp_count: rsvpCounts
          };
        })
      );

      setEvents(eventsWithRSVP);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!eventForm.title || !eventForm.date) return;

    setCreatingEvent(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('events')
        .insert([{
          ...eventForm,
          created_by: userData.user?.id
        }]);

      if (error) throw error;

      // Reset form and reload events
      setEventForm({
        title: '',
        description: '',
        date: '',
        type: 'event'
      });
      setShowEventForm(false);
      await loadEvents();

      alert('Event created successfully!');
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Failed to create event');
    } finally {
      setCreatingEvent(false);
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-2xl"></span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats.totalStudents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-2xl"></span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Parents</p>
              <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats.totalParents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <span className="text-2xl"></span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Today's Attendance</p>
              <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats.todayAttendance}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <span className="text-2xl"></span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Notifications</p>
              <p className="text-2xl font-bold text-gray-900">{loading ? '...' : stats.pendingNotifications}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm">
                      {activity.type === 'attendance' ? '' : 
                       activity.type === 'notification' ? '' : 
                       activity.type === 'marks' ? '' : ''}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                  <p className="text-sm text-gray-500">{activity.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderUserManagement = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Bulk Parent Login Generation</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class Section</label>
            <input
              type="text"
              value={generationConfig.classSection}
              onChange={(e) => setGenerationConfig({...generationConfig, classSection: e.target.value})}
              placeholder="e.g., 10-A, 9-B"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Login Prefix</label>
            <input
              type="text"
              value={generationConfig.loginPrefix}
              onChange={(e) => setGenerationConfig({...generationConfig, loginPrefix: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4 mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={generationConfig.notifyParents}
              onChange={(e) => setGenerationConfig({...generationConfig, notifyParents: e.target.checked})}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Send login credentials to parents via notification</span>
          </label>
        </div>

        <button
          onClick={handleBulkLoginGeneration}
          disabled={bulkGenerating || !generationConfig.classSection}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {bulkGenerating ? 'Generating...' : 'Generate Parent Logins'}
        </button>
      </div>
    </div>
  );

  const renderCSVImport = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">CSV Import</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <button
              onClick={() => downloadTemplate('students')}
              className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition-colors"
            >
              <div className="text-2xl mb-2">📊</div>
              <div className="font-medium text-gray-900">Students Template</div>
              <div className="text-sm text-gray-500">Download CSV template</div>
            </button>
          </div>
          
          <div className="text-center">
            <button
              onClick={() => downloadTemplate('attendance')}
              className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition-colors"
            >
              <div className="text-2xl mb-2">📅</div>
              <div className="font-medium text-gray-900">Attendance Template</div>
              <div className="text-sm text-gray-500">Download CSV template</div>
            </button>
          </div>
          
          <div className="text-center">
            <button
              onClick={() => downloadTemplate('marks')}
              className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition-colors"
            >
              <div className="text-2xl mb-2">📈</div>
              <div className="font-medium text-gray-900">Marks Template</div>
              <div className="text-sm text-gray-500">Download CSV template</div>
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Import Type</label>
          <select
            value={importType}
            onChange={(e) => setImportType(e.target.value as 'students' | 'attendance' | 'marks')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="students">Students</option>
            <option value="attendance">Attendance</option>
            <option value="marks">Marks</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select CSV File</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileImport}
            disabled={importing}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {importing && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-blue-700">Importing {importType}...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <div className="text-red-700">{error}</div>
          </div>
        )}

        {importStats && (
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <div className="text-green-700">
              {importStats.success
                ? `Successfully imported ${importStats.inserted} ${importStats.type} records`
                : importStats.message
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderCalendar = () => (
    <div className="space-y-6">
      {/* Event Creation Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Calendar & Events Management</h3>
          <button
            onClick={() => setShowEventForm(!showEventForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showEventForm ? 'Cancel' : '+ Create Event'}
          </button>
        </div>

        {showEventForm && (
          <div className="border-t pt-6 mt-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">Create New Event</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Title *</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                  placeholder="Enter event title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
                <select
                  value={eventForm.type}
                  onChange={(e) => setEventForm({...eventForm, type: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="event">General Event</option>
                  <option value="announcement">Announcement</option>
                  <option value="holiday">Holiday</option>
                  <option value="exam">Exam</option>
                  <option value="meeting">Meeting</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Date & Time *</label>
              <input
                type="datetime-local"
                value={eventForm.date}
                onChange={(e) => setEventForm({...eventForm, date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={eventForm.description}
                onChange={(e) => setEventForm({...eventForm, description: e.target.value})}
                placeholder="Event description, location details, special instructions..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleCreateEvent}
              disabled={creatingEvent || !eventForm.title || !eventForm.date}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
            >
              {creatingEvent ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        )}
      </div>

      {/* Events List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Events</h3>
        
        {loadingEvents ? (
          <div className="text-center py-8">
            <div className="text-gray-500">Loading events...</div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 mb-2">No events found</div>
            <div className="text-sm text-gray-400">Create your first event to get started!</div>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium text-gray-900">{event.title}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        event.type === 'urgent' ? 'bg-red-100 text-red-700' :
                        event.type === 'exam' ? 'bg-yellow-100 text-yellow-700' :
                        event.type === 'meeting' ? 'bg-blue-100 text-blue-700' :
                        event.type === 'holiday' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {event.type}
                      </span>
                    </div>
                    
                    {event.description && (
                      <p className="text-gray-600 text-sm mb-2">{event.description}</p>
                    )}
                    
                    <div className="text-sm text-gray-500">
                      📅 {new Date(event.date).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="text-right ml-4">
                    <div className="text-sm font-medium text-gray-900 mb-1">RSVP Status</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span>Attending: {event.rsvp_count?.attending || 0}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        <span>Not Attending: {event.rsvp_count?.not_attending || 0}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                        <span>Maybe: {event.rsvp_count?.maybe || 0}</span>
                      </div>
                      <div className="border-t pt-1 mt-2 font-medium">
                        Total: {event.rsvp_count?.total || 0}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-2xl">📅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{events.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total RSVPs</p>
              <p className="text-2xl font-bold text-gray-900">
                {events.reduce((sum, event) => sum + (event.rsvp_count?.total || 0), 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <span className="text-2xl">📊</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg. Attendance</p>
              <p className="text-2xl font-bold text-gray-900">
                {events.length > 0 
                  ? Math.round(events.reduce((sum, event) => sum + (event.rsvp_count?.attending || 0), 0) / events.length)
                  : 0
                }%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Send Notification</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notification Type</label>
            <select
              value={notificationForm.type}
              onChange={(e) => setNotificationForm({...notificationForm, type: e.target.value as any})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="announcement">Announcement</option>
              <option value="marks">Marks Update</option>
              <option value="attendance">Attendance Alert</option>
              <option value="fee">Fee Reminder</option>
              <option value="meeting">Meeting Notice</option>
              <option value="urgent">Urgent Notice</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <select
              value={notificationForm.priority}
              onChange={(e) => setNotificationForm({...notificationForm, priority: e.target.value as any})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
          <input
            type="text"
            value={notificationForm.title}
            onChange={(e) => setNotificationForm({...notificationForm, title: e.target.value})}
            placeholder="Notification title"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={notificationForm.description}
            onChange={(e) => setNotificationForm({...notificationForm, description: e.target.value})}
            placeholder="Notification description"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>
          <select
            value={notificationForm.recipients}
            onChange={(e) => setNotificationForm({...notificationForm, recipients: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Parents</option>
            <option value="class">Specific Class</option>
            <option value="individual">Individual Parent</option>
          </select>
        </div>

        <button
          onClick={handleSendNotification}
          disabled={sendingNotification || !notificationForm.title || !notificationForm.description}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {sendingNotification ? 'Sending...' : 'Send Notification'}
        </button>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Settings</h3>
        <p className="text-gray-600">System configuration options will be available here.</p>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="text-blue-700">
            <h4 className="font-medium mb-2">Available Settings:</h4>
            <ul className="text-sm space-y-1">
              <li>• Notification preferences</li>
              <li>• User role management</li>
              <li>• System backup settings</li>
              <li>• Security configurations</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return renderDashboard();
      case 'users':
        return renderUserManagement();
      case 'csv-import':
        return renderCSVImport();
      case 'calendar':
        return renderCalendar();
      case 'notifications':
        return renderNotifications();
      case 'settings':
        return renderSettings();
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex space-x-8 overflow-x-auto">
            {adminNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  activeSection === item.id
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <div className="text-left">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-gray-500">{item.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              {adminNavItems.find(item => item.id === activeSection)?.name}
            </h1>
            <p className="text-gray-600 mt-1">
              {adminNavItems.find(item => item.id === activeSection)?.description}
            </p>
          </div>
          
          {renderActiveSection()}
        </div>
      </div>
    </div>
  );
}
