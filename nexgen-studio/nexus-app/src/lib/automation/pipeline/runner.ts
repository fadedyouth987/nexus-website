import type { PipelineRunResult, PipelineStep } from './types'

export async function runPipeline<TContext>(
  steps: Array<PipelineStep<TContext>>,
  initialContext: TContext,
  options?: {
    onStepComplete?: (stepName: string, context: TContext) => void
  }
): Promise<PipelineRunResult<TContext>> {
  let context = initialContext
  const reports: PipelineRunResult<TContext>['reports'] = []

  for (const step of steps) {
    const isEnabled = step.enabled ? step.enabled(context) : true
    if (!isEnabled) {
      reports.push({
        name: step.name,
        status: 'skipped',
        context,
      })
      continue
    }

    const patch = await step.execute(context)
    if (patch) {
      context = {
        ...context,
        ...patch,
      }
    }

    reports.push({
      name: step.name,
      status: 'completed',
      context,
    })

    options?.onStepComplete?.(step.name, context)
  }

  return {
    context,
    reports,
  }
}
