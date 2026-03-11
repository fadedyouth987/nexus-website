import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

// Flat config: ignores must be a top-level config object (its own entry in the array)
export default [
  { ignores: [".next/", ".next.stale/", "node_modules/", "dist/", ".open-next/"] },
  ...nextCoreWebVitals,
]
