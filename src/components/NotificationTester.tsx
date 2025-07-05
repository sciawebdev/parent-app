import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export function NotificationTester() {
  const [title, setTitle] = useState('Test Notification');
  const [message, setMessage] = useState('This is a test notification from SCA Parent App');
  const [type, setType] = useState('test');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const sendTestNotification = async () => {
    setLoading(true);
    setResult(null);

    try {
      console.log('🧪 Sending test notification...');
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Call the notification scheduler function
      const { data, error } = await supabase.functions.invoke('schedule_notifications', {
        body: {
          parent_id: null, // Send to all parents
          title: title,
          message: message,
          type: type,
          schedule_time: new Date().toISOString()
        }
      });

      if (error) {
        throw error;
      }

      console.log('✅ Notification sent successfully:', data);
      setResult(`✅ Success! Sent to ${data.parents_targeted} parent(s), ${data.parents_scheduled} scheduled successfully.`);
      
    } catch (error) {
      console.error('❌ Error sending notification:', error);
      setResult(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sendWelcomeNotification = async () => {
    setLoading(true);
    setResult(null);

    try {
      console.log('👋 Sending welcome notification...');
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Call the notification scheduler function for current user only
      const { data, error } = await supabase.functions.invoke('schedule_notifications', {
        body: {
          parent_id: user.id,
          title: 'Welcome to SCA Parent App! 🎉',
          message: 'Your push notifications are now working correctly. You will receive important updates about your child\'s education.',
          type: 'welcome',
          schedule_time: new Date().toISOString()
        }
      });

      if (error) {
        throw error;
      }

      console.log('✅ Welcome notification sent:', data);
      setResult(`✅ Welcome notification sent successfully!`);
      
    } catch (error) {
      console.error('❌ Error sending welcome notification:', error);
      setResult(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testNotificationTypes = [
    { value: 'test', label: 'Test Notification' },
    { value: 'welcome', label: 'Welcome Message' },
    { value: 'attendance_alert', label: 'Attendance Alert' },
    { value: 'marks_update', label: 'Marks Update' },
    { value: 'announcement', label: 'School Announcement' },
    { value: 'event_reminder', label: 'Event Reminder' },
    { value: 'fee_reminder', label: 'Fee Reminder' },
    { value: 'meeting_invitation', label: 'Meeting Invitation' }
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          🔔 Notification Tester
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notification Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter notification title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notification Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter notification message"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notification Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {testNotificationTypes.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <button
              onClick={sendTestNotification}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Sending...' : 'Send Test Notification'}
            </button>
            
            <button
              onClick={sendWelcomeNotification}
              disabled={loading}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Sending...' : 'Send Welcome to Me'}
            </button>
          </div>

          {result && (
            <div className={`p-4 rounded-md ${
              result.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {result}
            </div>
          )}
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-md">
          <h3 className="font-semibold text-gray-900 mb-2">📱 How to Test:</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• <strong>Send Welcome to Me:</strong> Sends a welcome notification to your current user account</li>
            <li>• <strong>Send Test Notification:</strong> Sends a custom notification to all parents</li>
            <li>• <strong>Check your Android device:</strong> You should receive push notifications</li>
            <li>• <strong>Check browser console:</strong> Look for FCM registration logs</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 