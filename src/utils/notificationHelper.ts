import { supabase } from '../App';

export interface CreateNotificationRequest {
  type: 'marks' | 'attendance' | 'announcement' | 'fee' | 'meeting' | 'urgent';
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high';
  sender?: string;
  data?: Record<string, any>;
  recipients?: {
    student_ids?: string[];
    parent_ids?: string[];
    class_sections?: string[]; // e.g., ["10-A", "10-B"]
    all_parents?: boolean;
    all_teachers?: boolean;
  };
  send_push?: boolean;
  schedule?: string; // ISO timestamp for scheduled notifications
}

export interface NotificationTemplate {
  template: string;
  template_data: any[];
  recipients?: CreateNotificationRequest['recipients'];
  send_push?: boolean;
}

// Function to send notification via the notification service
export async function sendNotification(notification: CreateNotificationRequest | NotificationTemplate): Promise<any> {
  try {
    const { data, error } = await supabase.functions.invoke('notification_service', {
      body: notification
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

// Helper functions for common notification types
export const NotificationTemplates = {
  // Send marks update notification
  marksUpdated: (studentName: string, subject: string, score: number, maxScore: number, recipients?: CreateNotificationRequest['recipients']) => 
    sendNotification({
      template: 'marks_updated',
      template_data: [studentName, subject, score, maxScore],
      recipients,
      send_push: true
    }),

  // Send attendance alert
  attendanceAlert: (studentName: string, date: string, status: 'A' | 'L', recipients?: CreateNotificationRequest['recipients']) => 
    sendNotification({
      template: 'attendance_alert',
      template_data: [studentName, date, status],
      recipients,
      send_push: true
    }),

  // Send fee reminder
  feeReminder: (studentName: string, amount: number, dueDate: string, recipients?: CreateNotificationRequest['recipients']) => 
    sendNotification({
      template: 'fee_reminder',
      template_data: [studentName, amount, dueDate],
      recipients,
      send_push: true
    }),

  // Send meeting notification
  meetingScheduled: (title: string, date: string, time: string, recipients?: CreateNotificationRequest['recipients']) => 
    sendNotification({
      template: 'meeting_scheduled',
      template_data: [title, date, time],
      recipients,
      send_push: true
    }),

  // Send announcement
  announcement: (title: string, description: string, urgent = false, recipients?: CreateNotificationRequest['recipients']) => 
    sendNotification({
      template: 'announcement',
      template_data: [title, description, urgent],
      recipients,
      send_push: true
    }),

  // Custom notification
  custom: (notification: CreateNotificationRequest) => 
    sendNotification(notification)
};

// Function to create sample notifications for demonstration
export async function createSampleNotifications() {
  try {
    console.log('Creating sample notifications...');

    // Create a variety of sample notifications
    const notifications = [
      await NotificationTemplates.marksUpdated(
        'Alex Johnson', 
        'Mathematics', 
        92, 
        100, 
        { all_parents: true }
      ),
      await NotificationTemplates.attendanceAlert(
        'Emma Davis', 
        '2024-01-15', 
        'A', 
        { all_parents: true }
      ),
      await NotificationTemplates.feeReminder(
        'Michael Chen', 
        15000, 
        '2024-01-20', 
        { all_parents: true }
      ),
      await NotificationTemplates.meetingScheduled(
        'Parent-Teacher Conference', 
        '2024-01-25', 
        '10:00 AM', 
        { all_parents: true }
      ),
      await NotificationTemplates.announcement(
        'School Holiday Notice', 
        'School will remain closed on January 26th for Republic Day celebration. Regular classes will resume on January 29th.', 
        false, 
        { all_parents: true }
      ),
      await NotificationTemplates.announcement(
        'Emergency Early Dismissal', 
        'Due to heavy rainfall, school will close early today at 1:00 PM. Please arrange for early pickup.', 
        true, 
        { all_parents: true }
      )
    ];

    console.log('Sample notifications created successfully:', notifications);
    return notifications;
  } catch (error) {
    console.error('Error creating sample notifications:', error);
    throw error;
  }
}

// Export utility function to get notification service URL
export function getNotificationServiceUrl() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/notification_service`;
} 