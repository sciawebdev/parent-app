// deno-lint-ignore-file
// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { parse } from "https://deno.land/std@0.203.0/csv/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Supabase env vars not set");
}
const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
  auth: { persistSession: false }
});

/** Infer CSV type based on header columns */
function detectType(headers: string[]): "students" | "attendance" | "marks" | "unknown" {
  const headerStr = headers.map((h) => h.toLowerCase()).join("|");
  
  if (headerStr.includes("student name") || headerStr.includes("student_name") || headerStr.includes("admission")) return "students";
  if (headerStr.includes("attendance") || headerStr.includes("present") || headerStr.includes("absent") || headerStr.includes("status")) return "attendance";
  if (headerStr.includes("marks") || headerStr.includes("score") || headerStr.includes("subject") || headerStr.includes("exam")) return "marks";
  
  return "unknown";
}

async function insertStudents(records: Record<string, string>[]) {
  const mapped = records.map((r) => ({
    name: r["Student Name"] ?? r["student_name"] ?? r.name ?? r.Name,
    external_id: r["Student Id"] ?? r["student_id"] ?? r.id ?? r["Admission No"] ?? r["admission_no"] ?? r["External ID"] ?? r["external_id"] ?? undefined,
    class: r.Class ?? r["class"] ?? r.Grade ?? r.grade,
    section: r.Section ?? r["section"] ?? r.Division ?? r.division,
  })).filter(student => student.name); // Filter out empty records

  if (mapped.length === 0) {
    throw new Error("No valid student records found");
  }

  const { error, count } = await supabase
    .from("students")
    .upsert(mapped, { onConflict: 'external_id' })
    .select("id", { count: "exact" });
    
  if (error) throw error;
  return count ?? mapped.length;
}

async function insertAttendance(records: Record<string, string>[]) {
  // First, get all students to map external_id to internal id
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, external_id, name");
    
  if (studentsError) throw studentsError;
  
  const studentMap = new Map();
  students?.forEach(student => {
    if (student.external_id) {
      studentMap.set(student.external_id, student.id);
    }
    // Also map by name as fallback
    studentMap.set(student.name.toLowerCase(), student.id);
  });

  const mapped = records.map((r) => {
    const externalId = r["Student Id"] ?? r["student_id"] ?? r.id ?? r["External ID"] ?? r["external_id"];
    const studentName = r["Student Name"] ?? r["student_name"] ?? r.name ?? r.Name;
    const date = r.Date ?? r["Attendance Date"] ?? r.date ?? r["attendance_date"];
    const status = r.Status ?? r["status"] ?? r["Attendance"] ?? r.attendance;
    
    let student_id = null;
    if (externalId && studentMap.has(externalId)) {
      student_id = studentMap.get(externalId);
    } else if (studentName && studentMap.has(studentName.toLowerCase())) {
      student_id = studentMap.get(studentName.toLowerCase());
    }
    
    if (!student_id || !date) {
      return null; // Skip invalid records
    }
    
    // Normalize status: P = Present, A = Absent, L = Late
    let normalizedStatus = 'A'; // Default to Absent
    if (status) {
      const s = status.toLowerCase();
      if (s.includes('present') || s === 'p' || s === '1') normalizedStatus = 'P';
      else if (s.includes('late') || s === 'l') normalizedStatus = 'L';
    }
    
    return {
      student_id,
      date: new Date(date).toISOString().split('T')[0], // Format as YYYY-MM-DD
      status: normalizedStatus,
    };
  }).filter(Boolean); // Remove null records

  if (mapped.length === 0) {
    throw new Error("No valid attendance records found or no matching students");
  }

  const { error, count } = await supabase
    .from("attendance")
    .upsert(mapped, { onConflict: 'student_id,date' })
    .select("id", { count: "exact" });
    
  if (error) throw error;
  return count ?? mapped.length;
}

async function insertMarks(records: Record<string, string>[]) {
  // Get all students to map external_id to internal id
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, external_id, name");
    
  if (studentsError) throw studentsError;
  
  const studentMap = new Map();
  students?.forEach(student => {
    if (student.external_id) {
      studentMap.set(student.external_id, student.id);
    }
    // Also map by name as fallback
    studentMap.set(student.name.toLowerCase(), student.id);
  });

  const mapped = records.map((r) => {
    const externalId = r["Student Id"] ?? r["student_id"] ?? r.id ?? r["External ID"] ?? r["external_id"];
    const studentName = r["Student Name"] ?? r["student_name"] ?? r.name ?? r.Name;
    const subject = r.Subject ?? r["subject"] ?? r.Course ?? r.course;
    const score = r.Score ?? r["score"] ?? r.Marks ?? r.marks ?? r.Mark;
    const maxScore = r["Max Score"] ?? r["max_score"] ?? r["Total"] ?? r.total ?? r["Maximum Marks"];
    const term = r.Term ?? r["term"] ?? r.Exam ?? r.exam ?? r.Quarter ?? r.quarter ?? "Term 1";
    
    let student_id = null;
    if (externalId && studentMap.has(externalId)) {
      student_id = studentMap.get(externalId);
    } else if (studentName && studentMap.has(studentName.toLowerCase())) {
      student_id = studentMap.get(studentName.toLowerCase());
    }
    
    if (!student_id || !subject || score === undefined) {
      return null; // Skip invalid records
    }
    
    return {
      student_id,
      subject,
      score: parseFloat(score) || 0,
      max_score: parseFloat(maxScore) || 100,
      term,
    };
  }).filter(Boolean); // Remove null records

  if (mapped.length === 0) {
    throw new Error("No valid marks records found or no matching students");
  }

  const { error, count } = await supabase
    .from("marks")
    .upsert(mapped, { onConflict: 'student_id,subject,term' })
    .select("id", { count: "exact" });
    
  if (error) throw error;
  return count ?? mapped.length;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
  const csvText = await req.text();
    if (!csvText.trim()) {
      return new Response(JSON.stringify({ error: "Empty CSV data" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Parse CSV into records
    const records = await parse(csvText, { 
      header: true,
      skipEmptyLines: true 
    });
    
  if (!Array.isArray(records) || records.length === 0) {
      return new Response(JSON.stringify({ error: "No records found in CSV" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
  }

  const headers = Object.keys(records[0]);
  const type = detectType(headers);

    console.log(`Processing ${type} CSV with ${records.length} records`);
    console.log(`Headers: ${headers.join(', ')}`);

    let inserted = 0;
    let message = '';
    
    switch (type) {
      case "students":
        inserted = await insertStudents(records as Record<string, string>[]);
        message = `Successfully imported ${inserted} students`;
        break;
        
      case "attendance":
        inserted = await insertAttendance(records as Record<string, string>[]);
        message = `Successfully imported ${inserted} attendance records`;
        break;
        
      case "marks":
        inserted = await insertMarks(records as Record<string, string>[]);
        message = `Successfully imported ${inserted} marks records`;
        break;
        
      default:
        return new Response(JSON.stringify({ 
          error: `Unknown or unsupported CSV type: ${type}. Headers found: ${headers.join(', ')}` 
        }), { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      inserted, 
      type, 
      message 
    }), {
      headers: { "Content-Type": "application/json" },
    });
    
  } catch (err) {
    console.error("CSV Import Error:", err);
    return new Response(JSON.stringify({ 
      error: err.message || "Internal server error",
      details: err.toString()
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}); 