import { createServerClient, type CookieOptions } from '@supabase/ssr'
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
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
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

  // Password reset link clicked - redirect to reset-password page
  if (tokenHash && type === 'recovery' && pathname !== '/reset-password') {
    const redirectUrl = new URL('/reset-password', request.url)
    redirectUrl.search = searchParams.toString()
    return NextResponse.redirect(redirectUrl)
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
  const { data: { session } } = await supabase.auth.getSession()
  
  // If user has a recovery session and is on homepage, redirect to reset-password
  if (session && pathname === '/' && !tokenHash) {
    const { data: { user } } = await supabase.auth.getUser()
    // Check if this is a recovery session (user needs to set password)
    if (user && user.aud === 'authenticated' && user.recovery_sent_at) {
      return NextResponse.redirect(new URL('/reset-password', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
