import React, { useState, useEffect } from 'react';
import { supabase } from '../App';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'P' | 'A' | 'L';
  student: {
    id: string;
    name: string;
    class: string;
    section: string;
  };
}

export function AttendanceHistory() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [selectedStudent]);

  async function fetchData() {
    try {
      setLoading(true);
      
      // Get last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const fromDate = thirtyDaysAgo.toISOString().split('T')[0];

      // Get students first
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .limit(20);

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      // Build query for attendance
      let query = supabase
        .from('attendance')
        .select(`
          *,
          students!inner(id, name, class, section)
        `)
        .gte('date', fromDate)
        .order('date', { ascending: false });

      // Filter by student if selected
      if (selectedStudent !== 'all') {
        query = query.eq('student_id', selectedStudent);
      }

      const { data: attendanceData, error: attendanceError } = await query;

      if (attendanceError) throw attendanceError;
      setAttendance(attendanceData || []);

    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  }

  const getAttendanceStats = () => {
    const total = attendance.length;
    const present = attendance.filter(a => a.status === 'P').length;
    const absent = attendance.filter(a => a.status === 'A').length;
    const late = attendance.filter(a => a.status === 'L').length;
    
    const presentPercentage = total > 0 ? Math.round((present / total) * 100) : 0;
    
    return { total, present, absent, late, presentPercentage };
  };

  const groupedAttendance = attendance.reduce((groups, record) => {
    const date = record.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(record);
    return groups;
  }, {} as Record<string, AttendanceRecord[]>);

  const stats = getAttendanceStats();

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Filters</h3>
        <select
          value={selectedStudent}
          onChange={(e) => setSelectedStudent(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Students</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name} - Class {student.class}
            </option>
          ))}
        </select>
      </div>

      {/* Statistics */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Last 30 Days Summary
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Days</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.present}</div>
            <div className="text-sm text-gray-600">Present</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
            <div className="text-sm text-gray-600">Absent</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
            <div className="text-sm text-gray-600">Late</div>
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="bg-green-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${stats.presentPercentage}%` }}
          ></div>
        </div>
        <div className="text-center text-sm text-gray-600">
          {stats.presentPercentage}% Attendance Rate
        </div>
      </div>

      {/* Attendance Records */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Attendance History
          </h3>
        </div>
        
        {Object.keys(groupedAttendance).length > 0 ? (
          <div className="divide-y divide-gray-200">
            {Object.entries(groupedAttendance).map(([date, records]) => (
              <div key={date} className="p-4">
                <div className="text-sm font-medium text-gray-900 mb-2">
                  {new Date(date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
                <div className="space-y-2">
                  {records.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <div className="flex items-center">
                        <div className="font-medium text-gray-900">
                          {record.student.name}
                        </div>
                        <div className="ml-2 text-sm text-gray-600">
                          Class {record.student.class} - {record.student.section}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          record.status === 'P'
                            ? 'bg-green-100 text-green-800'
                            : record.status === 'L'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {record.status === 'P' ? 'Present' : 
                         record.status === 'L' ? 'Late' : 'Absent'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-gray-500">No attendance records found</p>
          </div>
        )}
      </div>
    </div>
  );
} 