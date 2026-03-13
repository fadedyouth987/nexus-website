export type CampaignRecord = {
  id: string
  org_id: string
  project_id: string | null
  brand_kit_id: string | null
  name: string
  brief: string
  channel: string | null
  objective: string | null
  status: 'draft' | 'ready' | 'running' | 'completed' | 'archived'
  created_by: string
  created_at: string
  updated_at: string
}

export type CreateCampaignInput = {
  projectId?: string
  brandKitId?: string
  name: string
  brief: string
  channel?: string
  objective?: string
  status?: 'draft' | 'ready'
}

export type UpdateCampaignInput = Omit<CreateCampaignInput, 'status'> & {
  status?: 'draft' | 'ready' | 'running' | 'completed' | 'archived'
}
