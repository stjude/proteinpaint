import { test, expect } from '@playwright/test'
import { expectVisible, openChartByButton, openFiltersFromSandbox, openProfilePage } from './helpers.js'

test('profileBarchart server-side smoke: legend, bars, controls, filters', async ({ page }) => {
	await openProfilePage(page, { openGraphsTab: true })
	await openChartByButton(page, 'sjpp-chart-btn-barchart')

	const legend = page.getByTestId('sjpp-profileBarchart-legend')
	const sandbox = page.locator('.sjpp-profile-barchart-sandbox').first()

	await expectVisible(legend)
	await expectVisible(sandbox)
	await expect(sandbox.locator('svg').first()).toBeVisible()
	await expect(sandbox.locator('svg rect').first()).toBeVisible()
	await expect(sandbox.locator('select').first()).toBeVisible()

	await openFiltersFromSandbox(page, sandbox)
	await expect(page.getByLabel('Region').first()).toBeVisible()
})
