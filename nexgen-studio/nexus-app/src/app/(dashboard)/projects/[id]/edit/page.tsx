import { notFound } from 'next/navigation'
import { ProjectForm } from '@/components/dashboard/forms/ProjectForm'
import { requireAppSession } from '@/server/auth/session'
import { getProject } from '@/modules/projects'

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireAppSession()
  const { id } = await params
  const project = await getProject(session, id)

  if (!project) {
    notFound()
  }

  return (
    <ProjectForm
      mode="edit"
      initialValues={{
        id: project.id,
        name: project.name,
        description: project.description ?? '',
        objective: project.objective ?? '',
        status: project.status,
      }}
    />
  )
}
