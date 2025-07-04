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
  { id: 'csv-import', name: 'CSV Import', icon: '📁', description: 'Import student data' },
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
  type: string;
  message: string;
}

export function AdminPanel() {
  const [importing, setImporting] = useState(false);
  const [importType, setImportType] = useState<'students' | 'attendance' | 'marks'>('students');
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        headers: {
          'Content-Type': 'text/csv',
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Import failed');
      }

      setImportStats(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setImporting(false);
      // Clear the file input
      event.target.value = '';
    }
  };

  const downloadTemplate = (type: string) => {
    const templates = {
      students: 'Student Name,Student Id,Class,Section\nJohn Doe,1,10,A\nJane Smith,2,10,B',
      attendance: 'Student Id,Date,Status\n1,2024-01-15,Present\n2,2024-01-15,Absent',
      marks: 'Student Id,Subject,Score,Max Score,Term\n1,Mathematics,85,100,Term 1\n2,Science,78,100,Term 1'
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

  return (
    <div className="p-4 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-6">CSV Import</h2>
        
        {/* Import Type Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Import Type
          </label>
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

        {/* Template Download */}
        <div className="mb-4">
          <button
            onClick={() => downloadTemplate(importType)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download {importType} Template
          </button>
        </div>

        {/* File Upload */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload CSV File
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileImport}
            disabled={importing}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>

        {importing && (
          <div className="flex items-center text-blue-600 mb-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Importing {importType}...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {importStats && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <h3 className="font-medium text-green-800 mb-2">Import Results</h3>
            <div className="text-green-700">
              <div><span className="font-medium">Type:</span> {importStats.type}</div>
              <div><span className="font-medium">Records Imported:</span> {importStats.inserted}</div>
              <div><span className="font-medium">Status:</span> {importStats.message}</div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Database Stats</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div>Students: Loading...</div>
            <div>Teachers: Loading...</div>
            <div>Parents: Loading...</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Recent Activity</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div>Last import: Never</div>
            <div>Active users: Loading...</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">System Health</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Database: Online
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              API: Online
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 