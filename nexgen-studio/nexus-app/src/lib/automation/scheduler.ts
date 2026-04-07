import { createServiceClient } from '@/lib/supabase/service'

export type ScheduledJob = {
  id: string
  org_id: string
  user_id: string | null
  name: string
  cron_expression: string | null
  schedule_type: 'cron' | 'once' | 'interval'
  interval_minutes: number | null
  run_at: string | null
  job_type: string
  input_params: Record<string, unknown>
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  last_run_at: string | null
  last_run_status: string | null
  next_run_at: string | null
  run_count: number
  max_runs: number | null
  created_at: string
  updated_at: string
}

export async function getDueScheduledJobs(): Promise<ScheduledJob[]> {
  const service = createServiceClient()
  
  const { data, error } = await service
    .from('scheduled_jobs')
    .select('*')
    .eq('status', 'active')
    .order('next_run_at', { ascending: true })
  
  if (error) {
    console.error('[scheduler] failed to fetch scheduled jobs:', error)
    return []
  }
  
  if (!data || data.length === 0) return []
  
  const now = new Date()
  const dueJobs = data.filter(job => {
    const jobObj = job as ScheduledJob
    
    // Check if job is due based on schedule type
    if (jobObj.schedule_type === 'once') {
      const runAt = jobObj.run_at ? new Date(jobObj.run_at) : null
      return runAt && runAt <= now && jobObj.run_count === 0
    }
    
    if (jobObj.schedule_type === 'cron') {
      // Simple cron check - in production you'd use a proper cron parser
      const nextRunAt = jobObj.next_run_at ? new Date(jobObj.next_run_at) : null
      return nextRunAt && nextRunAt <= now
    }
    
    if (jobObj.schedule_type === 'interval') {
      const lastRunAt = jobObj.last_run_at ? new Date(jobObj.last_run_at) : null
      const intervalMs = (jobObj.interval_minutes ?? 60) * 60 * 1000
      return (!lastRunAt || now.getTime() - lastRunAt.getTime() >= intervalMs)
    }
    
    return false
  })
  
  // Also check max_runs constraint
  return dueJobs.filter(job => 
    job.max_runs === null || job.run_count < job.max_runs
  ) as ScheduledJob[]
}

export async function markScheduledJobAsRunning(jobId: string): Promise<void> {
  const service = createServiceClient()
  await service
    .from('scheduled_jobs')
    .update({
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

export async function completeScheduledJobRun(
  jobId: string,
  status: 'success' | 'failed',
  incrementRunCount: boolean = true
): Promise<void> {
  const service = createServiceClient()

  const { data: jobRow, error } = await service
    .from('scheduled_jobs')
    .select('schedule_type, interval_minutes, cron_expression, max_runs, run_count')
    .eq('id', jobId)
    .single()

  if (error || !jobRow) {
    console.error('[scheduler] completeScheduledJobRun: job not found', jobId, error)
    return
  }

  const update: Record<string, unknown> = {
    last_run_status: status,
    updated_at: new Date().toISOString(),
  }

  if (incrementRunCount) {
    update.run_count = (jobRow.run_count ?? 0) + 1
  }

  if (jobRow.schedule_type === 'once') {
    update.status = 'completed'
  } else if (jobRow.schedule_type === 'interval') {
    const intervalMs = (jobRow.interval_minutes ?? 60) * 60 * 1000
    update.next_run_at = new Date(Date.now() + intervalMs).toISOString()
  } else if (jobRow.schedule_type === 'cron') {
    update.next_run_at = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  }

  await service.from('scheduled_jobs').update(update).eq('id', jobId)
}

export async function createScheduledJob(
  orgId: string,
  userId: string | null,
  name: string,
  options: {
    cronExpression?: string
    runAt?: string
    intervalMinutes?: number
    jobType: string
    inputParams: Record<string, unknown>
    maxRuns?: number
  }
): Promise<string> {
  const service = createServiceClient()
  
  let scheduleType: 'cron' | 'once' | 'interval' = 'cron'
  let cronExpression: string | null = null
  let intervalMinutes: number | null = null
  let runAt: string | null = null
  
  if (options.runAt) {
    scheduleType = 'once'
    runAt = options.runAt
  } else if (options.intervalMinutes) {
    scheduleType = 'interval'
    intervalMinutes = options.intervalMinutes
  } else if (options.cronExpression) {
    scheduleType = 'cron'
    cronExpression = options.cronExpression
  }
  
  const now = new Date()
  let nextRunAt: string | null = null
  
  if (scheduleType === 'once' && runAt) {
    nextRunAt = runAt
  } else if (scheduleType === 'interval' && intervalMinutes) {
    const intervalMs = intervalMinutes * 60 * 1000
    nextRunAt = new Date(Date.now() + intervalMs).toISOString()
  } else if (scheduleType === 'cron' && cronExpression) {
    // Simple cron calculation - in production use proper cron library
    nextRunAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // +1 hour as placeholder
  }
  
  const { data } = await service
    .from('scheduled_jobs')
    .insert({
      org_id: orgId,
      user_id: userId,
      name,
      cron_expression: cronExpression,
      schedule_type: scheduleType,
      interval_minutes: intervalMinutes,
      run_at: runAt,
      job_type: options.jobType,
      input_params: options.inputParams,
      status: 'active',
      next_run_at: nextRunAt,
      run_count: 0,
      max_runs: options.maxRuns ?? null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select('id')
    .single()
  
  if (!data) {
    throw new Error('Failed to create scheduled job')
  }
  
  return data.id
}

export async function pauseScheduledJob(jobId: string): Promise<void> {
  const service = createServiceClient()
  await service
    .from('scheduled_jobs')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', jobId)
}

export async function resumeScheduledJob(jobId: string): Promise<void> {
  const service = createServiceClient()
  const jobData = await service
    .from('scheduled_jobs')
    .select('schedule_type, interval_minutes, cron_expression')
    .eq('id', jobId)
    .single()
  
  let nextRunAt: string | null = null
  if (jobData.data) {
    const jobObj = jobData.data as any
    const now = new Date()
    
    if (jobObj.schedule_type === 'interval' && jobObj.interval_minutes) {
      const intervalMs = jobObj.interval_minutes * 60 * 1000
      nextRunAt = new Date(Date.now() + intervalMs).toISOString()
    } else if (jobObj.schedule_type === 'cron' && jobObj.cron_expression) {
      // Simple cron calculation
      nextRunAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // +1 hour as placeholder
    }
  }
  
  await service
    .from('scheduled_jobs')
    .update({ 
      status: 'active',
      next_run_at: nextRunAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

export async function cancelScheduledJob(jobId: string): Promise<void> {
  const service = createServiceClient()
  await service
    .from('scheduled_jobs')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', jobId)
}
