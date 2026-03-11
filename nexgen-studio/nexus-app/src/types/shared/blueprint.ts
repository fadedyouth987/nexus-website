export type BlueprintJobRecord = {
  id: string;
  user_id: string;
  organization_id: string;
  influencer_id: string;
  workflow_template_id: string;
  mode: 'IMAGE' | 'VIDEO';
  content_policy: 'SFW' | 'NSFW';
  status: string;
  prompt_id: string | null;
  progress_json: Record<string, unknown>;
  inputs_json: Record<string, unknown>;
  resolved_workflow_json: Record<string, unknown> | null;
  error: string | null;
  attempt: number;
}

export type SafeImageGenerationJobPayload = {
  kind: 'content_v2_safe_image';
  org_id: string;
  workspace_id: string;
  content_id: string;
  prompt: string;
  requested_at?: string;
  requested_by?: string | null;
}
