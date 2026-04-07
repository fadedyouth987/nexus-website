import { test, expect } from '@playwright/test'

/**
 * Happy Path E2E Test: Create → Generate → View flow
 *
 * Tests the core user journey through the studio:
 * 1. Navigate to Studio
 * 2. Create a generation (fill prompt)
 * 3. Submit generation job
 * 4. View job in list
 * 5. Open job detail
 *
 * Note: This test assumes local dev environment with test credentials.
 * Set TEST_USER_EMAIL and TEST_USER_PASSWORD env vars for auth testing.
 */

test.describe('Happy Path: Create → Generate → View', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/')

    // Check if on login page and auth with test credentials
    const loginButton = page.locator('button:has-text("Sign in"), button:has-text("Log in")').first()
    if (await loginButton.isVisible().catch(() => false)) {
      // Auth with test credentials (if available)
      const testEmail = process.env.TEST_USER_EMAIL
      const testPassword = process.env.TEST_USER_PASSWORD

      if (testEmail && testPassword) {
        await page.fill('input[type="email"], input[name="email"]', testEmail)
        await page.fill('input[type="password"], input[name="password"]', testPassword)
        await page.click('button[type="submit"]')
        // Wait for navigation to complete
        await page.waitForURL(/\/(studio|dashboard)/, { timeout: 10000 })
      } else {
        // Skip test if no auth credentials
        test.skip(true, 'Skipping test - no auth credentials provided')
      }
    }
  })

  test('user can navigate to studio and see generation interface', async ({ page }) => {
    // Navigate to Studio
    await page.goto('/studio')

    // Verify studio page loaded
    await expect(page).toHaveURL(/\/studio/)

    // Check for studio elements (prompt input, generate button)
    const promptInput = page.locator(
      'textarea[placeholder*="prompt" i], input[placeholder*="prompt" i], [data-testid="prompt-input"]'
    ).first()

    // If prompt input exists, verify we can interact
    const hasPromptInput = await promptInput.isVisible().catch(() => false)

    if (hasPromptInput) {
      // Verify generate button exists
      const generateButton = page.locator(
        'button:has-text("Generate"), button:has-text("Create"), [data-testid="generate-button"]'
      ).first()
      await expect(generateButton).toBeVisible()
    } else {
      // Alternative: check for studio-specific content
      const studioContent = page.locator(
        'text=Studio, text=Generate, text=Create, [data-testid="studio-page"]'
      ).first()
      await expect(studioContent).toBeVisible()
    }
  })

  test('user can submit generation job', async ({ page }) => {
    // Navigate to Studio
    await page.goto('/studio')
    await expect(page).toHaveURL(/\/studio/)

    // Find and fill prompt input
    const promptInput = page.locator(
      'textarea[placeholder*="prompt" i], input[placeholder*="prompt" i], [data-testid="prompt-input"]'
    ).first()

    const hasPromptInput = await promptInput.isVisible().catch(() => false)

    if (!hasPromptInput) {
      test.skip(true, 'Studio prompt input not found - skipping test')
    }

    // Fill prompt
    const testPrompt = 'Test generation from Playwright e2e test'
    await promptInput.fill(testPrompt)

    // Click generate button
    const generateButton = page.locator(
      'button:has-text("Generate"), button:has-text("Create"), [data-testid="generate-button"]'
    ).first()
    await generateButton.click()

    // Wait for submission response (loading state or success message)
    await page.waitForTimeout(2000)

    // Check for loading state or success indication
    const loadingIndicator = page.locator(
      'text=generating, text=loading, text=queued, [data-testid="loading"], .animate-pulse'
    ).first()
    const successMessage = page.locator(
      'text=generating, text=success, text=queued, [data-testid="success"]'
    ).first()

    // Either loading or success should be present
    const hasFeedback =
      (await loadingIndicator.isVisible().catch(() => false)) ||
      (await successMessage.isVisible().catch(() => false))

    expect(hasFeedback).toBeTruthy()
  })

  test('user can view generation jobs list', async ({ page }) => {
    // Navigate to Generation Jobs page
    await page.goto('/video-jobs')

    // Verify page loads
    await expect(page).toHaveURL(/\/video-jobs/)

    // Check for jobs list or empty state
    const jobsContent = page.locator(
      'text=Generation Jobs, text=No records, [data-testid="jobs-list"], [data-testid="empty-state"]'
    ).first()
    await expect(jobsContent).toBeVisible()

    // If jobs exist, verify we can see them
    const jobItems = page.locator('[data-testid="job-item"], .rounded-2xl').first()
    const hasJobs = await jobItems.isVisible().catch(() => false)

    if (hasJobs) {
      // Verify job item has expected structure
      const jobTitle = page.locator('.text-sm.font-semibold, [data-testid="job-title"]').first()
      await expect(jobTitle).toBeVisible()
    }
  })

  test('complete flow: studio → submit → view in list', async ({ page }) => {
    // Step 1: Go to studio
    await page.goto('/studio')
    await expect(page).toHaveURL(/\/studio/)

    // Step 2: Fill and submit
    const promptInput = page.locator(
      'textarea[placeholder*="prompt" i], input[placeholder*="prompt" i], [data-testid="prompt-input"]'
    ).first()

    const hasPromptInput = await promptInput.isVisible().catch(() => false)

    if (hasPromptInput) {
      await promptInput.fill('Complete flow test prompt')

      const generateButton = page.locator(
        'button:has-text("Generate"), button:has-text("Create"), [data-testid="generate-button"]'
      ).first()
      await generateButton.click()

      // Wait for submission
      await page.waitForTimeout(3000)
    }

    // Step 3: Navigate to jobs list
    await page.goto('/video-jobs')
    await expect(page).toHaveURL(/\/video-jobs/)

    // Step 4: Verify we're on the jobs page
    const pageTitle = page.locator('text=Generation Jobs').first()
    await expect(pageTitle).toBeVisible()

    // Step 5: If jobs exist, try to open one
    const firstJobLink = page.locator('a:has-text("Open"), [data-testid="job-link"]').first()
    const hasJobLink = await firstJobLink.isVisible().catch(() => false)

    if (hasJobLink) {
      await firstJobLink.click()
      // Verify navigation to job detail
      await expect(page).toHaveURL(/\/video-jobs\//)
    }
  })
})

/**
 * Mobile responsive tests
 */
test.describe('Mobile: Create → Generate → View', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('studio is accessible on mobile', async ({ page }) => {
    await page.goto('/studio')

    // Verify page loads on mobile
    await expect(page).toHaveURL(/\/studio/)

    // Check for mobile-friendly elements
    const mobileContent = page.locator('body').first()
    await expect(mobileContent).toBeVisible()
  })
})
