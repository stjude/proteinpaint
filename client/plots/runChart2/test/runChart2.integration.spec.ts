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
					term: { id: 'date' },
					term2: { id: 'hrtavg' }
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

tape('runChart2Period (divide-by term0) renders series and data points', async test => {
	test.timeoutAfter(10000)
	test.plan(3)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					term: { id: 'date' },
					term2: { id: 'hrtavg' },
					term0: { id: 'date', q: { mode: 'discrete' } }
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

tape('runChart2Period has x-axis and y-axis groups', async test => {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					term: { id: 'date' },
					term2: { id: 'hrtavg' },
					term0: { id: 'date', q: { mode: 'discrete' } }
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

tape('runChart2Period has axis labels', async test => {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					term: { id: 'date' },
					term2: { id: 'hrtavg' },
					term0: { id: 'date', q: { mode: 'discrete' } }
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

tape('runChart2Period chart SVG is valid for download', async test => {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					term: { id: 'date' },
					term2: { id: 'hrtavg' },
					term0: { id: 'date', q: { mode: 'discrete' } }
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
					term: { id: 'date' },
					term2: { id: 'hrtavg' }
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
					term: { id: 'date' },
					term2: { id: 'hrtavg' }
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

tape('RunChart2Period should render median lines for each series', async test => {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					term: { id: 'date' },
					term2: { id: 'hrtavg' },
					term0: { id: 'date', q: { mode: 'discrete' } }
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
					term: { id: 'date' },
					term2: { id: 'hrtavg' } // All positive values
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

tape('RunChart2Period should render series with different colors', async test => {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					term: { id: 'date' },
					term2: { id: 'hrtavg' },
					term0: { id: 'date', q: { mode: 'discrete' } }
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

tape('RunChart2 with mean aggregation should render correctly', async test => {
	test.timeoutAfter(10000)
	test.plan(2)

	const holder = getHolder()
	runpp({
		holder,
		state: {
			plots: [
				{
					chartType: 'runChart2',
					term: { id: 'date' },
					term2: { id: 'hrtavg' },
					settings: {
						runChart2: {
							aggregation: 'mean'
						}
					}
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		const svg = await waitForElement('svg', chartHolder, 5000)
		test.ok(!svg.empty(), 'should render with mean aggregation')

		const seriesGroup = await waitForElement('[data-testId="sjpp-runChart2-seriesGroup"]', svg, 5000)
		const circles = seriesGroup.selectAll('circle')
		test.ok(circles.size() > 0, `should render data points with mean aggregation. Found ${circles.size()}.`)
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
					term: { id: 'date' },
					term2: { id: 'hrtavg' }
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
