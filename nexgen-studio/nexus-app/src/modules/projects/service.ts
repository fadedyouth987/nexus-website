import type { AppSession } from '@/server/auth/session'
import { createProject, getProjectById, listProjects, updateProject } from './repository'
import type { CreateProjectInput, UpdateProjectInput } from './types'

export async function getProjects(session: AppSession) {
  return listProjects(session)
}

export async function createProjectRecord(session: AppSession, input: CreateProjectInput) {
  return createProject(session, input)
}

export async function getProject(session: AppSession, projectId: string) {
  return getProjectById(session, projectId)
}

export async function updateProjectRecord(
  session: AppSession,
  projectId: string,
  input: UpdateProjectInput
) {
  return updateProject(session, projectId, input)
}
