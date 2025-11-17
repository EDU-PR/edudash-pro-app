import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('[PayFast Proxy] Received ITN, forwarding to edge function...');

  try {
    const body = await request.text();
    console.log('[PayFast Proxy] Body length:', body.length);
    
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/payfast-webhook`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-forwarded-for': request.headers.get('x-forwarded-for') || '',
        'x-real-ip': request.headers.get('x-real-ip') || '',
      },
      body: body,
    });

    const responseText = await response.text();
    console.log('[PayFast Proxy] Edge function response:', response.status);

    return new NextResponse(responseText, {
      status: response.status,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('[PayFast Proxy] Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse('ok', {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
