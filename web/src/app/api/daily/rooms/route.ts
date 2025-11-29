import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';

interface CreateRoomRequest {
  name: string;
  classId?: string;
  preschoolId: string;
  isPrivate?: boolean;
  expiryMinutes?: number;
  maxParticipants?: number;
  enableRecording?: boolean;
  enableScreenShare?: boolean;
  enableChat?: boolean;
}

// Tier-based time limits (in minutes) - enforced server-side
const TIER_MAX_DURATION: Record<string, number> = {
  free: 15,
  starter: 30,
  basic: 60,
  premium: 60,
  pro: 60,
  enterprise: 1440, // 24 hours (effectively unlimited)
};

// Create a new Daily.co room for class lessons
export async function POST(request: NextRequest) {
  try {
    // Check if Daily API key is configured
    if (!DAILY_API_KEY) {
      console.error('[Daily Rooms] DAILY_API_KEY is not configured. Please add your Daily.co API key to the environment variables.');
      return NextResponse.json({ 
        error: 'Video service not configured',
        message: 'Video calls are not available. Please contact your administrator to configure the video service.',
        code: 'DAILY_API_KEY_MISSING'
      }, { status: 503 });
    }

    const supabase = await createClient();
    
    // Use getUser() instead of getSession() for secure server-side auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[Daily Rooms] Auth error:', authError.message);
      return NextResponse.json({ error: 'Authentication failed', details: authError.message }, { status: 401 });
    }

    if (!user) {
      console.log('[Daily Rooms] No authenticated user found');
      return NextResponse.json({ error: 'Not authenticated. Please sign in.' }, { status: 401 });
    }

    console.log('[Daily Rooms] Authenticated user:', user.id, user.email);

    // Verify user role - allow teachers, principals, superadmins, AND parents (for P2P calls)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, preschool_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[Daily Rooms] Profile error:', profileError);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    // Allow parents to create rooms for P2P calls
    const allowedRoles = ['teacher', 'principal', 'superadmin', 'parent'];
    if (!profile || !allowedRoles.includes(profile.role)) {
      console.log('[Daily Rooms] User role not authorized:', profile?.role);
      return NextResponse.json({ error: 'Not authorized to create call rooms' }, { status: 403 });
    }

    const body: CreateRoomRequest = await request.json();
    const {
      name,
      classId,
      preschoolId,
      isPrivate = true,
      expiryMinutes: requestedMinutes = 60,
      maxParticipants = 50,
      enableRecording = false,
      enableScreenShare = true,
      enableChat = true,
    } = body;

    // Get the school's subscription tier to enforce time limits
    let subscriptionTier = 'starter';
    const { data: school } = await supabase
      .from('preschools')
      .select('subscription_tier')
      .eq('id', preschoolId)
      .single();
    
    if (school?.subscription_tier) {
      subscriptionTier = String(school.subscription_tier).toLowerCase();
    }

    // Enforce tier-based time limits (server-side validation)
    const maxAllowed = TIER_MAX_DURATION[subscriptionTier] || TIER_MAX_DURATION.starter;
    const expiryMinutes = Math.min(requestedMinutes, maxAllowed);
    
    console.log(`[Daily Rooms] Tier: ${subscriptionTier}, Requested: ${requestedMinutes}min, Allowed: ${maxAllowed}min, Using: ${expiryMinutes}min`);

    // Generate unique room name
    const roomName = `edudash-${preschoolId.slice(0, 8)}-${Date.now()}`;

    // Create room via Daily.co API
    const dailyResponse = await fetch(`${DAILY_API_URL}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name: roomName,
        privacy: isPrivate ? 'private' : 'public',
        properties: {
          max_participants: maxParticipants,
          enable_screenshare: enableScreenShare,
          enable_chat: enableChat,
          enable_knocking: isPrivate,
          enable_recording: enableRecording ? 'cloud' : undefined,
          exp: Math.floor(Date.now() / 1000) + (expiryMinutes * 60),
          eject_at_room_exp: true,
          // Customize for education
          start_video_off: false,
          start_audio_off: true, // Students join muted
          owner_only_broadcast: false,
          enable_prejoin_ui: false, // We'll use our own
          enable_network_ui: true,
          enable_pip_ui: true,
          lang: 'en',
        },
      }),
    });

    if (!dailyResponse.ok) {
      const error = await dailyResponse.json();
      console.error('Daily.co room creation failed:', error);
      return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
    }

    const room = await dailyResponse.json();

    // Store room in database - set status to 'live' since teacher is starting immediately
    const { data: lessonRoom, error: dbError } = await supabase
      .from('video_calls')
      .insert({
        title: name,
        class_id: classId || null,
        preschool_id: preschoolId,
        teacher_id: user.id,
        meeting_id: room.name,
        meeting_url: room.url,
        status: 'live', // Teacher is starting now, so it's live
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString(),
        max_participants: maxParticipants,
        recording_enabled: enableRecording,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Failed to store room in database:', dbError);
      // Still return the room URL even if DB fails
    }

    return NextResponse.json({
      success: true,
      room: {
        id: lessonRoom?.id || room.name,
        name: room.name,
        url: room.url,
        expiresAt: new Date(room.config?.exp * 1000 || Date.now() + expiryMinutes * 60 * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating Daily room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// List active rooms for a preschool
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Use getUser() instead of getSession() for secure server-side auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Daily Rooms GET] Auth error:', authError?.message);
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const preschoolId = searchParams.get('preschoolId');
    const classId = searchParams.get('classId');

    let query = supabase
      .from('video_calls')
      .select(`
        *,
        classes:class_id (name, grade_level),
        teacher:teacher_id (first_name, last_name)
      `)
      .in('status', ['scheduled', 'live'])
      .order('scheduled_start', { ascending: true });

    if (preschoolId) {
      query = query.eq('preschool_id', preschoolId);
    }

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data: rooms, error } = await query;

    if (error) {
      console.error('[Daily Rooms GET] Error fetching rooms:', error);
      return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
    }

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('[Daily Rooms GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
