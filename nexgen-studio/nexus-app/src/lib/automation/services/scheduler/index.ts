import { queuePlannerToScheduler } from './queue'

export interface SchedulerService {
  queuePlannerToScheduler: typeof queuePlannerToScheduler
}

export function getSchedulerService(): SchedulerService {
  return {
    queuePlannerToScheduler,
  }
}
