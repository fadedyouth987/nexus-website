'use client'

/**
 * Active org for studio: list from `/api/organizations`, preference `localStorage` `nexus_active_org_id`.
 * @see docs/application-flow.md
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useSession } from 'next-auth/react'
import apiFetch from '@/lib/core/api'

export type Organization = {
  id: string
  name: string
  slug: string
  plan_id: string | null
  subscription_status: string | null
  usage_this_month: { generations?: number; storage_gb?: number } | null
  token_balance: number | null
}

type OrganizationContextType = {
  organization: Organization | null
  organizations: Organization[]
  loading: boolean
  error: string | null
  switchOrganization: (orgId: string) => void
  refreshOrganizations: () => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextType | null>(null)

const STORAGE_KEY = 'nexus_active_org_id'

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { status } = useSession()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshOrganizations = useCallback(async () => {
    if (status !== 'authenticated') {
      setOrganizations([])
      setOrganization(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/organizations')
      if (res.status === 401) {
        setOrganizations([])
        setOrganization(null)
        return
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || 'Failed to load organizations')
      }
      const payload = (await res.json()) as { organizations: Organization[] }
      const list = payload.organizations ?? []
      setOrganizations(list)

      const stored =
        typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
      const next =
        list.find((o) => o.id === stored) ?? list[0] ?? null
      setOrganization(next)
      if (next && typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, next.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load organizations')
      setOrganizations([])
      setOrganization(null)
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void refreshOrganizations()
  }, [refreshOrganizations])

  const switchOrganization = useCallback(
    (orgId: string) => {
      const org = organizations.find((o) => o.id === orgId)
      if (org) {
        setOrganization(org)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, org.id)
        }
      }
    },
    [organizations]
  )

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        organizations,
        loading,
        error,
        switchOrganization,
        refreshOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext)
  if (!ctx) {
    throw new Error('useOrganization must be used within OrganizationProvider')
  }
  return ctx
}
