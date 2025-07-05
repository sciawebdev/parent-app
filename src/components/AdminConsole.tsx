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
  { id: 'dashboard', name: 'Dashboard', icon: '📊', description: 'Overview and analytics' },
  { id: 'users', name: 'User Management', icon: '👥', description: 'Manage parents and bulk login generation' },
  { id: 'csv-import', name: 'CSV Import', icon: '📋', description: 'Import student data' },
  { id: 'calendar', name: 'Calendar & Events', icon: '📅', description: 'Manage events with RSVP' },
  { id: 'notifications', name: 'Notification Center', icon: '🔔', description: 'Send notifications to parents' },
  { id: 'settings', name: 'Settings', icon: '⚙️', description: 'System configuration' },
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
  updated: number;
  failed: number;
  type: string;
  message: string;
  errors?: Array<{
    row: number;
    field: string;
    value: string;
    error: string;
  }>;
  preview?: Array<Record<string, string>>;
}

interface BulkLoginConfig {
  classSection?: string;
  loginPrefix: string;
  notifyParents: boolean;
  generateFor: 'new_parents' | 'all_parents' | 'specific_students';
  studentIds?: string[];
  passwordLength: number;
  customPassword?: string;
}

interface BulkLoginResult {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  results: Array<{
    studentName: string;
    parentEmail: string;
    parentLogin: string;
    parentPassword: string;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
  }>;
  errors: string[];
}

interface CSVPreview {
  headers: string[];
  rows: Array<Record<string, string>>;
  totalRows: number;
  detectedType: string;
  validation: {
    hasErrors: boolean;
    missingRequired: string[];
    invalidData: Array<{
      row: number;
      field: string;
      value: string;
      issue: string;
    }>;
  };
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

  // Enhanced CSV Import States
  const [importing, setImporting] = useState(false);
  const [importType, setImportType] = useState<'students' | 'attendance' | 'marks'>('students');
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<CSVPreview | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // User Management States
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkLoginResult, setBulkLoginResult] = useState<BulkLoginResult | null>(null);
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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);
    setCsvPreview(null);
    setImportStats(null);

    try {
      const csvText = await file.text();
      const preview = await generatePreview(csvText);
      setCsvPreview(preview);
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
    }
  };

  const generatePreview = async (csvText: string): Promise<CSVPreview> => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least header and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1, 6).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    const detectedType = detectCSVType(headers);
    const validation = validateCSVStructure(headers, rows, detectedType);

    return {
      headers,
      rows,
      totalRows: lines.length - 1,
      detectedType,
      validation
    };
  };

  const detectCSVType = (headers: string[]): string => {
    const headerStr = headers.map(h => h.toLowerCase()).join('|');
    
    if (headerStr.includes('student name') || headerStr.includes('student_name') || headerStr.includes('name')) {
      return 'students';
    }
    if (headerStr.includes('status') || headerStr.includes('present') || headerStr.includes('absent')) {
      return 'attendance';
    }
    if (headerStr.includes('score') || headerStr.includes('marks') || headerStr.includes('subject')) {
      return 'marks';
    }
    
    return 'unknown';
  };

  const validateCSVStructure = (headers: string[], rows: Array<Record<string, string>>, type: string) => {
    const validation = {
      hasErrors: false,
      missingRequired: [] as string[],
      invalidData: [] as Array<{ row: number; field: string; value: string; issue: string; }>
    };

    const requiredFields = {
      students: ['Student Name', 'Student Id', 'Class'],
      attendance: ['Student Id', 'Date', 'Status'],
      marks: ['Student Id', 'Subject', 'Score']
    };

    const required = requiredFields[type as keyof typeof requiredFields] || [];
    
    // Check for missing required headers
    required.forEach(field => {
      if (!headers.some(h => h.toLowerCase().includes(field.toLowerCase().replace(' ', '_')) || 
                            h.toLowerCase().includes(field.toLowerCase()))) {
        validation.missingRequired.push(field);
        validation.hasErrors = true;
      }
    });

    // Validate data in preview rows
    rows.forEach((row, index) => {
      Object.entries(row).forEach(([field, value]) => {
        if (type === 'students' && field.toLowerCase().includes('email') && value) {
          if (!value.includes('@')) {
            validation.invalidData.push({
              row: index + 2,
              field,
              value,
              issue: 'Invalid email format'
            });
            validation.hasErrors = true;
          }
        }
        
        if (type === 'marks' && field.toLowerCase().includes('score') && value) {
          if (isNaN(Number(value))) {
            validation.invalidData.push({
              row: index + 2,
              field,
              value,
              issue: 'Score must be a number'
            });
            validation.hasErrors = true;
          }
        }
      });
    });

    return validation;
  };

  const handleConfirmImport = async () => {
    if (!selectedFile || !csvPreview) return;

    setImporting(true);
    setError(null);
    setImportProgress(0);

    try {
      const csvText = await selectedFile.text();
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await supabase.functions.invoke('import_csv', {
        body: JSON.stringify({
          csvData: csvText,
          importType: importType,
          skipValidation: false
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      if (response.error) {
        throw new Error(response.error.message || 'Import failed');
      }

      setImportStats(response.data);
      loadStats(); // Refresh stats after import
      setShowPreview(false);
      setCsvPreview(null);
      setSelectedFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setImporting(false);
      setImportProgress(0);
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
    setError(null);
    setBulkLoginResult(null);

    try {
      const config: BulkLoginConfig = {
        classSection: generationConfig.classSection,
        loginPrefix: generationConfig.loginPrefix,
        notifyParents: generationConfig.notifyParents,
        generateFor: 'new_parents',
        passwordLength: generationConfig.passwordLength
      };

      console.log('Calling bulk login generation with config:', config);

      const response = await supabase.functions.invoke('bulk_login_generation', {
        body: config
      });

      console.log('Bulk login generation response:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Bulk login generation failed');
      }

      setBulkLoginResult(response.data);
      loadStats(); // Refresh stats after generation
      
      alert(`Bulk login generation completed! Created ${response.data.successful} accounts successfully.`);
    } catch (err) {
      console.error('Error in bulk login generation:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      alert('Failed to generate bulk logins. Please check the console for details.');
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
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm border border-blue-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Total Students</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">{loading ? '...' : stats.totalStudents}</p>
              <p className="text-sm text-blue-600 mt-1">Active enrollments</p>
            </div>
            <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
              <span className="text-3xl text-white">👥</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-600 uppercase tracking-wide">Total Parents</p>
              <p className="text-3xl font-bold text-green-900 mt-2">{loading ? '...' : stats.totalParents}</p>
              <p className="text-sm text-green-600 mt-1">Registered accounts</p>
            </div>
            <div className="p-3 bg-green-600 rounded-xl shadow-lg">
              <span className="text-3xl text-white">👨‍👩‍👧‍👦</span>
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
        <h3 className="text-lg font-medium text-gray-900 mb-4">🔐 Bulk Parent Login Generation</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class Section (Optional)</label>
            <input
              type="text"
              value={generationConfig.classSection}
              onChange={(e) => setGenerationConfig({...generationConfig, classSection: e.target.value})}
              placeholder="e.g., 10-A, 9-B or leave empty for all"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty to generate for all students</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Login Prefix</label>
            <input
              type="text"
              value={generationConfig.loginPrefix}
              onChange={(e) => setGenerationConfig({...generationConfig, loginPrefix: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Username format: {generationConfig.loginPrefix}_studentID</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Password Length</label>
          <input
            type="number"
            min="6"
            max="20"
            value={generationConfig.passwordLength}
            onChange={(e) => setGenerationConfig({...generationConfig, passwordLength: parseInt(e.target.value)})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Password length (6-20 characters)</p>
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
          disabled={bulkGenerating}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center"
        >
          {bulkGenerating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Generating Logins...
            </>
          ) : (
            <>
              🔐 Generate Parent Logins
            </>
          )}
        </button>

        {/* Results Display */}
        {bulkLoginResult && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Generation Results</h4>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{bulkLoginResult.successful}</div>
                <div className="text-sm text-gray-600">Successful</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{bulkLoginResult.failed}</div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{bulkLoginResult.skipped}</div>
                <div className="text-sm text-gray-600">Skipped</div>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              <table className="min-w-full bg-white rounded-lg shadow-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parent Email</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Password</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {bulkLoginResult.results.map((result, index) => (
                    <tr key={index} className={result.status === 'success' ? 'bg-green-50' : result.status === 'failed' ? 'bg-red-50' : 'bg-yellow-50'}>
                      <td className="px-4 py-2 text-sm text-gray-900">{result.studentName}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{result.parentEmail}</td>
                      <td className="px-4 py-2 text-sm font-mono text-gray-900">{result.parentLogin}</td>
                      <td className="px-4 py-2 text-sm font-mono text-gray-900">{result.parentPassword}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          result.status === 'success' ? 'bg-green-100 text-green-800' :
                          result.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {result.status}
                        </span>
                        {result.error && (
                          <div className="text-xs text-red-600 mt-1">{result.error}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex space-x-2">
              <button
                onClick={() => {
                  const csvContent = [
                    ['Student Name', 'Parent Email', 'Username', 'Password', 'Status'],
                    ...bulkLoginResult.results.map(r => [r.studentName, r.parentEmail, r.parentLogin, r.parentPassword, r.status])
                  ].map(row => row.join(',')).join('\n');
                  
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `bulk_login_results_${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                📥 Download Results (CSV)
              </button>
              <button
                onClick={() => setBulkLoginResult(null)}
                className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
              >
                Clear Results
              </button>
            </div>
          </div>
        )}
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
            onChange={handleFileSelect}
            disabled={importing}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* CSV Preview Section */}
        {showPreview && csvPreview && (
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-medium text-gray-900">CSV Preview</h4>
              <span className="text-sm text-gray-600">
                Detected: {csvPreview.detectedType} | Total rows: {csvPreview.totalRows}
              </span>
            </div>

            {/* Validation Errors */}
            {csvPreview.validation.hasErrors && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg mb-4">
                <h5 className="font-medium text-red-800 mb-2">Validation Issues Found:</h5>
                
                {csvPreview.validation.missingRequired.length > 0 && (
                  <div className="mb-2">
                    <span className="text-red-700 text-sm">Missing required fields: </span>
                    <span className="text-red-600 font-medium">
                      {csvPreview.validation.missingRequired.join(', ')}
                    </span>
                  </div>
                )}

                {csvPreview.validation.invalidData.length > 0 && (
                  <div>
                    <span className="text-red-700 text-sm">Data validation errors:</span>
                    <ul className="mt-1 text-sm text-red-600">
                      {csvPreview.validation.invalidData.slice(0, 5).map((error, index) => (
                        <li key={index}>
                          Row {error.row}, {error.field}: {error.issue} (value: "{error.value}")
                        </li>
                      ))}
                      {csvPreview.validation.invalidData.length > 5 && (
                        <li>... and {csvPreview.validation.invalidData.length - 5} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Data Preview Table */}
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    {csvPreview.headers.map((header, index) => (
                      <th key={index} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {csvPreview.rows.map((row, index) => (
                    <tr key={index}>
                      {csvPreview.headers.map((header, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {row[header] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={handleConfirmImport}
                disabled={csvPreview.validation.hasErrors || importing}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
              >
                {importing ? 'Importing...' : `Import ${csvPreview.totalRows} Records`}
              </button>
              
              <button
                onClick={() => {
                  setShowPreview(false);
                  setCsvPreview(null);
                  setSelectedFile(null);
                }}
                disabled={importing}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Import Progress */}
        {importing && (
          <div className="bg-blue-50 p-4 rounded-lg mb-4">
            <div className="flex items-center mb-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-blue-700">Importing {importType}...</span>
            </div>
            
            {importProgress > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                ></div>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-4">
            <div className="flex">
              <div className="text-red-400 mr-2">⚠️</div>
              <div>
                <h4 className="text-red-800 font-medium">Import Error</h4>
                <div className="text-red-700 mt-1">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Success Results */}
        {importStats && (
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <div className="flex">
              <div className="text-green-400 mr-2">✅</div>
              <div>
                <h4 className="text-green-800 font-medium">Import Complete</h4>
                <div className="text-green-700 mt-1">
                  <div>Successfully imported: {importStats.inserted} records</div>
                  {importStats.updated > 0 && <div>Updated: {importStats.updated} records</div>}
                  {importStats.failed > 0 && <div className="text-orange-600">Failed: {importStats.failed} records</div>}
                </div>
                
                {importStats.errors && importStats.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-green-600 hover:text-green-800">
                      View Error Details ({importStats.errors.length} errors)
                    </summary>
                    <div className="mt-2 max-h-40 overflow-y-auto">
                      {importStats.errors.map((error, index) => (
                        <div key={index} className="text-sm text-red-600 py-1">
                          Row {error.row}: {error.field} - {error.error}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Enhanced Navigation Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Admin Console</h1>
                <p className="text-sm text-gray-500">School Communication App</p>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setActiveSection('notifications')}
                className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors"
                title="Quick Notification"
              >
                <span className="text-xl">🔔</span>
                {stats.pendingNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {stats.pendingNotifications}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveSection('csv-import')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                title="Quick Import"
              >
                Quick Import
              </button>
            </div>
          </div>
          
          {/* Enhanced Navigation Tabs */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {adminNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center space-x-3 px-5 py-3 rounded-xl whitespace-nowrap transition-all duration-200 ${
                  activeSection === item.id
                    ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 hover:shadow-md'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <div className="text-left">
                  <div className="font-semibold text-sm">{item.name}</div>
                  <div className={`text-xs ${
                    activeSection === item.id ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {item.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content with Enhanced Layout */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb and Page Header */}
          <div className="mb-8 bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                  <span>Admin Console</span>
                  <span>›</span>
                  <span className="text-blue-600 font-medium">
                    {adminNavItems.find(item => item.id === activeSection)?.name}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  {adminNavItems.find(item => item.id === activeSection)?.name}
                </h2>
                <p className="text-gray-600">
                  {adminNavItems.find(item => item.id === activeSection)?.description}
                </p>
              </div>
              
              {/* Page-specific actions */}
              <div className="flex items-center space-x-3">
                {activeSection === 'dashboard' && (
                  <button
                    onClick={loadStats}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                    title="Refresh Data"
                  >
                    🔄 Refresh
                  </button>
                )}
                {activeSection === 'calendar' && (
                  <button
                    onClick={() => setShowEventForm(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    ➕ New Event
                  </button>
                )}
                {activeSection === 'notifications' && (
                  <button
                    onClick={() => setNotificationForm({
                      title: '',
                      description: '',
                      type: 'announcement',
                      priority: 'medium',
                      recipients: 'all'
                    })}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    📢 Quick Send
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Main Content Area */}
          <div className="space-y-6">
            {renderActiveSection()}
          </div>
        </div>
      </div>
    </div>
  );
}
 