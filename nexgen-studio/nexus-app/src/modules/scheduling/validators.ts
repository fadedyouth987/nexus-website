import { z } from 'zod'

const timeOfDaySchema = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format')

const baseScheduleSchema = z.object({
  projectId: z.string().uuid().optional(),
  brandKitId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  workflowTemplateId: z.string().uuid().optional(),
  influencerId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(160),
  brief: z.string().trim().min(10).max(5000),
  script: z.string().trim().max(12000).optional(),
  frequency: z.enum(['daily', 'weekly']),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  timeOfDay: timeOfDaySchema,
  timezone: z.string().trim().min(1).max(80),
  jobsPerRun: z.number().int().min(1).max(10).optional(),
  provider: z.string().trim().max(40).optional(),
  jobKind: z.enum(['video', 'image']),
  inputs: z.record(z.string(), z.unknown()).optional(),
})

export const createScheduledContentRunSchema = baseScheduleSchema.superRefine((value, ctx) => {
  if (value.frequency === 'weekly' && value.dayOfWeek === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dayOfWeek'],
      message: 'Weekly schedules require a day of week',
    })
  }
})

export const updateScheduledContentRunSchema = createScheduledContentRunSchema
