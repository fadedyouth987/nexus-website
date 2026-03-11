function isEnabled(value: string | undefined) {
  if (!value) {
    return false
  }

  return value === '1' || value.toLowerCase() === 'true'
}

export function isPortfolioV2ServerEnabled() {
  return isEnabled(process.env.ENABLE_V2_PORTFOLIO) || isEnabled(process.env.NEXT_PUBLIC_ENABLE_V2_PORTFOLIO)
}

export function isPortfolioV2ClientEnabled() {
  return isEnabled(process.env.NEXT_PUBLIC_ENABLE_V2_PORTFOLIO)
}
