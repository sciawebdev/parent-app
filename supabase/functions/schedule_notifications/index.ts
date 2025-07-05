import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FCM_URL = 'https://fcm.googleapis.com/fcm/send';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');
    if (!fcmServerKey) {
      console.warn('⚠️ FCM_SERVER_KEY is not set. Push notifications will not be sent.');
    }

    const { 
      type,
      student_id,
      parent_id,
      title,
      message,
      data = {},
    } = await req.json();

    console.log(`📋 Received notification job: type=${type}, title="${title}"`);

    let targetUserIds = [];

    if (parent_id) {
      const { data: parent, error } = await supabaseClient.from('parents').select('auth_user_id').eq('id', parent_id).single();
      if (error) throw new Error(`Parent not found: ${error.message}`);
      if (parent) targetUserIds.push(parent.auth_user_id);
    } else if (student_id) {
      const { data: relations, error } = await supabaseClient.from('parent_students').select('parents(auth_user_id)').eq('student_id', student_id);
      if (error) throw new Error(`Could not get parents for student: ${error.message}`);
      if (relations) {
        targetUserIds = relations
          .map(r => r.parents?.auth_user_id)
          .filter(id => id);
      }
    } else {
      const { data: allParents, error } = await supabaseClient.from('parents').select('auth_user_id');
      if (error) throw new Error(`Could not get all parents: ${error.message}`);
      if (allParents) targetUserIds = allParents.map(p => p.auth_user_id).filter(id => id);
    }

    console.log(`🎯 Targeting ${targetUserIds.length} user(s).`);
    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No users to target." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: tokens, error: tokenError } = await supabaseClient
      .from('device_tokens')
      .select('token')
      .in('user_id', targetUserIds)
      .eq('platform', 'android');

    if (tokenError) {
      throw new Error(`Failed to fetch device tokens: ${tokenError.message}`);
    }

    const deviceTokens = tokens.map(t => t.token);
    console.log(`📱 Found ${deviceTokens.length} device token(s).`);

    if (deviceTokens.length === 0 || !fcmServerKey) {
      const message = !fcmServerKey ? "FCM key not set, skipping send." : "No registered device tokens found for the targeted users.";
      return new Response(JSON.stringify({ success: true, message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    const fcmPayload = {
      registration_ids: deviceTokens,
      notification: {
        title: title,
        body: message,
        sound: 'default',
      },
      data: {
        ...data,
        type: type,
        title: title,
        message: message,
      },
      android: {
        notification: {
          icon: 'ic_stat_notification',
          color: '#0000FF',
        }
      }
    };
    
    const fcmResponse = await fetch(FCM_URL, {
        method: 'POST',
        headers: {
            'Authorization': `key=${fcmServerKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(fcmPayload)
    });

    if (!fcmResponse.ok) {
        const errorBody = await fcmResponse.text();
        console.error('FCM Error Response:', errorBody);
        throw new Error(`FCM request failed with status ${fcmResponse.status}.`);
    }

    const fcmResult = await fcmResponse.json();
    console.log('✅ FCM Send Result:', fcmResult);

    const notificationRecords = targetUserIds.map(userId => ({
      user_id: userId,
      title,
      message,
      type,
      data,
    }));
    
    const { error: dbError } = await supabaseClient.from('notifications').insert(notificationRecords);
    if (dbError) {
      console.error('Could not save notifications to DB:', dbError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Push notification sent to ${fcmResult.success} of ${fcmResult.results.length} devices.`,
        push_result: fcmResult,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unhandled Error in schedule_notifications:', error);
    return new Response(JSON.stringify({ success: false, error: error.message, stack: error.stack }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }
}); 