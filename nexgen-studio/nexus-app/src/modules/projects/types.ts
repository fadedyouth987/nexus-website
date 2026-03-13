export type ProjectRecord = {
  id: string
  org_id: string
  name: string
  description: string | null
  objective: string | null
  status: 'draft' | 'active' | 'archived'
  created_by: string
  created_at: string
  updated_at: string
}

export type CreateProjectInput = {
  name: string
  description?: string
  objective?: string
  status?: 'draft' | 'active'
}

export type UpdateProjectInput = Omit<CreateProjectInput, 'status'> & {
  status?: 'draft' | 'active' | 'archived'
}
