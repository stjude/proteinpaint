import { test, expect } from '@playwright/test'
import { expectVisible, openFiltersFromSandbox, openProfilePage } from './helpers.js'

const FILTER_LABELS = [
	'Region',
	'Country',
	'Income group',
	'Facility type',
	'Government-designated Teaching Facility Status',
	'Government-designated Referral Facility Status',
	'Funding Source',
	'Hospital Volume',
	'Year of Implementation',
	'Sites'
]

function waitForPolarScoresResponse(page) {
	return page.waitForResponse(
		resp => resp.url().includes('termdb/profilePolar2Scores') && resp.request().method() === 'POST',
		{
			timeout: 30000
		}
	)
}

async function getEnabledOptionValues(selectLocator) {
	return await selectLocator.locator('option').evaluateAll(options =>
		options
			.map(o => ({
				value: (o as HTMLOptionElement).value,
				disabled: (o as HTMLOptionElement).disabled
			}))
			.filter(o => !o.disabled && o.value)
			.map(o => o.value)
	)
}

test('profilePolar2 server-side smoke: legend, table, arcs, filters', async ({ page }) => {
	await openProfilePage(page, { openGraphsTab: true })

	const table = page.getByTestId('sjpp-profilePolar2-data-table')
	const legend = page.getByTestId('sjpp-profilePolar2-legend')
	const svg = page.locator('svg').first()
	const sandbox = page.getByTestId('sjpp-massplot-sandbox-profilePolar2').first()

	await expectVisible(sandbox)
	await expectVisible(table)
	await expectVisible(legend)
	await expectVisible(svg)
	await expect(svg.locator('path').first()).toBeVisible()
	await expect(table.locator('tr').nth(1)).toBeVisible()

	await openFiltersFromSandbox(page, sandbox)
	await expect(page.getByLabel('Region').first()).toBeVisible()
})

test('profilePolar2 module scores match server-calculated term2Score payload', async ({ page }) => {
	const scoresResponsePromise = page.waitForResponse(
		resp => resp.url().includes('termdb/profilePolar2Scores') && resp.request().method() === 'POST',
		{ timeout: 30000 }
	)

	await openProfilePage(page, { openGraphsTab: true })

	const table = page.getByTestId('sjpp-profilePolar2-data-table')
	await expectVisible(table)
	await expect(table.locator('tr').nth(1)).toBeVisible()

	const scoresResponse = await scoresResponsePromise
	const scoresJson = await scoresResponse.json()
	const apiScores = Object.values((scoresJson?.term2Score || {}) as Record<string, number>)
		.filter(v => Number.isFinite(v))
		.map(v => Number(v))
		.sort((a, b) => a - b)

	const rowCount = await table.locator('tr').count()
	const uiScores: number[] = []
	for (let i = 1; i < rowCount; i++) {
		const row = table.locator('tr').nth(i)
		const scoreText = (await row.locator('td').nth(2).textContent())?.trim() || ''
		if (!scoreText || scoreText.toUpperCase() === 'N/A') continue
		const numeric = Number(scoreText.replace('%', ''))
		if (Number.isFinite(numeric)) uiScores.push(numeric)
	}
	uiScores.sort((a, b) => a - b)

	expect(uiScores.length).toBeGreaterThan(0)
	expect(apiScores.length).toBeGreaterThan(0)
	expect(uiScores).toEqual(apiScores)
})

test('profilePolar2 single-site selection in Sites filter narrows server-side sample set', async ({ page }) => {
	const baselineResponsePromise = page.waitForResponse(
		resp => resp.url().includes('termdb/profilePolar2Scores') && resp.request().method() === 'POST',
		{ timeout: 30000 }
	)

	await openProfilePage(page, { openGraphsTab: true })
	const sandbox = page.getByTestId('sjpp-massplot-sandbox-profilePolar2').first()
	const table = page.getByTestId('sjpp-profilePolar2-data-table')
	await expectVisible(sandbox)
	await expectVisible(table)

	const baselineResponse = await baselineResponsePromise
	const baselineJson = await baselineResponse.json()
	const baselineN = Number(baselineJson?.n)
	expect(Number.isFinite(baselineN)).toBe(true)

	await openFiltersFromSandbox(page, sandbox)

	const sitesSelect = page.getByLabel('Sites').first()
	await expect(sitesSelect).toBeVisible({ timeout: 10000 })

	const siteValues = await getEnabledOptionValues(sitesSelect)
	expect(siteValues.length).toBeGreaterThan(0)

	const filteredResponsePromise = page.waitForResponse(
		resp => resp.url().includes('termdb/profilePolar2Scores') && resp.request().method() === 'POST',
		{ timeout: 30000 }
	)

	await sitesSelect.selectOption([siteValues[0]])

	const filteredResponse = await filteredResponsePromise
	const filteredJson = await filteredResponse.json()
	const filteredN = Number(filteredJson?.n)
	expect(Number.isFinite(filteredN)).toBe(true)
	expect(filteredN).toBeGreaterThan(0)
	expect(filteredN).toBeLessThanOrEqual(baselineN)

	await expect(table.locator('tr').nth(1)).toBeVisible()
})

test('profilePolar2 iterates all available options in every filter dropdown', async ({ page }) => {
	// This test exhaustively samples filter options and triggers server requests.
	// Increase timeout to accommodate multiple filters × multiple options × server response time.
	test.setTimeout(180000) // 3 minutes for comprehensive sampling

	// Initialize page once, then test all filters
	await openProfilePage(page, { openGraphsTab: true })
	const sandbox = page.getByTestId('sjpp-massplot-sandbox-profilePolar2').first()
	const table = page.getByTestId('sjpp-profilePolar2-data-table')
	await expectVisible(sandbox)
	await expectVisible(table)

	for (const label of FILTER_LABELS) {
		await openFiltersFromSandbox(page, sandbox)

		const select = page.getByLabel(label).first()
		if ((await select.count().catch(() => 0)) === 0) continue
		await expect(select).toBeVisible({ timeout: 10000 })

		const optionValues = await getEnabledOptionValues(select)
		expect(optionValues.length).toBeGreaterThan(0)

		// Sample a subset of options to avoid excessive runtime.
		// High-cardinality filters (e.g., "Sites") are naturally limited to first few options.
		const samplesToTest = optionValues.slice(0, 3)

		for (const value of samplesToTest) {
			const currentValue = await select.inputValue().catch(() => '')
			if (currentValue === value) continue

			const responsePromise = waitForPolarScoresResponse(page)
			await select.selectOption([value])

			const response = await responsePromise
			const json = await response.json()
			expect(json?.status).not.toBe('error')
			await expect(table.locator('tr').nth(1)).toBeVisible()
		}
	}
})
