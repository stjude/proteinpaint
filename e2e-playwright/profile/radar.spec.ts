import { test, expect } from '@playwright/test'
import { expectVisible, openChartByButton, openFiltersFromSandbox, openProfilePage } from './helpers.js'

test('profileRadar server-side smoke: legend, table, points, filters', async ({ page }) => {
	await openProfilePage(page, { openGraphsTab: true })
	await openChartByButton(page, 'sjpp-chart-btn-radar')

	const legend = page.getByTestId('sjpp-profileRadar-legend')
	const table = page.getByTestId('sjpp-profileRadar-data-table')
	const sandbox = page.getByTestId('sjpp-massplot-sandbox-profileRadar').first()

	await expectVisible(legend)
	await expectVisible(table)
	await expectVisible(sandbox)
	await expect(page.locator('svg').first()).toBeVisible()
	await expect(page.locator('svg circle').first()).toBeVisible()
	await expect(table.locator('tr').nth(1)).toBeVisible()

	await openFiltersFromSandbox(page, sandbox)
	await expect(page.getByLabel('Region').first()).toBeVisible()
})
