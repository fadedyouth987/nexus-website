import type { ScheduledContentRunFrequency } from './types'

type LocalDateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: number
}

function parseTimeOfDay(value: string) {
  const [hour, minute] = value.split(':').map((part) => Number(part))
  return {
    hour: Number.isFinite(hour) ? hour : 9,
    minute: Number.isFinite(minute) ? minute : 0,
  }
}

function toWeekdayIndex(weekday: string) {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(weekday.toLowerCase())
}

function getLocalDateParts(date: Date, timezone: string): LocalDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  })

  const parts = formatter.formatToParts(date)
  const map = new Map(parts.map((part) => [part.type, part.value]))

  return {
    year: Number(map.get('year') || 0),
    month: Number(map.get('month') || 1),
    day: Number(map.get('day') || 1),
    hour: Number(map.get('hour') || 0),
    minute: Number(map.get('minute') || 0),
    weekday: toWeekdayIndex(map.get('weekday') || 'sun'),
  }
}

function zonedLocalToUtc(
  parts: Pick<LocalDateParts, 'year' | 'month' | 'day'> & { hour: number; minute: number },
  timezone: string
) {
  let guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0))

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = getLocalDateParts(guess, timezone)
    const targetValue = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0)
    const actualValue = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      0
    )
    const diff = targetValue - actualValue
    if (diff === 0) {
      return guess
    }
    guess = new Date(guess.getTime() + diff)
  }

  return guess
}

function addDays(parts: Pick<LocalDateParts, 'year' | 'month' | 'day'>, days: number) {
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0))
  utcDate.setUTCDate(utcDate.getUTCDate() + days)
  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
  }
}

export function computeInitialNextRunAt(params: {
  frequency: ScheduledContentRunFrequency
  dayOfWeek?: number | null
  timeOfDay: string
  timezone: string
  from?: Date
}) {
  const reference = params.from ?? new Date()
  const localReference = getLocalDateParts(reference, params.timezone)
  const { hour, minute } = parseTimeOfDay(params.timeOfDay)

  if (params.frequency === 'daily') {
    let candidate = zonedLocalToUtc(
      {
        year: localReference.year,
        month: localReference.month,
        day: localReference.day,
        hour,
        minute,
      },
      params.timezone
    )

    if (candidate.getTime() <= reference.getTime()) {
      const nextDay = addDays(localReference, 1)
      candidate = zonedLocalToUtc({ ...nextDay, hour, minute }, params.timezone)
    }

    return candidate.toISOString()
  }

  const desiredWeekday = params.dayOfWeek ?? localReference.weekday
  let daysUntil = (desiredWeekday - localReference.weekday + 7) % 7

  let candidateDate = {
    year: localReference.year,
    month: localReference.month,
    day: localReference.day,
  }
  if (daysUntil > 0) {
    candidateDate = addDays(candidateDate, daysUntil)
  }

  let candidate = zonedLocalToUtc({ ...candidateDate, hour, minute }, params.timezone)
  if (candidate.getTime() <= reference.getTime()) {
    candidateDate = addDays(candidateDate, daysUntil === 0 ? 7 : 0)
    if (daysUntil > 0) {
      candidateDate = addDays(
        {
          year: localReference.year,
          month: localReference.month,
          day: localReference.day,
        },
        daysUntil + 7
      )
    }
    candidate = zonedLocalToUtc({ ...candidateDate, hour, minute }, params.timezone)
  }

  return candidate.toISOString()
}

export function computeNextRunAtFromScheduled(params: {
  frequency: ScheduledContentRunFrequency
  dayOfWeek?: number | null
  timeOfDay: string
  timezone: string
  scheduledFor: string
}) {
  const scheduledDate = new Date(params.scheduledFor)
  const localScheduled = getLocalDateParts(scheduledDate, params.timezone)
  const { hour, minute } = parseTimeOfDay(params.timeOfDay)
  const nextDate = addDays(
    {
      year: localScheduled.year,
      month: localScheduled.month,
      day: localScheduled.day,
    },
    params.frequency === 'weekly' ? 7 : 1
  )

  return zonedLocalToUtc({ ...nextDate, hour, minute }, params.timezone).toISOString()
}

export function formatScheduledLabel(params: {
  frequency: ScheduledContentRunFrequency
  dayOfWeek?: number | null
  timeOfDay: string
  timezone: string
}) {
  if (params.frequency === 'daily') {
    return `Daily at ${params.timeOfDay} (${params.timezone})`
  }

  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][params.dayOfWeek ?? 0]
  return `Weekly on ${day} at ${params.timeOfDay} (${params.timezone})`
}
