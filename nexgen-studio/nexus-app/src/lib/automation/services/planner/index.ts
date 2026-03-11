import { createPlan } from '@/lib/planner/actions'
import type { PlanBriefInput, ContentItemInput } from '@/lib/planner/types'
import type { FactoryPersonaInput } from '@/lib/automation/pipeline/types'
import { buildPlanBriefFromPersona, savePlanBrief } from './brief'
import { generatePlanStrategy } from './strategy'
import { generatePlanCalendar } from './calendar'

export interface PlannerService {
  createPlan(userId: string, options?: { name?: string; timezone?: string }): Promise<{ planId: string }>
  buildBriefFromPersona(persona: FactoryPersonaInput): PlanBriefInput
  saveBrief(planId: string, brief: PlanBriefInput): Promise<void>
  generateStrategy(planId: string): Promise<Record<string, unknown>>
  generateCalendar(planId: string, durationDays?: number): Promise<ContentItemInput[]>
}

export function getPlannerService(): PlannerService {
  return {
    createPlan,
    buildBriefFromPersona: buildPlanBriefFromPersona,
    saveBrief: savePlanBrief,
    generateStrategy: generatePlanStrategy,
    generateCalendar: generatePlanCalendar,
  }
}
