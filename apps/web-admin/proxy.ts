import { type NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? '')
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:8000'

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Proxy /api/* → FastAPI backend
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

  // Auth gate — validate JWT from cookie
  const token = request.cookies.get('avdan_token')?.value

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  try {
    const { payload } = await jwtVerify(token, SECRET)
    const role = String(payload.role ?? '')

    if (role !== 'admin' && role !== 'support') {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'unauthorized')
      const response = NextResponse.redirect(loginUrl)
      response.cookies.delete('avdan_token')
      response.cookies.delete('avdan_refresh_token')
      return response
    }

    // Attach claims to headers for server components
    const response = NextResponse.next()
    response.headers.set('x-user-id', String(payload.sub ?? ''))
    response.headers.set('x-user-role', role)
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
          let newAccessToken = ''
          for (const cookie of setCookies) {
            if (cookie.includes('avdan_token=')) {
              const match = cookie.match(/avdan_token=([^;]+)/)
              if (match) newAccessToken = match[1]
            }
          }

          if (newAccessToken) {
            const { payload: newPayload } = await jwtVerify(newAccessToken, SECRET)
            const role = String(newPayload.role ?? '')
            if (role !== 'admin' && role !== 'support') {
              const loginUrl = new URL('/login', request.url)
              loginUrl.searchParams.set('error', 'unauthorized')
              const response = NextResponse.redirect(loginUrl)
              response.cookies.delete('avdan_token')
              response.cookies.delete('avdan_refresh_token')
              return response
            }

            const response = NextResponse.next()
            for (const cookie of setCookies) {
              response.headers.append('Set-Cookie', cookie)
            }
            response.headers.set('x-user-id', String(newPayload.sub ?? ''))
            response.headers.set('x-user-role', role)
            return response
          }
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
