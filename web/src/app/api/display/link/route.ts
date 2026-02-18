import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createDisplayToken } from '@/lib/display/token';
import { resolveTrustedTvDurationDays } from '@/lib/display/trustedTv.server';
import { randomBytes } from 'crypto';

const JOIN_CODE_LENGTH = 6;
const EXPIRY_HOURS = 24;

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(JOIN_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) code += chars[bytes[i]! % chars.length];
  return code;
}

/**
 * GET /api/display/link
 * Returns display URL, short-lived token, and a join code so the TV can use either the link or the code.
 * Requires an authenticated session (teacher or principal).
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, preschool_id')
      .or(`id.eq.${session.user.id},auth_user_id.eq.${session.user.id}`)
      .maybeSingle();

    const orgId = profile?.organization_id || profile?.preschool_id;
    if (!orgId) {
      return NextResponse.json({ error: 'No organization linked to your account' }, { status: 400 });
    }

    const secret =
      process.env.DISPLAY_LINK_SECRET ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) {
      return NextResponse.json(
        { error: 'Display link not configured. Set DISPLAY_LINK_SECRET or SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('class') || undefined;

    const token = createDisplayToken({ org: orgId, class: classId }, secret);
    const base = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || '';
    const path = classId ? `/display?org=${orgId}&class=${classId}&token=${encodeURIComponent(token)}` : `/display?org=${orgId}&token=${encodeURIComponent(token)}`;
    const url = base ? `${base.replace(/\/$/, '')}${path}` : path;

    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);
    let joinCode: string | null = null;

    try {
      joinCode = generateJoinCode();
      const { error: insertError } = await supabase.from('display_join_codes').insert({
        code: joinCode,
        org_id: orgId,
        token,
        class_id: classId || null,
        expires_at: expiresAt.toISOString(),
      });
      if (insertError) {
        joinCode = null;
      }
    } catch {
      joinCode = null;
    }

    return NextResponse.json({
      url,
      token,
      joinCode: joinCode ?? undefined,
      expiresIn: '24h',
      trustedPairingDays: resolveTrustedTvDurationDays(),
    });
  } catch (e) {
    console.error('[display/link]', e);
    return NextResponse.json({ error: 'Failed to generate display link' }, { status: 500 });
  }
}
