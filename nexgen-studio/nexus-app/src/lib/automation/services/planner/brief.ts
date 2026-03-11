import type { FactoryPersonaInput } from '@/lib/automation/pipeline/types'
import type { PlanBriefInput } from '@/lib/planner/types'
import { saveBrief } from '@/lib/planner/actions'

function toArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : []
}

export function buildPlanBriefFromPersona(persona: FactoryPersonaInput): PlanBriefInput {
  return {
    niche: String(persona.niche || '').trim(),
    tone: String(persona.tone || persona.speech_style || 'confident').trim(),
    audience_json: toArray([persona.audience_type || 'general audience']),
    platforms_json: toArray(persona.platforms).length > 0 ? toArray(persona.platforms) : ['instagram', 'tiktok'],
    posting_frequency_json:
      typeof persona.posting_frequency === 'number' && Number.isFinite(persona.posting_frequency)
        ? { per_day: Math.max(1, Math.min(6, Math.floor(persona.posting_frequency))) }
        : { per_day: 1 },
    monetization_goal: String(persona.monetization_strategy || 'growth and conversion').trim(),
    visual_style: String(persona.speech_style || '').trim() || 'clean',
    constraints_json: {
      avoid: [],
      prefer: toArray(persona.catchphrases),
      content_rating: persona.content_rating === 'nsfw' ? 'nsfw' : 'sfw',
      model_source: persona.model_source === 'custom' ? 'custom' : 'builtin',
      custom_model_source: persona.custom_model_source ? String(persona.custom_model_source) : null,
      personality: String(persona.personality || '').trim(),
    },
  }
}

export async function savePlanBrief(planId: string, brief: PlanBriefInput): Promise<void> {
  await saveBrief(planId, brief)
}
