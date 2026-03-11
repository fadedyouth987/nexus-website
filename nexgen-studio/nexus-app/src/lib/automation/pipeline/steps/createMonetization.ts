import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import type { InfluencerPipelineContext, PipelineStep } from '@/lib/automation/pipeline/types'

export function createMonetizationStep(): PipelineStep<InfluencerPipelineContext> {
  return {
    name: 'create-monetization',
    enabled(context) {
      return Boolean(String(context.persona.monetization_strategy || '').trim())
    },
    async execute(context) {
      const admin = getEngineSupabaseAdmin()
      const { data, error } = await admin
        .from('monetization_offers')
        .insert({
          user_id: context.userId,
          name: `${String(context.persona.name || 'Creator').trim()} starter offer`,
          offer_type: 'paid_shoutout',
          content_rating: context.persona.content_rating === 'nsfw' ? 'nsfw' : 'sfw',
          platform: context.persona.platforms?.[0] || 'instagram',
          price_cents: 500,
          currency: 'usd',
          status: 'draft',
        })
        .select('id')
        .single()

      if (error || !data?.id) {
        return {
          monetizationOfferId: null,
        }
      }

      return {
        monetizationOfferId: String(data.id),
      }
    },
  }
}
