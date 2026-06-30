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

class ApiClient {
  private readonly baseUrl = '/api'

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    isMultipart?: boolean,
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
      // Proxy handles refresh — if we still get 401 after refresh, redirect to login
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
