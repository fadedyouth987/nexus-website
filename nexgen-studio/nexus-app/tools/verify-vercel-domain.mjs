import { resolve4 } from 'node:dns/promises'

const url = process.env.DEPLOY_VERIFY_URL || 'https://nexgencompany.org'
const expectedHost = process.env.DEPLOY_VERIFY_HOST || 'nexgencompany.org'
const expectedMarkers = (process.env.DEPLOY_VERIFY_MARKERS || 'AI Influencer Nexus,Nexus Studio')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

function fail(message) {
  console.error(`[verify-vercel-domain] ${message}`)
  process.exit(1)
}

async function main() {
  try {
    const resolved = await resolve4(expectedHost)
    console.log(`[verify-vercel-domain] ${expectedHost} resolved to ${resolved.join(', ')}`)
  } catch (error) {
    console.warn(
      `[verify-vercel-domain] DNS lookup warning for ${expectedHost}: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }

  let response
  try {
    response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'nexus-app-deploy-verifier/1.0',
      },
    })
  } catch (error) {
    fail(`HTTP request failed for ${url}: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!response.ok) {
    fail(`Expected 2xx from ${url}, received ${response.status}`)
  }

  const html = await response.text()
  const matchedMarker = expectedMarkers.find((marker) => html.includes(marker))

  if (!matchedMarker) {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1] : 'unknown'
    fail(
      `Live domain ${url} did not contain any expected marker (${expectedMarkers.join(', ')}). Page title was "${title}".`
    )
  }

  const server = response.headers.get('server') || 'unknown'
  console.log(
    `[verify-vercel-domain] ${url} returned ${response.status} via server=${server} and matched marker="${matchedMarker}"`
  )
}

await main()
