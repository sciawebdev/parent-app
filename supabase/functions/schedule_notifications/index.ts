import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { decode as base64Decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getAccessToken = async () => {
  const clientEmail = Deno.env.get('GOOGLE_CLIENT_EMAIL');
  const privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY');
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID');

  if (!clientEmail || !privateKey || !projectId) {
    throw new Error('Service account env vars missing (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, FIREBASE_PROJECT_ID)');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();
  // Helper base64url encoder (UTF-8 -> base64url)
  const base64UrlEncode = (str: string) => {
    const b64 = btoa(str);
    return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${headerB64}.${payloadB64}`;

  // Import PEM key
  let pem = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '');

  // Convert literal "\n" sequences to real newlines, then strip ALL whitespace
  pem = pem.replace(/\\n/g, '\n');  // literal \n -> newline
  pem = pem.replace(/\s+/g, '');      // remove spaces & newlines entirely

  const der = base64Decode(pem);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(signatureInput));
  const sigUint8 = new Uint8Array(signatureBuf);
  let binary = '';
  for (let i = 0; i < sigUint8.byteLength; i++) {
    binary += String.fromCharCode(sigUint8[i]);
  }
  const signatureB64 = base64UrlEncode(binary);

  const jwt = `${signatureInput}.${signatureB64}`;

  let tokenRes;
  try {
    tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });
  } catch(fetchErr) {
    console.error('❌ Failed to fetch OAuth token:', fetchErr);
    throw fetchErr;
  }
  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('❌ OAuth token endpoint returned non-200:', errText);
    throw new Error(`Failed to obtain access token: ${errText}`);
  }
  const { access_token } = await tokenRes.json();
  return { token: access_token, projectId };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Server configuration error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    }
    
    const restApiHeaders = {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    };

    const { type, student_id, parent_id, title, message, data = {} } = await req.json();

    let targetUserIds = [];

    if (parent_id) {
      const parentRes = await fetch(`${supabaseUrl}/rest/v1/parents?select=auth_user_id&id=eq.${parent_id}`, { headers: restApiHeaders });
      if (!parentRes.ok) throw new Error(`Failed to fetch parent: ${await parentRes.text()}`);
      const parentData = await parentRes.json();
      if (parentData.length > 0) targetUserIds.push(parentData[0].auth_user_id);
    } else if (student_id) {
      const relationsRes = await fetch(`${supabaseUrl}/rest/v1/parent_students?select=parents(auth_user_id)&student_id=eq.${student_id}`, { headers: restApiHeaders });
      if (!relationsRes.ok) throw new Error(`Failed to fetch parent-student relations: ${await relationsRes.text()}`);
      const relationsData = await relationsRes.json();
      targetUserIds = relationsData.map(r => r.parents?.auth_user_id).filter(id => id);
    } else {
      const allParentsRes = await fetch(`${supabaseUrl}/rest/v1/parents?select=auth_user_id`, { headers: restApiHeaders });
      if (!allParentsRes.ok) throw new Error(`Failed to fetch all parents: ${await allParentsRes.text()}`);
      const allParentsData = await allParentsRes.json();
      targetUserIds = allParentsData.map(p => p.auth_user_id).filter(id => id);
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No users to target." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const encodedIds = targetUserIds.map(id => `%22${id}%22`).join(',');
    const tokensRes = await fetch(`${supabaseUrl}/rest/v1/device_tokens?select=token&user_id=in.(${encodedIds})`, { headers: restApiHeaders });
    if (!tokensRes.ok) throw new Error(`Failed to fetch device tokens: ${await tokensRes.text()}`);
    const tokensData = await tokensRes.json();
    const deviceTokens = tokensData.map(t => t.token);

    if (deviceTokens.length === 0) {
      const reason = "No registered device tokens";
      return new Response(JSON.stringify({ success: true, message: `Skipping send: ${reason}.` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }
    
    let authHeader: Record<string,string>;
    let fcmSendUrl: string;
    try {
      const { token, projectId } = await getAccessToken();
      authHeader = { 'Authorization': `Bearer ${token}` };
      fcmSendUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    } catch(tokenErr) {
      // Fallback to legacy server key if available
      const legacyKey = Deno.env.get('FCM_SERVER_KEY');
      if (!legacyKey) throw tokenErr;
      console.warn('⚠️ Falling back to legacy FCM server key. Reason:', tokenErr.message);
      authHeader = { 'Authorization': `key=${legacyKey}` };
      fcmSendUrl = 'https://fcm.googleapis.com/fcm/send';
    }

    // We now send data-only payloads; notification will be built client-side in app.
    const fcmResults = [];
    for (const deviceToken of deviceTokens) {
      const isBearer = authHeader['Authorization']?.startsWith('Bearer');
      // Build data-only payload so Android client handles displaying notification with large icon.
      const body = isBearer ?
        { message: { token: deviceToken, data: { ...data, type, title, message }, android: { priority: 'HIGH' } } } :
        { to: deviceToken, data: { ...data, type, title, message }, priority: 'high' } ;

      const fcmResponse = await fetch(fcmSendUrl, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!fcmResponse.ok) {
        const errorText = await fcmResponse.text();
        console.error(`FCM send failed for token ${deviceToken}:`, errorText);
        fcmResults.push({ token: deviceToken, error: errorText, status: fcmResponse.status });
        continue;
      }
      const json = await fcmResponse.json();
      fcmResults.push({ token: deviceToken, response: json });
    }

    const notificationRecords = targetUserIds.map(userId => ({
      user_id: userId,
      title,
      description: message,
      type,
      data,
      priority: 'medium',
      sender: 'Admin',
      read_status: false,
    }));
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
      method: 'POST',
      headers: restApiHeaders,
      body: JSON.stringify(notificationRecords),
    });
    
    if (!insertRes.ok) {
      console.error('Could not save notifications to DB:', await insertRes.text());
    }

    console.log('📡 FCM results:', JSON.stringify(fcmResults));

    return new Response(JSON.stringify({ success: true, push_result: fcmResults }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('❌ Unhandled Error in schedule_notifications:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }
}); 