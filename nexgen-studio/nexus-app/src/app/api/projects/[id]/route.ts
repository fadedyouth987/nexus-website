import { NextResponse } from 'next/server'
import { requireAppSession } from '@/server/auth/session'
import { handleRouteError, parseJsonBody } from '@/server/api/route'
import { getProject, updateProjectRecord, updateProjectSchema } from '@/modules/projects'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAppSession()
    const { id } = await context.params
    const project = await getProject(session, id)
    if (!project) {
      return NextResponse.json({ detail: 'Project not found' }, { status: 404 })
    }
    return NextResponse.json(project)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAppSession()
    const { id } = await context.params
    const payload = await parseJsonBody(request, updateProjectSchema)
    const project = await updateProjectRecord(session, id, payload)
    return NextResponse.json(project)
  } catch (error) {
    return handleRouteError(error)
  }
}
