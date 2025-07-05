// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Supabase env vars not set");
}

const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
  auth: { persistSession: false }
});

interface BulkLoginConfig {
  classSection?: string;
  loginPrefix: string;
  notifyParents: boolean;
  generateFor: 'new_parents' | 'all_parents' | 'specific_students';
  studentIds?: string[];
  passwordLength: number;
  customPassword?: string;
}

interface GenerationResult {
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

// Generate a random password
function generatePassword(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Generate login username
function generateLoginUsername(prefix: string, studentId: string, studentName: string): string {
  if (prefix) {
    return `${prefix}_${studentId}`;
  }
  // Default format: first name + student ID
  const firstName = studentName.split(' ')[0].toLowerCase();
  return `${firstName}_${studentId}`;
}

// Create auth user and parent record
async function createParentAccount(
  studentId: string,
  studentName: string,
  parentEmail: string,
  parentPhone: string,
  parentName: string,
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if parent already exists
    const { data: existingParent } = await supabase
      .from('parents')
      .select('id')
      .eq('email', parentEmail)
      .maybeSingle();

    if (existingParent) {
      return { success: false, error: 'Parent account already exists' };
    }

    // Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: parentEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: parentName,
        username: username,
        role: 'parent'
      }
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    if (!authUser.user) {
      return { success: false, error: 'Failed to create auth user' };
    }

    // Create parent record
    const { error: parentError } = await supabase
      .from('parents')
      .insert({
        auth_user_id: authUser.user.id,
        name: parentName,
        email: parentEmail,
        phone: parentPhone || null,
        username: username
      });

    if (parentError) {
      // Clean up auth user if parent creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return { success: false, error: parentError.message };
    }

    // Get parent ID for relationship
    const { data: parentRecord, error: parentFetchError } = await supabase
      .from('parents')
      .select('id')
      .eq('auth_user_id', authUser.user.id)
      .single();

    if (parentFetchError || !parentRecord) {
      return { success: false, error: 'Failed to fetch parent record' };
    }

    // Create parent-student relationship
    const { error: relationError } = await supabase
      .from('parent_students')
      .insert({
        parent_id: parentRecord.id,
        student_id: studentId
      });

    if (relationError) {
      console.warn('Failed to create parent-student relationship:', relationError);
      // Don't fail the whole operation for this
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating parent account:', error);
    return { success: false, error: error.message };
  }
}

// Send notification to parent
async function notifyParent(
  parentEmail: string,
  parentName: string,
  username: string,
  password: string,
  studentName: string
): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('notification_service', {
      body: {
        type: 'login_credentials',
        title: 'Your School Portal Login Credentials',
        message: `Dear ${parentName},\n\nYour login credentials for the school parent portal have been created:\n\nUsername: ${username}\nPassword: ${password}\n\nYou can now log in to view ${studentName}'s academic progress.\n\nPlease change your password after first login.\n\nBest regards,\nSchool Administration`,
        recipients: {
          emails: [parentEmail]
        },
        priority: 'high'
      }
    });

    return !error;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const config: BulkLoginConfig = await req.json();
    
    // Validate configuration
    if (!config.loginPrefix) {
      return new Response(JSON.stringify({ error: "Login prefix is required" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (config.passwordLength < 6 || config.passwordLength > 20) {
      return new Response(JSON.stringify({ error: "Password length must be between 6 and 20 characters" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log('Starting bulk login generation with config:', config);

    // Build query based on generation type
    let studentsQuery = supabase
      .from('students')
      .select('id, external_id, name, class, section, parent_email, parent_phone, parent_name');

    if (config.generateFor === 'specific_students' && config.studentIds) {
      studentsQuery = studentsQuery.in('id', config.studentIds);
    } else if (config.classSection) {
      const [classNum, section] = config.classSection.split('-');
      studentsQuery = studentsQuery.eq('class', classNum);
      if (section) {
        studentsQuery = studentsQuery.eq('section', section);
      }
    }

    const { data: students, error: studentsError } = await studentsQuery;

    if (studentsError) {
      return new Response(JSON.stringify({ error: studentsError.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!students || students.length === 0) {
      return new Response(JSON.stringify({ error: "No students found matching criteria" }), { 
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const result: GenerationResult = {
      success: true,
      total: students.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      results: [],
      errors: []
    };

    // Process each student
    for (const student of students) {
      const parentEmail = student.parent_email;
      const parentName = student.parent_name || 'Parent';
      const parentPhone = student.parent_phone;

      // Skip if no parent email
      if (!parentEmail) {
        result.skipped++;
        result.results.push({
          studentName: student.name,
          parentEmail: 'Not provided',
          parentLogin: '',
          parentPassword: '',
          status: 'skipped',
          error: 'No parent email provided'
        });
        continue;
      }

      // Generate credentials
      const username = generateLoginUsername(config.loginPrefix, student.external_id || student.id, student.name);
      const password = config.customPassword || generatePassword(config.passwordLength);

      // Create parent account
      const createResult = await createParentAccount(
        student.id,
        student.name,
        parentEmail,
        parentPhone,
        parentName,
        username,
        password
      );

      if (createResult.success) {
        result.successful++;
        result.results.push({
          studentName: student.name,
          parentEmail: parentEmail,
          parentLogin: username,
          parentPassword: password,
          status: 'success'
        });

        // Send notification if requested
        if (config.notifyParents) {
          const notificationSent = await notifyParent(
            parentEmail,
            parentName,
            username,
            password,
            student.name
          );
          
          if (!notificationSent) {
            result.errors.push(`Failed to send notification to ${parentEmail}`);
          }
        }
      } else {
        result.failed++;
        result.results.push({
          studentName: student.name,
          parentEmail: parentEmail,
          parentLogin: username,
          parentPassword: password,
          status: 'failed',
          error: createResult.error
        });
        result.errors.push(`Failed to create account for ${student.name}: ${createResult.error}`);
      }
    }

    // Log summary
    console.log(`Bulk login generation completed: ${result.successful} successful, ${result.failed} failed, ${result.skipped} skipped`);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Bulk login generation error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Internal server error",
      details: error.toString()
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}); 