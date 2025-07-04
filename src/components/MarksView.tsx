import React, { useState, useEffect } from 'react';
import { supabase } from '../App';

interface MarksRecord {
  id: string;
  subject: string;
  score: number;
  max_score: number;
  term: string;
  student: {
    id: string;
    name: string;
    class: string;
    section: string;
  };
}

export function MarksView() {
  const [marks, setMarks] = useState<MarksRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [selectedTerm, setSelectedTerm] = useState<string>('all');
  const [students, setStudents] = useState<any[]>([]);
  const [terms, setTerms] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, [selectedStudent, selectedTerm]);

  async function fetchData() {
    try {
      setLoading(true);
      
      // Get students first
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .limit(20);

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      // Build query for marks
      let query = supabase
        .from('marks')
        .select(`
          *,
          students!inner(id, name, class, section)
        `)
        .order('term', { ascending: true })
        .order('subject', { ascending: true });

      // Filter by student if selected
      if (selectedStudent !== 'all') {
        query = query.eq('student_id', selectedStudent);
      }

      // Filter by term if selected
      if (selectedTerm !== 'all') {
        query = query.eq('term', selectedTerm);
      }

      const { data: marksData, error: marksError } = await query;

      if (marksError) throw marksError;
      setMarks(marksData || []);

      // Extract unique terms
      const uniqueTerms = [...new Set(marksData?.map(m => m.term) || [])];
      setTerms(uniqueTerms);

    } catch (error) {
      console.error('Error fetching marks:', error);
    } finally {
      setLoading(false);
    }
  }

  const getOverallStats = () => {
    if (marks.length === 0) return { average: 0, percentage: 0, totalSubjects: 0 };
    
    const totalScore = marks.reduce((sum, mark) => sum + mark.score, 0);
    const totalMaxScore = marks.reduce((sum, mark) => sum + mark.max_score, 0);
    
    const average = totalScore / marks.length;
    const percentage = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
    
    return {
      average: Math.round(average * 100) / 100,
      percentage,
      totalSubjects: new Set(marks.map(m => m.subject)).size
    };
  };

  const groupedMarks = marks.reduce((groups, mark) => {
    const key = `${mark.term}-${mark.student?.name || 'Unknown'}`;
    if (!groups[key]) {
      groups[key] = {
        term: mark.term,
        student: mark.student,
        subjects: []
      };
    }
    groups[key].subjects.push(mark);
    return groups;
  }, {} as Record<string, { term: string; student: any; subjects: MarksRecord[] }>);

  const stats = getOverallStats();

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Students</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name} - Class {student.class}
              </option>
            ))}
          </select>
          
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Terms</option>
            {terms.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Performance Summary
        </h3>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalSubjects}</div>
            <div className="text-sm text-gray-600">Subjects</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.average}</div>
            <div className="text-sm text-gray-600">Avg Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.percentage}%</div>
            <div className="text-sm text-gray-600">Overall</div>
          </div>
        </div>

        {stats.percentage > 0 && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  stats.percentage >= 80 ? 'bg-green-600' :
                  stats.percentage >= 60 ? 'bg-yellow-600' : 'bg-red-600'
                }`}
                style={{ width: `${stats.percentage}%` }}
              ></div>
            </div>
            <div className="text-center text-sm text-gray-600">
              {stats.percentage >= 80 ? 'Excellent' :
               stats.percentage >= 60 ? 'Good' : 'Needs Improvement'}
            </div>
          </div>
        )}
      </div>

      {/* Marks Records */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Marks & Grades
          </h3>
        </div>
        
        {Object.keys(groupedMarks).length > 0 ? (
          <div className="divide-y divide-gray-200">
            {Object.entries(groupedMarks).map(([key, group]) => {
              const termAverage = group.subjects.reduce((sum, mark) => {
                return sum + (mark.score / mark.max_score) * 100;
              }, 0) / group.subjects.length;

              return (
                <div key={key} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium text-gray-900">
                        {group.student?.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {group.term} - Class {group.student?.class}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-blue-600">
                        {Math.round(termAverage)}%
                      </div>
                      <div className="text-xs text-gray-500">Term Average</div>
                    </div>
                  </div>
                  
                  <div className="grid gap-3">
                    {group.subjects.map((mark) => {
                      const percentage = Math.round((mark.score / mark.max_score) * 100);
                      return (
                        <div
                          key={mark.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {mark.subject}
                            </div>
                            <div className="text-sm text-gray-600">
                              {mark.score} / {mark.max_score}
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-right">
                              <div className="font-semibold text-gray-900">
                                {percentage}%
                              </div>
                              <div
                                className={`text-xs px-2 py-1 rounded-full ${
                                  percentage >= 80
                                    ? 'bg-green-100 text-green-800'
                                    : percentage >= 60
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {percentage >= 80 ? 'A' :
                                 percentage >= 60 ? 'B' :
                                 percentage >= 40 ? 'C' : 'F'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-gray-500">No marks records found</p>
          </div>
        )}
      </div>
    </div>
  );
} 