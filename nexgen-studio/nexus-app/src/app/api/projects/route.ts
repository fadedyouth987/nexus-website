import { NextResponse } from 'next/server'
import { requireAppSession } from '@/server/auth/session'
import { handleRouteError, parseJsonBody } from '@/server/api/route'
import { createProjectRecord, createProjectSchema, getProjects } from '@/modules/projects'

export async function GET() {
  try {
    const session = await requireAppSession()
    const projects = await getProjects(session)
    return NextResponse.json({ items: projects })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAppSession()
    const payload = await parseJsonBody(request, createProjectSchema)
    const project = await createProjectRecord(session, payload)
    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
