import { FolderKanban } from 'lucide-react'
import { ResourceListCard } from '@/components/dashboard/ResourceListCard'
import { getProjects } from '@/modules/projects'
import { requireAppSession } from '@/server/auth/session'

export default async function ProjectsPage() {
  const session = await requireAppSession()
  const projects = await getProjects(session).catch(() => [])

  return (
    <ResourceListCard
      eyebrow="Projects"
      title="Projects organize client work, product initiatives, and recurring content systems."
      description="Each project is the root container for brand kits, campaign briefs, and async video generation. This replaces the older scattered creator-first entry point with a clearer SaaS object model."
      icon={FolderKanban}
      actionHref="/projects/new"
      actionLabel="New project"
      items={projects.map((project) => ({
        id: project.id,
        title: project.name,
        description: project.description || project.objective || 'Project created and ready for brand kits and campaign briefs.',
        meta: project.status,
        editHref: `/projects/${project.id}/edit`,
      }))}
    />
  )
}
