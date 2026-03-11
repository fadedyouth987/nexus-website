export function outputKey(opts: {
  userId: string
  jobId: string
  filename: string
  isVault: boolean
}) {
  if (opts.isVault) {
    return `vault/users/${opts.userId}/jobs/${opts.jobId}/${opts.filename}`
  }
  return `users/${opts.userId}/jobs/${opts.jobId}/${opts.filename}`
}
