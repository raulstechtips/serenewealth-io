const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface LoginCredentials {
  email: string
  password: string
}

export interface TokenResponse {
  access: string
  refresh: string
}

export interface User {
  id: string
  email: string
  first_name?: string
  last_name?: string
}

export interface AuthResponse {
  user: User
  tokens: TokenResponse
}

class AuthAPIError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'AuthAPIError'
  }
}

export async function loginUser(credentials: LoginCredentials): Promise<TokenResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: credentials.email,
        password: credentials.password,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new AuthAPIError(
        response.status,
        errorData.detail || errorData.non_field_errors?.[0] || 'Login failed'
      )
    }

    return await response.json()
  } catch (error) {
    if (error instanceof AuthAPIError) {
      throw error
    }
    throw new AuthAPIError(0, 'Network error occurred')
  }
}

export async function refreshToken(refreshToken: string): Promise<TokenResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    })

    if (!response.ok) {
      throw new AuthAPIError(response.status, 'Token refresh failed')
    }

    const data = await response.json()
    return {
      access: data.access,
      refresh: refreshToken, // Keep the same refresh token
    }
  } catch (error) {
    if (error instanceof AuthAPIError) {
      throw error
    }
    throw new AuthAPIError(0, 'Network error occurred')
  }
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/token/verify/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    })

    return response.ok
  } catch {
    return false
  }
}

export async function getCurrentUser(token: string): Promise<User> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/user/me/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new AuthAPIError(response.status, 'Failed to fetch user data')
    }

    return await response.json()
  } catch (error) {
    if (error instanceof AuthAPIError) {
      throw error
    }
    throw new AuthAPIError(0, 'Network error occurred')
  }
}

// Helper function to create authenticated requests
export function createAuthenticatedFetch(getToken: () => string | null) {
  return async (url: string, options: RequestInit = {}) => {
    const token = getToken()
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    return fetch(url, {
      ...options,
      headers,
    })
  }
}
