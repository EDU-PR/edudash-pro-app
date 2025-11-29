import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';

interface TokenRequest {
  roomName: string;
  userName: string;
  isOwner?: boolean;
}

// Generate a meeting token for a participant
export async function POST(request: NextRequest) {
  try {
    if (!DAILY_API_KEY) {
      console.error('[Daily Token] DAILY_API_KEY is not configured');
      return NextResponse.json({ error: 'Video service not configured' }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, role, preschool_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body: TokenRequest = await request.json();
    const { roomName, userName, isOwner } = body;

    // Determine if user should be owner (teachers are owners of their rooms)
    const shouldBeOwner = isOwner || ['teacher', 'principal', 'superadmin'].includes(profile.role);

    // Create meeting token via Daily.co API
    const dailyResponse = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: userName || `${profile.first_name} ${profile.last_name}`.trim() || 'Participant',
          user_id: user.id,
          is_owner: shouldBeOwner,
          enable_screenshare: true,
          enable_recording: shouldBeOwner ? 'cloud' : undefined,
          start_video_off: false,
          start_audio_off: !shouldBeOwner, // Non-owners (students/parents) join muted
          exp: Math.floor(Date.now() / 1000) + 3600 * 3, // 3 hour token
        },
      }),
    });

    if (!dailyResponse.ok) {
      const error = await dailyResponse.json();
      console.error('Daily.co token creation failed:', error);
      return NextResponse.json({ error: 'Failed to create meeting token' }, { status: 500 });
    }

    const { token } = await dailyResponse.json();

    return NextResponse.json({
      success: true,
      token,
      isOwner: shouldBeOwner,
      userName: userName || `${profile.first_name} ${profile.last_name}`.trim(),
    });
  } catch (error) {
    console.error('Error creating Daily token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
