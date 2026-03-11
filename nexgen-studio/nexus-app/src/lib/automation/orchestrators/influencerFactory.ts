import { runPipeline } from '@/lib/automation/pipeline/runner'
import type {
  FactoryPayload,
  FactoryPersonaInput,
  InfluencerPipelineContext,
  PipelineStep,
} from '@/lib/automation/pipeline/types'
import { createCreatorStep } from '@/lib/automation/pipeline/steps/createCreator'
import { createPlanStep } from '@/lib/automation/pipeline/steps/createPlan'
import { generateBriefStep } from '@/lib/automation/pipeline/steps/generateBrief'
import { generateStrategyStep } from '@/lib/automation/pipeline/steps/generateStrategy'
import { generateCalendarStep } from '@/lib/automation/pipeline/steps/generateCalendar'
import { queueToSchedulerStep } from '@/lib/automation/pipeline/steps/queueToScheduler'
import { createMonetizationStep } from '@/lib/automation/pipeline/steps/createMonetization'

export type InfluencerFactoryResult = {
  ok: true
  creator: InfluencerPipelineContext['creator']
  planId: string | null
  brief: InfluencerPipelineContext['brief']
  strategy: InfluencerPipelineContext['strategy']
  contentItemsCount: number
  schedulerQueue: InfluencerPipelineContext['schedulerQueue']
  monetizationOfferId: string | null
  reports: Array<{ name: string; status: 'completed' | 'skipped' }>
}

export function assertFactoryPersona(payload: FactoryPayload): FactoryPersonaInput {
  const persona = payload.persona || {}
  const name = String(persona.name || '').trim()
  const niche = String(persona.niche || '').trim()

  if (!name || !niche) {
    const error = new Error('persona.name and persona.niche are required')
    ;(error as Error & { status?: number }).status = 400
    throw error
  }

  return {
    ...persona,
    name,
    niche,
  }
}

export function createInfluencerPipelineContext(
  userId: string,
  persona: FactoryPersonaInput,
  overrides: Partial<InfluencerPipelineContext> = {}
): InfluencerPipelineContext {
  return {
    userId,
    persona,
    creator: null,
    planId: null,
    brief: null,
    strategy: null,
    contentItems: [],
    schedulerQueue: null,
    monetizationOfferId: null,
    ...overrides,
  }
}

export function getInfluencerFactorySteps(options?: {
  durationDays?: number
  includeQueue?: boolean
  includeMonetization?: boolean
}): Array<PipelineStep<InfluencerPipelineContext>> {
  const includeQueue = options?.includeQueue !== false
  const includeMonetization = options?.includeMonetization !== false
  const durationDays = options?.durationDays ?? 30

  const steps: Array<PipelineStep<InfluencerPipelineContext>> = [
    createCreatorStep(),
    createPlanStep(),
    generateBriefStep(),
    generateStrategyStep(),
    generateCalendarStep(durationDays),
  ]

  if (includeQueue) {
    steps.push(queueToSchedulerStep())
  }

  if (includeMonetization) {
    steps.push(createMonetizationStep())
  }

  return steps
}

export async function runInfluencerFactory(
  userId: string,
  payload: FactoryPayload,
  options?: {
    durationDays?: number
    includeQueue?: boolean
    includeMonetization?: boolean
  }
): Promise<InfluencerFactoryResult> {
  const persona = assertFactoryPersona(payload)
  const initialContext = createInfluencerPipelineContext(userId, persona)
  const steps = getInfluencerFactorySteps(options)
  const result = await runPipeline(steps, initialContext)
  const { context } = result

  return {
    ok: true,
    creator: context.creator,
    planId: context.planId,
    brief: context.brief,
    strategy: context.strategy,
    contentItemsCount: context.contentItems.length,
    schedulerQueue: context.schedulerQueue,
    monetizationOfferId: context.monetizationOfferId,
    reports: result.reports.map((report) => ({
      name: report.name,
      status: report.status,
    })),
  }
}
