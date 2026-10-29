import { type NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? '')
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:8000'

// Routes that require a valid session. Everything else is publicly browsable.
const PROTECTED_PATHS = ['/orders', '/checkout', '/profile', '/notifications']

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Proxy /api/* → FastAPI backend (always, auth header injected if token present)
  if (pathname.startsWith('/api/')) {
    const backendPath = pathname.replace('/api', '')
    const url = `${API_INTERNAL_URL}${backendPath}${request.nextUrl.search}`

    const token = request.cookies.get('avdan_token')?.value
    const headers = new Headers(request.headers)
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    return NextResponse.rewrite(url, { request: { headers } })
  }

  // Public routes — no auth required (home, vendor pages, etc.)
  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  // Auth gate — only runs for protected routes
  const token = request.cookies.get('avdan_token')?.value

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  try {
    const { payload } = await jwtVerify(token, SECRET)

    const response = NextResponse.next()
    response.headers.set('x-user-id', String(payload.sub ?? ''))
    response.headers.set('x-user-role', String(payload.role ?? ''))
    return response
  } catch {
    // Token invalid or expired — attempt silent refresh
    const refreshToken = request.cookies.get('avdan_refresh_token')?.value
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${API_INTERNAL_URL}/auth/refresh`, {
          method: 'POST',
          headers: { Cookie: `avdan_refresh_token=${refreshToken}` },
        })
        if (refreshResponse.ok) {
          const setCookies = refreshResponse.headers.getSetCookie()
          const response = NextResponse.next()
          for (const cookie of setCookies) {
            response.headers.append('Set-Cookie', cookie)
          }
          return response
        }
      } catch {
        // Refresh failed — fall through to redirect
      }
    }

    const loginUrl = new URL('/login', request.url)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('avdan_token')
    response.cookies.delete('avdan_refresh_token')
    return response
  }
}

export const config = {
  matcher: ['/((?!login|register|_next|favicon).*)'],
}
