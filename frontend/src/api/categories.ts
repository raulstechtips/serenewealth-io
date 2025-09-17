import type { Category, CategoryGroup } from '@/lib/types'
import type { AuthenticatedFetch } from "@/api/client"
import { APIError } from "@/api/client"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function getCategoryGroups(
  authenticatedFetch: AuthenticatedFetch
): Promise<CategoryGroup[]> {
  /**
   * Get all category groups
   * GET /api/v1/ledger/category-groups/
   */
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/category-groups/`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to fetch category groups'
      )
    }
    
    const data = await response.json()
    
    return data.map((group: any) => ({
      id: group.id,
      name: group.name,
      type: group.type,
      type_display: group.type_display,
      categories_count: group.categories_count,
    }))
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function getCategoriesList(
  authenticatedFetch: AuthenticatedFetch
): Promise<Category[]> {
  /**
   * Get all categories with basic info
   * GET /api/v1/ledger/categories/
   */
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/categories/`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to fetch categories'
      )
    }
    
    const data = await response.json()
    
    // Transform backend data to frontend format
    return data.map((category: any) => ({
      id: category.id,
      name: category.name,
      group: category.group,
      group_id: category.group_id,
      group_name: category.group_name,
      type: category.type,
      type_display: category.type_display,
      
      // Enhanced fields from backend (if present)
      entries_count: category.entries_count,
      spending_summary: category.spending_summary,
      recent_activity: category.recent_activity,
      category_insights: category.category_insights,
    }))
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function getCategoryDetail(
  authenticatedFetch: AuthenticatedFetch,
  id: string
): Promise<Category> {
  /**
   * Get detailed category information
   * GET /api/v1/ledger/categories/{id}/
   */
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/categories/${id}/`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to fetch category'
      )
    }
    
    const data = await response.json()
    
    return {
      id: data.id,
      name: data.name,
      group: data.group,
      group_id: data.group_id,
      group_name: data.group_name,
      type: data.type,
      type_display: data.type_display,
      entries_count: data.entries_count,
      spending_summary: data.spending_summary,
      recent_activity: data.recent_activity,
      category_insights: data.category_insights,
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function getCategoriesGroupedByType(
  authenticatedFetch: AuthenticatedFetch
): Promise<Record<string, Category[]>> {
  /**
   * Get categories grouped by type
   * GET /api/v1/ledger/categories/by_type/
   */
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/categories/by_type/`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to fetch categories by type'
      )
    }
    
    const data = await response.json()
    
    // Transform each category group
    const result: Record<string, Category[]> = {}
    for (const [type, categories] of Object.entries(data)) {
      result[type] = (categories as any[]).map(category => ({
        id: category.id,
        name: category.name,
        group_name: category.group_name,
        type: type as 'INCOME' | 'EXPENSE' | 'TRANSFER',
        type_display: type,
      }))
    }
    
    return result
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function getCategoryUsageStats(
  authenticatedFetch: AuthenticatedFetch,
  id: string
): Promise<{
  category_id: string
  category_name: string
  category_type: string
  entry_stats: {
    count: number
    total_amount: string
  }
  recent_usage: Array<{
    type: 'entry'
    date: string
    description: string
    amount: string
    account: string
    entry_id: string
  }>
}> {
  /**
   * Get usage statistics for a category
   * GET /api/v1/ledger/categories/{id}/usage_stats/
   */
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/categories/${id}/usage_stats/`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to fetch category usage stats'
      )
    }
    
    return await response.json()
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function createCategory(
  authenticatedFetch: AuthenticatedFetch,
  category: {
    name: string
    group_id: string
  }
): Promise<Category> {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/categories/`, {
      method: 'POST',
      body: JSON.stringify(category)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to create category'
      )
    }
    
    const data = await response.json()
    
    return {
      id: data.id,
      name: data.name,
      group: data.group,
      group_id: data.group_id,
      group_name: data.group_name,
      type: data.type,
      type_display: data.type_display,
      entries_count: data.entries_count || 0,
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function updateCategory(
  authenticatedFetch: AuthenticatedFetch,
  id: string,
  updates: Partial<{
    name: string
    group_id: string
  }>
): Promise<Category> {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/categories/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || 'Failed to update category'
      )
    }
    
    const data = await response.json()
    
    return {
      id: data.id,
      name: data.name,
      group: data.group,
      group_id: data.group_id,
      group_name: data.group_name,
      type: data.type,
      type_display: data.type_display,
      entries_count: data.entries_count,
      spending_summary: data.spending_summary,
      recent_activity: data.recent_activity,
      category_insights: data.category_insights,
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}

export async function deleteCategory(
  authenticatedFetch: AuthenticatedFetch,
  id: string
): Promise<void> {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/v1/ledger/categories/${id}/`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(
        response.status,
        errorData.detail || errorData.error || 'Failed to delete category'
      )
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError(0, 'Network error occurred')
  }
}
