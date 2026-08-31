import type { ApiError } from '@avdan/types'

import { secureStorage } from './secure-storage'

/**
 * Shared mobile HTTP client.
 *
 * Unlike the per-app copies this replaces, it takes its base URL and its unauthenticated-redirect
 * behaviour by injection rather than importing `expo-constants` and `expo-router` directly. A
 * package that reaches for the router at module scope forces every consumer onto one navigation
 * library and one route name; the callback keeps that decision in the app.
 *
 * Call `configureApiClient` once, from the root layout, BEFORE any query runs.
 */

interface ApiClientConfig {
  /** Base URL of the API, e.g. `http://172.20.10.3:8000`. No trailing slash. */
  baseUrl: string
  /**
   * Invoked when a request is rejected 401 and the refresh token could not rescue it.
   * Tokens have already been cleared by the time this fires — send the user to sign-in.
   */
  onUnauthorized?: () => void
}

let config: ApiClientConfig = { baseUrl: 'http://localhost:8000' }

export function configureApiClient(next: ApiClientConfig): void {
  config = { ...next, baseUrl: next.baseUrl.replace(/\/$/, '') }
}

export function getApiUrl(): string {
  return config.baseUrl
}

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

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = await secureStorage.getTokens()
  if (!refreshToken) return null

  const response = await fetch(`${config.baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'mobile' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!response.ok) return null

  const data = (await response.json()) as { access_token?: string; refresh_token?: string }
  if (!data.access_token || !data.refresh_token) return null

  await secureStorage.setTokens(data.access_token, data.refresh_token)
  return data.access_token
}

/** Collapses concurrent 401s into a single refresh attempt. */
async function handleUnauthorized(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

class ApiClient {
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    isMultipart?: boolean,
    isRetry?: boolean,
  ): Promise<T> {
    const { accessToken } = await secureStorage.getTokens()

    const headers: HeadersInit = {
      'X-Client-Platform': 'mobile',
    }
    if (!isMultipart) headers['Content-Type'] = 'application/json'
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

    const response = await fetch(`${config.baseUrl}${endpoint}`, {
      method,
      headers,
      body: isMultipart
        ? (body as FormData)
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
    })

    const isAuthEndpoint = endpoint === '/auth/login' || endpoint === '/auth/refresh'

    if (response.status === 401 && !isAuthEndpoint) {
      if (!isRetry) {
        const newToken = await handleUnauthorized()
        if (newToken) {
          return this.request<T>(method, endpoint, body, isMultipart, true)
        }
      }
      await secureStorage.clear()
      config.onUnauthorized?.()
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

  async postMultipart<T>(endpoint: string, body: FormData): Promise<T> {
    return this.request<T>('POST', endpoint, body, true)
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
