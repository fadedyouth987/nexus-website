type PostgrestErrorLike = {
  code?: string
  message?: string
}

export function isMissingRelationError(error: PostgrestErrorLike | null | undefined) {
  return error?.code === '42P01'
}

export function isMissingColumnError(error: PostgrestErrorLike | null | undefined) {
  return error?.code === '42703'
}
