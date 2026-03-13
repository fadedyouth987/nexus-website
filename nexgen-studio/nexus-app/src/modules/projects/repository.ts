import type { AppSession } from '@/server/auth/session'
import { getSupabaseAdmin } from '@/server/supabase/admin'
import { isMissingRelationError } from '@/server/supabase/errors'
import type { CreateProjectInput, ProjectRecord, UpdateProjectInput } from './types'

const TABLE = 'projects'

export async function listProjects(session: AppSession): Promise<ProjectRecord[]> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('org_id', session.orgId)
    .order('created_at', { ascending: false })

  if (isMissingRelationError(error)) {
    return []
  }

  if (error) {
    throw error
  }

  return (data ?? []) as ProjectRecord[]
}

export async function createProject(session: AppSession, input: CreateProjectInput): Promise<ProjectRecord> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .insert({
      org_id: session.orgId,
      created_by: session.userId,
      name: input.name,
      description: input.description ?? null,
      objective: input.objective ?? null,
      status: input.status ?? 'draft',
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as ProjectRecord
}

export async function getProjectById(session: AppSession, projectId: string): Promise<ProjectRecord | null> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('id', projectId)
    .eq('org_id', session.orgId)
    .maybeSingle()

  if (isMissingRelationError(error)) {
    return null
  }

  if (error) {
    throw error
  }

  return (data as ProjectRecord | null) ?? null
}

export async function updateProject(
  session: AppSession,
  projectId: string,
  input: UpdateProjectInput
): Promise<ProjectRecord> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .update({
      name: input.name,
      description: input.description ?? null,
      objective: input.objective ?? null,
      status: input.status,
    })
    .eq('id', projectId)
    .eq('org_id', session.orgId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as ProjectRecord
}
