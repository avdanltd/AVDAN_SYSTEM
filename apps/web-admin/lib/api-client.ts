import type { ApiError } from '@avdan/types'

class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

// The access-token cookie is short-lived (15 min); the refresh token lasts 7 days. A single
// shared promise collapses concurrent 401s (e.g. several queries firing at once) into one
// refresh call instead of racing several.
let refreshPromise: Promise<boolean> | null = null

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

class ApiClient {
  private readonly baseUrl = '/api'

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    isMultipart?: boolean,
    isRetry?: boolean,
  ): Promise<T> {
    const headers: HeadersInit = {}
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      credentials: 'include',
      body: isMultipart
        ? (body as FormData)
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
    })

    if (response.status === 401) {
      // Try the refresh token once before giving up — this is what actually keeps a session
      // alive past the 15-minute access token. /auth/refresh itself never retries onto itself.
      if (!isRetry && endpoint !== '/auth/refresh' && (await refreshSession())) {
        return this.request<T>(method, endpoint, body, isMultipart, true)
      }
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      throw new ApiClientError(401, 'UNAUTHORIZED', 'Session expired')
    }

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as Partial<ApiError>
      const error = data.error
      throw new ApiClientError(
        response.status,
        error?.code ?? 'UNKNOWN_ERROR',
        error?.message ?? 'An unexpected error occurred',
      )
    }

    if (response.status === 204) {
      return undefined as T
    }

    return response.json() as Promise<T>
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint
    return this.request<T>('GET', url)
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', endpoint, body)
  }

  async postMultipart<T>(endpoint: string, data: FormData): Promise<T> {
    return this.request<T>('POST', endpoint, data, true)
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', endpoint, body)
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', endpoint, body)
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>('DELETE', endpoint)
  }
}

export const apiClient = new ApiClient()
export { ApiClientError }
