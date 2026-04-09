import { expect, type Locator, type Page } from '@playwright/test'

export function getProfileUrl() {
	const base = process.env.PP_PROFILE_URL
	if (base) return base
	return '/profile/?role=admin'
}

export async function openProfilePage(page: Page, opts?: { openGraphsTab?: boolean }) {
	await page.goto(getProfileUrl(), { waitUntil: 'domcontentloaded' })

	// Wait for page to be ready by checking for specific UI elements instead of networkidle.
	// networkidle is unreliable when SSE is enabled (features.sse=true in dev/test mode),
	// which opens a persistent EventSource connection, causing networkidle to hang/timeout.
	// Instead, wait for stable elements: error check and navigation tabs.
	await expect(page.getByText('Error: invalid dslabel')).not.toBeVisible({ timeout: 15000 })

	// Wait for navigation table with ABOUT/GRAPHS cells to indicate page is ready
	const aboutCell = page.getByRole('cell', { name: 'ABOUT' })
	await expect(aboutCell).toBeVisible({ timeout: 15000 })

	if (opts?.openGraphsTab) {
		const graphsCell = page.getByRole('cell', { name: 'GRAPHS' })
		if ((await graphsCell.count().catch(() => 0)) > 0) {
			await expect(graphsCell.first()).toBeVisible({ timeout: 10000 })
			await graphsCell.first().click()
		}
	}
}

export async function openChartByButton(page: Page, buttonTestId: string) {
	const button = page.getByTestId(buttonTestId).first()
	await expect(button).toBeVisible({ timeout: 20000 })
	await button.click()
}

export async function expectVisible(locator: Locator) {
	await expect(locator.first()).toBeVisible({ timeout: 20000 })
}

export async function openFiltersFromSandbox(page: Page, sandbox: Locator) {
	const filtersBtn = sandbox.locator('[data-testid$="-topbar"]').getByRole('button', { name: 'Filters' }).first()
	await expect(filtersBtn).toBeVisible({ timeout: 20000 })
	await filtersBtn.click()
	await expect(page.getByLabel('Region').first()).toBeVisible({ timeout: 10000 })
}
