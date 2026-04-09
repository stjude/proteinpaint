import { expect, type Locator, type Page } from '@playwright/test'

export function getProfileUrl() {
	const base = process.env.PP_PROFILE_URL
	if (base) return base
	return '/profile/?role=admin'
}

export async function openProfilePage(page: Page, opts?: { openGraphsTab?: boolean }) {
	await page.goto(getProfileUrl(), { waitUntil: 'domcontentloaded' })
	await page.waitForLoadState('networkidle')

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
