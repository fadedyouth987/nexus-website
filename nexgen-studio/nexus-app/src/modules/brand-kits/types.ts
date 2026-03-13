export type BrandKitRecord = {
  id: string
  org_id: string
  project_id: string | null
  name: string
  tone: string | null
  palette: string[]
  typography: string[]
  voice_guidelines: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type CreateBrandKitInput = {
  projectId?: string
  name: string
  tone?: string
  palette?: string[]
  typography?: string[]
  voiceGuidelines?: string
}
