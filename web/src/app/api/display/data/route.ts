import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyDisplayToken } from '@/lib/display/token';
import { fetchDisplayDataServer } from '../fetchDisplayDataServer';

/**
 * GET /api/display/data?org=...&token=...&class=...
 *    or ?code=JOINCODE (short code from Get TV link; resolves to org+token server-side).
 * Returns display data for the room. No session required - used by the TV.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codeParam = searchParams.get('code');
    let org: string | null = searchParams.get('org');
    let token: string | null = searchParams.get('token');
    let classId: string | null = searchParams.get('class') || null;

    const secret =
      process.env.DISPLAY_LINK_SECRET ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) {
      return NextResponse.json({ error: 'Display not configured' }, { status: 503 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (codeParam && codeParam.trim().length > 0) {
      const code = codeParam.trim().toUpperCase();
      const { data: row, error } = await supabase
        .from('display_join_codes')
        .select('org_id, token, class_id, expires_at')
        .eq('code', code)
        .maybeSingle();

      if (error || !row || new Date(row.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Invalid or expired join code' }, { status: 403 });
      }
      org = row.org_id;
      token = row.token;
      if (row.class_id) classId = row.class_id;
    }

    if (!org || !token) {
      return NextResponse.json(
        { error: 'Missing org and token, or a valid join code. Use the display link or code from your dashboard.' },
        { status: 400 }
      );
    }

    const payload = verifyDisplayToken(token, secret);
    if (!payload || payload.org !== org) {
      return NextResponse.json({ error: 'Invalid or expired display link' }, { status: 403 });
    }

    const classIdToUse = classId || payload.class || null;
    const data = await fetchDisplayDataServer(supabase, org, classIdToUse);

    return NextResponse.json(data);
  } catch (e) {
    console.error('[display/data]', e);
    return NextResponse.json({ error: 'Failed to load display data' }, { status: 500 });
  }
}
