import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storageKey: 'edudash-auth-session', // Match client storage key
        flowType: 'pkce',
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({
              name,
              value,
              ...options,
            })
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          })
        },
      },
    }
  )

  // Handle password reset flow
  const { searchParams, pathname } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const accessToken = searchParams.get('access_token')
  const refreshToken = searchParams.get('refresh_token')

  // Console log for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Middleware Debug]', {
      pathname,
      tokenHash: !!tokenHash,
      type,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
    })
  }

  // Password reset link clicked - redirect to reset-password page
  // This handles both token_hash and access_token flows
  if (pathname !== '/reset-password') {
    // Case 1: Token hash flow (email link with token_hash)
    if (tokenHash && type === 'recovery') {
      const redirectUrl = new URL('/reset-password', request.url)
      redirectUrl.search = searchParams.toString()
      return NextResponse.redirect(redirectUrl)
    }
    
    // Case 2: Access token flow (after Supabase processes the token)
    if (accessToken && refreshToken && type === 'recovery') {
      const redirectUrl = new URL('/reset-password', request.url)
      redirectUrl.search = searchParams.toString()
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Handle auth errors
  if (error && pathname === '/') {
    const redirectUrl = new URL('/sign-in', request.url)
    redirectUrl.searchParams.set('error', error)
    if (errorDescription) {
      redirectUrl.searchParams.set('error_description', errorDescription)
    }
    return NextResponse.redirect(redirectUrl)
  }

  // Refresh session if it exists
  await supabase.auth.getSession()

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest files (PWA manifest)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest|json)$).*)',
  ],
}
