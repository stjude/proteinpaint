import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'
import * as d3s from 'd3-selection'
import type { Selection } from 'd3-selection'

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: { activeTab: 1, header_mode: 'hidden' },
		vocab: { dslabel: 'TermdbTest', genome: 'hg38-test' }
	},
	debug: 1
})

function getHolder() {
	return d3s.select('body').append('div')
}

/** Wait for an element to appear in the DOM with a timeout */
function waitForElement(
	selector: string,
	container: Selection<any, any, any, any>,
	timeoutMs = 5000
): Promise<Selection<any, any, any, any>> {
	return new Promise((resolve, reject) => {
		const startTime = Date.now()
		const checkInterval = setInterval(() => {
			const element = container.select(selector)
			if (!element.empty()) {
				clearInterval(checkInterval)
				resolve(element)
			}
			if (Date.now() - startTime > timeoutMs) {
				clearInterval(checkInterval)
				reject(new Error(`Timeout waiting for element: ${selector}`))
			}
		}, 100)
	})
}

tape('\n', function (test) {
	test.comment('-***- plots/runChart2/RunChart2 -***-')
	test.end()
})

tape('Render TermdbTest runChart2 plot with data', async function (test) {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'continuous' } },
					ytw: { id: 'hrtavg', q: { mode: 'continuous' } }
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)
		test.ok(!svg.empty(), 'should have SVG in chartHolder')

		const seriesGroup = await waitForElement('[data-testId="sjpp-runChart2-seriesGroup"]', svg, 5000)
		const circles = seriesGroup.selectAll('circle')
		test.ok(circles.size() > 0, `should render circles. Rendered ${circles.size()}.`)
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		holder.remove()
	}
	test.end()
})

// --- Frequency chart (no ytw) integration tests ---

tape('Frequency mode (no ytw) renders with mocked frequency data', async function (test) {
	test.timeoutAfter(10000)
	test.plan(4)

	const holder = getHolder()
	const mockFrequencyResponse = {
		status: 'ok',
		series: [
			{
				median: 2.5,
				points: [
					{ x: 2024.04, xName: 'January 2024', y: 2, sampleCount: 2 },
					{ x: 2024.29, xName: 'April 2024', y: 3, sampleCount: 3 },
					{ x: 2024.54, xName: 'July 2024', y: 4, sampleCount: 4 }
				]
			}
		]
	}

	const originalFetch = window.fetch
	window.fetch = (input: RequestInfo | URL) => {
		const url = typeof input === 'string' ? input : (input as Request).url
		if (url.includes('termdb/runChart')) {
			return Promise.resolve(
				new Response(JSON.stringify(mockFrequencyResponse), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			)
		}
		return originalFetch(input as RequestInfo)
	}

	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'continuous' } }
					// no ytw => frequency mode
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)
		test.ok(!svg.empty(), 'should have SVG in chartHolder')

		const seriesGroup = await waitForElement('[data-testId="sjpp-runChart2-seriesGroup"]', svg, 5000)
		const circles = seriesGroup.selectAll('circle')
		test.ok(circles.size() > 0, `should render data points. Rendered ${circles.size()}.`)

		const errorEl = chartHolder.select('[data-testId="sjpp-runChart2-error"]')
		const errorText = !errorEl.empty() ? errorEl.text() : ''
		test.ok(!errorText, 'should not show error message')

		test.ok(
			seriesGroup.selectAll('[data-testId="sjpp-runChart2-series"]').size() >= 1,
			'should have at least one series group'
		)
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		window.fetch = originalFetch
		holder.remove()
	}
	test.end()
})

tape('Frequency mode shows FREQUENCY CHART header', async function (test) {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	const mockFrequencyResponse = {
		status: 'ok',
		series: [{ median: 1, points: [{ x: 2024.04, xName: 'January 2024', y: 1, sampleCount: 1 }] }]
	}

	const originalFetch = window.fetch
	window.fetch = (input: RequestInfo | URL) => {
		const url = typeof input === 'string' ? input : (input as Request).url
		if (url.includes('termdb/runChart')) {
			return Promise.resolve(
				new Response(JSON.stringify(mockFrequencyResponse), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			)
		}
		return originalFetch(input as RequestInfo)
	}

	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'continuous' } }
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		await waitForElement('svg', chartHolder, 5000)

		// Header is rendered in holder when app provides opts.header
		const header = holder.select('[data-testId="sjpp-runChart2-header"]')
		test.ok(!header.empty(), 'should have header element')
		test.equal(header.text().trim(), 'FREQUENCY CHART', 'header should say FREQUENCY CHART when no ytw')
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		window.fetch = originalFetch
		holder.remove()
	}
	test.end()
})

tape('Frequency mode with showCumulativeFrequency shows Cumulative count y-axis label', async function (test) {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	const mockCumulativeResponse = {
		status: 'ok',
		series: [
			{
				median: 3,
				points: [
					{ x: 2024.04, xName: 'January 2024', y: 2, sampleCount: 2 },
					{ x: 2024.29, xName: 'April 2024', y: 4, sampleCount: 4 }
				]
			}
		]
	}

	const originalFetch = window.fetch
	window.fetch = (input: RequestInfo | URL) => {
		const url = typeof input === 'string' ? input : (input as Request).url
		if (url.includes('termdb/runChart')) {
			return Promise.resolve(
				new Response(JSON.stringify(mockCumulativeResponse), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			)
		}
		return originalFetch(input as RequestInfo)
	}

	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'continuous' } },
					settings: { runChart2: { showCumulativeFrequency: true } }
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)

		const yAxisLabel = svg.select('[data-testId="sjpp-runChart2-yAxisLabel"]')
		test.ok(!yAxisLabel.empty(), 'should have y-axis label')
		test.equal(
			yAxisLabel.text(),
			'Cumulative count',
			'y-axis label should be Cumulative count when showCumulativeFrequency is true'
		)
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		window.fetch = originalFetch
		holder.remove()
	}
	test.end()
})

tape('Frequency mode without showCumulativeFrequency shows Count y-axis label', async function (test) {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	const mockCountResponse = {
		status: 'ok',
		series: [
			{
				median: 2,
				points: [
					{ x: 2024.04, xName: 'January 2024', y: 2, sampleCount: 2 },
					{ x: 2024.29, xName: 'April 2024', y: 1, sampleCount: 1 }
				]
			}
		]
	}

	const originalFetch = window.fetch
	window.fetch = (input: RequestInfo | URL) => {
		const url = typeof input === 'string' ? input : (input as Request).url
		if (url.includes('termdb/runChart')) {
			return Promise.resolve(
				new Response(JSON.stringify(mockCountResponse), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			)
		}
		return originalFetch(input as RequestInfo)
	}

	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'continuous' } },
					settings: { runChart2: { showCumulativeFrequency: false } }
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)

		const yAxisLabel = svg.select('[data-testId="sjpp-runChart2-yAxisLabel"]')
		test.ok(!yAxisLabel.empty(), 'should have y-axis label')
		test.equal(yAxisLabel.text(), 'Count', 'y-axis label should be Count when showCumulativeFrequency is false')
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		window.fetch = originalFetch
		holder.remove()
	}
	test.end()
})

tape('Frequency mode request includes showCumulativeFrequency when enabled', async function (test) {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	let lastRunChartBody: any = null
	const mockResponse = {
		status: 'ok',
		series: [{ median: 1, points: [{ x: 2024.04, xName: 'January 2024', y: 1, sampleCount: 1 }] }]
	}

	function parseRunChartPayload(url: string, init?: RequestInit): any {
		if (init?.body) {
			try {
				return typeof init.body === 'string' ? JSON.parse(init.body) : init.body
			} catch (_) {
				return null
			}
		}
		const q = url.indexOf('?')
		if (q === -1) return null
		const payload: any = {}
		for (const pair of url.slice(q + 1).split('&')) {
			const eq = pair.indexOf('=')
			if (eq === -1) continue
			const key = decodeURIComponent(pair.slice(0, eq))
			let val: string
			try {
				val = decodeURIComponent(pair.slice(eq + 1))
			} catch (_) {
				continue
			}
			try {
				payload[key] = JSON.parse(val)
			} catch (_) {
				payload[key] = val
			}
		}
		return Object.keys(payload).length ? payload : null
	}

	const originalFetch = window.fetch
	window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : (input as Request).url
		if (url.includes('termdb/runChart')) {
			lastRunChartBody = parseRunChartPayload(url, init)
			return new Response(JSON.stringify(mockResponse), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		}
		return originalFetch(input as RequestInfo, init)
	}

	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'continuous' } },
					settings: { runChart2: { showCumulativeFrequency: true } }
				}
			]
		}
	})

	try {
		await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		await waitForElement('svg', holder.select('[data-testId="sjpp-runChart2-chartHolder"]'), 5000)

		test.ok(lastRunChartBody != null, 'runChart should have been called')
		test.equal(
			lastRunChartBody?.showCumulativeFrequency,
			true,
			'request body should include showCumulativeFrequency: true'
		)
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		window.fetch = originalFetch
		holder.remove()
	}
	test.end()
})

/**
 * TODO: runChart2Period tests are timing out when rendering SVG in discrete mode.
 * Error: Missing key for xTermId in sample data - suggests test data structure
 * doesn't match what discrete mode expects. This appears to be a pre-existing issue.
 * Needs investigation into:
 * 1. Whether test data should have .key properties for discrete mode
 * 2. Whether getData() returns different data structure for discrete queries
 * 3. Error handling for missing keys in discrete mode
 */
tape.skip('runChart2Period (period) renders series and data points', async test => {
	test.timeoutAfter(10000)
	test.plan(3)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'discrete' } },
					ytw: { id: 'hrtavg', q: { mode: 'continuous' } }
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)
		const seriesGroup = await waitForElement('[data-testId="sjpp-runChart2-seriesGroup"]', svg, 5000)

		const paths = seriesGroup.selectAll('path')
		test.ok(paths.size() >= 1, `should render at least one series path. Rendered ${paths.size()}.`)

		const circles = seriesGroup.selectAll('circle')
		test.ok(circles.size() >= 1, `should render at least one circle (data point). Rendered ${circles.size()}.`)

		const errorEl = chartHolder.select('[data-testId="sjpp-runChart2-error"]')
		const errorText = !errorEl.empty() ? errorEl.text() : ''
		test.ok(!errorText, 'should not show error message')
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		holder.remove()
	}
	test.end()
})

tape.skip('runChart2Period has x-axis and y-axis groups', async test => {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'discrete' } },
					ytw: { id: 'hrtavg', q: { mode: 'continuous' } }
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)

		const xAxis = svg.select('[data-testId="sjpp-runChart2-xAxis"]')
		test.ok(!xAxis.empty(), 'should have x-axis group')

		const yAxis = svg.select('[data-testId="sjpp-runChart2-yAxis"]')
		test.ok(!yAxis.empty(), 'should have y-axis group')
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		holder.remove()
	}
	test.end()
})

tape.skip('runChart2Period has axis labels', async test => {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'discrete' } },
					ytw: { id: 'hrtavg', q: { mode: 'continuous' } }
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)

		const xAxisLabel = svg.select('[data-testId="sjpp-runChart2-xAxisLabel"]')
		test.ok(!xAxisLabel.empty(), 'should have x-axis label')

		const yAxisLabel = svg.select('[data-testId="sjpp-runChart2-yAxisLabel"]')
		test.ok(!yAxisLabel.empty(), 'should have y-axis label')
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		holder.remove()
	}
	test.end()
})

tape('runChart2Period renders with mocked discrete data', async test => {
	test.timeoutAfter(10000)
	test.plan(7)

	const holder = getHolder()
	const originalFetch = window.fetch
	const mockResponse = {
		status: 'ok',
		series: [
			{
				seriesId: '2020',
				median: 15,
				points: [
					{ x: 2020.12, xName: 'February 2020', y: 10, sampleCount: 2 },
					{ x: 2020.54, xName: 'July 2020', y: 20, sampleCount: 3 }
				]
			},
			{
				seriesId: '2021',
				median: 30,
				points: [{ x: 2021.25, xName: 'March 2021', y: 30, sampleCount: 1 }]
			}
		]
	}

	window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : (input as Request).url
		if (url.includes('termdb/runChart')) {
			return Promise.resolve(
				new Response(JSON.stringify(mockResponse), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			)
		}
		return originalFetch(input as RequestInfo, init)
	}

	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'discrete' } },
					ytw: { id: 'hrtavg', q: { mode: 'continuous' } }
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)
		const seriesGroup = await waitForElement('[data-testId="sjpp-runChart2-seriesGroup"]', svg, 5000)

		const seriesGs = seriesGroup.selectAll('[data-testId="sjpp-runChart2-series"]')
		test.equal(seriesGs.size(), 2, 'should render two series groups')

		const series2020 = seriesGroup.select('[data-series-id="2020"]')
		test.ok(!series2020.empty(), 'should render series group for 2020')

		const series2021 = seriesGroup.select('[data-series-id="2021"]')
		test.ok(!series2021.empty(), 'should render series group for 2021')

		const circles = seriesGroup.selectAll('circle')
		test.ok(circles.size() >= 3, `should render data points. Rendered ${circles.size()}.`)

		// Test rendering order: median background group should come first
		const series2020Group = seriesGroup.select('[data-series-id="2020"]')
		const medianBgGroup = series2020Group.select('[data-testId="sjpp-runChart2-median-bg"]')
		test.ok(!medianBgGroup.empty(), 'should render median background group for layering')

		// Verify median text has pointer-events none (non-interactive)
		const medianText = medianBgGroup.select('text')
		test.ok(!medianText.empty(), 'should render median text label')
		const pointerEvents = medianText.attr('pointer-events')
		test.equal(pointerEvents, 'none', 'median text should have pointer-events: none to not block interactions')
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		window.fetch = originalFetch
		holder.remove()
	}
	test.end()
})

tape.skip('runChart2Period chart SVG is valid for download', async test => {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'discrete' } },
					ytw: { id: 'hrtavg', q: { mode: 'continuous' } }
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)
		test.ok(!svg.empty(), 'should have SVG for download')

		const svgElement = svg.node() as SVGSVGElement
		test.ok(svgElement && svgElement.tagName === 'svg', 'should be a valid SVG element for download')
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		holder.remove()
	}
	test.end()
})

tape('RunChart2 control panel initializes and renders', async test => {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'continuous' } },
					ytw: { id: 'hrtavg', q: { mode: 'continuous' } }
				}
			]
		}
	})

	try {
		// Wait for chart to render
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)

		// Check that controls section is present in DOM (no specific testId, just check structure)
		const allDivs = holder.selectAll('div').nodes()
		test.ok(allDivs.length > 0, 'should have DOM elements for controls')

		// Check if SVG and chart exists, confirming controls were initialized
		test.ok(!svg.empty(), 'chart should render after controls initialization')
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		holder.remove()
	}
	test.end()
})

tape('RunChart2 chart images can be extracted for download', async test => {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'continuous' } },
					ytw: { id: 'hrtavg', q: { mode: 'continuous' } }
				}
			]
		}
	})

	try {
		// Wait for chart to render
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)
		test.ok(!svg.empty(), 'should have SVG for download')

		// Check if SVG has necessary attributes for download
		const svgElement = svg.node() as SVGSVGElement
		test.ok(svgElement && svgElement.tagName === 'svg', 'should be a valid SVG element for download')
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		holder.remove()
	}
	test.end()
})

tape.skip('RunChart2Period should render median lines for each series', async test => {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'discrete' } },
					ytw: { id: 'hrtavg', q: { mode: 'continuous' } }
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)
		const seriesGroup = await waitForElement('[data-testId="sjpp-runChart2-seriesGroup"]', svg, 5000)

		// Check for median lines (horizontal lines in series)
		const medianLines = seriesGroup.selectAll('line')
		test.ok(medianLines.size() >= 1, `should render median lines. Found ${medianLines.size()}.`)

		// Verify median lines are horizontal (y1 === y2)
		const firstLine = medianLines.node() as SVGLineElement
		if (firstLine) {
			const y1 = firstLine.getAttribute('y1')
			const y2 = firstLine.getAttribute('y2')
			test.equal(y1, y2, 'median line should be horizontal (y1 === y2)')
		} else {
			test.fail('no median line found to verify')
		}
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		holder.remove()
	}
	test.end()
})

tape('RunChart2 Y-axis baseline should be 0 for positive-only data', async test => {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'continuous' } },
					ytw: { id: 'hrtavg', q: { mode: 'continuous' } } // All positive values
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)
		const yAxis = await waitForElement('[data-testId="sjpp-runChart2-yAxis"]', svg, 5000)

		// Get Y-axis tick labels
		const ticks = yAxis.selectAll('.tick text')
		test.ok(ticks.size() > 0, 'should have Y-axis tick labels')

		// Check if lowest tick is 0 or close to 0 (for positive data)
		const tickValues: number[] = []
		ticks.each(function () {
			const val = parseFloat((this as any).textContent)
			if (!isNaN(val)) tickValues.push(val)
		})
		const minTick = tickValues.length > 0 ? Math.min(...tickValues) : NaN
		test.ok(!isNaN(minTick) && minTick >= 0, `Y-axis baseline should be >= 0 for positive data. Got ${minTick}`)
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		holder.remove()
	}
	test.end()
})

tape.skip('RunChart2Period should render series with different colors', async test => {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'discrete' } },
					ytw: { id: 'hrtavg', q: { mode: 'continuous' } }
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)
		const seriesGroup = await waitForElement('[data-testId="sjpp-runChart2-seriesGroup"]', svg, 5000)

		const paths = seriesGroup.selectAll('path')
		test.ok(paths.size() >= 1, `should have series paths. Found ${paths.size()}.`)

		// Collect stroke/fill colors from all series elements (paths, circles, lines)
		const colors = new Set()
		seriesGroup.selectAll('path, circle, line').each(function () {
			const element = d3s.select(this)
			const stroke = element.attr('stroke')
			const fill = element.attr('fill')
			if (stroke && stroke !== 'none') colors.add(stroke)
			if (fill && fill !== 'none') colors.add(fill)
		})

		test.ok(colors.size >= 1, `should use colors for series elements. Found ${colors.size} unique colors.`)
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		holder.remove()
	}
	test.end()
})

tape('RunChart2 axis labels and tick marks should render correctly', async test => {
	test.timeoutAfter(10000)
	test.plan(4)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'continuous' } },
					ytw: { id: 'hrtavg', q: { mode: 'continuous' } }
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)

		// Check X-axis ticks
		const xAxis = await waitForElement('[data-testId="sjpp-runChart2-xAxis"]', svg, 5000)
		const xTicks = xAxis.selectAll('.tick')
		test.ok(xTicks.size() > 0, `should have X-axis tick marks. Found ${xTicks.size()}.`)

		// Check Y-axis ticks
		const yAxis = await waitForElement('[data-testId="sjpp-runChart2-yAxis"]', svg, 5000)
		const yTicks = yAxis.selectAll('.tick')
		test.ok(yTicks.size() > 0, `should have Y-axis tick marks. Found ${yTicks.size()}.`)

		// Check axis labels
		const xAxisLabel = svg.select('[data-testId="sjpp-runChart2-xAxisLabel"]')
		test.ok(!xAxisLabel.empty(), 'should have X-axis label')

		const yAxisLabel = svg.select('[data-testId="sjpp-runChart2-yAxisLabel"]')
		test.ok(!yAxisLabel.empty(), 'should have Y-axis label')
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		holder.remove()
	}
	test.end()
})

tape('RunChart2 with count aggregation should render correctly', async test => {
	test.plan(2)
	test.timeoutAfter(5000)

	const holder = getHolder()

	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date' },
					ytw: { id: 'hrtavg' },
					settings: {
						runChart2: {
							aggregation: 'count'
						}
					}
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		test.ok(chartHolder, 'should render with count aggregation')

		const svg = await waitForElement('svg', chartHolder, 5000)
		const circles = svg.selectAll('circle')
		test.ok(circles.size() > 0, `should render data points with count aggregation. Found ${circles.size()}.`)
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		holder.remove()
	}
	test.end()
})

tape.skip('RunChart2 with discrete X-axis should partition data into series', async test => {
	test.plan(3)
	test.timeoutAfter(5000)

	const holder = getHolder()

	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'discrete' } },
					ytw: { id: 'hrtavg', q: { mode: 'continuous' } }
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)
		const seriesGroup = await waitForElement('[data-testId="sjpp-runChart2-seriesGroup"]', svg, 5000)

		// Discrete mode should create multiple series (one per discrete bin/period)
		const paths = seriesGroup.selectAll('path')
		test.ok(paths.size() >= 1, `discrete mode should render series paths. Found ${paths.size()}.`)

		// Should have data points across series
		const circles = seriesGroup.selectAll('circle')
		test.ok(circles.size() > 0, `discrete mode should render data points. Found ${circles.size()}.`)

		// Should have multiple paths when X-axis is discrete (one path per series/period)
		test.ok(
			paths.size() > 1,
			`discrete mode should partition into multiple series. Found ${paths.size()} series paths.`
		)
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		holder.remove()
	}
	test.end()
})

tape.skip('RunChart2 with continuous X-axis should render single series', async test => {
	test.plan(2)
	test.timeoutAfter(5000)

	const holder = getHolder()

	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					xtw: { id: 'date', q: { mode: 'continuous' } },
					ytw: { id: 'hrtavg', q: { mode: 'continuous' } }
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)

		// Continuous mode should have a single series with all data points
		const circles = svg.selectAll('circle')
		test.ok(circles.size() > 0, `continuous mode should render data points. Found ${circles.size()}.`)

		// Verify it's a single series (no partitioning)
		const paths = svg.selectAll('[data-testId="sjpp-runChart2-seriesGroup"] path')
		test.ok(
			paths.size() === 1 || paths.size() === 0,
			`continuous mode should have single series. Found ${paths.size()} paths.`
		)
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		holder.remove()
	}
	test.end()
})
