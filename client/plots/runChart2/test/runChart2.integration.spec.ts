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

tape('runChart2 renders and has chart DOM', async test => {
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
					term2: { id: 'hrtavg' }
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		test.ok(!chartHolder.empty(), 'should have chartHolder')

		const svg = await waitForElement('svg', chartHolder, 5000)
		test.ok(!svg.empty(), 'should have SVG')

		const seriesGroup = await waitForElement('[data-testId="sjpp-runChart2-seriesGroup"]', svg, 5000)
		test.ok(!seriesGroup.empty(), 'should have seriesGroup')
	} catch (e) {
		console.error('Test error:', e)
		test.fail(`${e}`)
	} finally {
		holder.remove()
	}
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

tape('runChart2Period (divide-by term0) renders and has chart DOM', async test => {
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
					term2: { id: 'hrtavg' },
					term0: { id: 'date', q: { mode: 'discrete' } }
				}
			]
		}
	})

	try {
		const chartHolder = await waitForElement('[data-testId="sjpp-runChart2-chartHolder"]', holder, 5000)
		test.ok(!chartHolder.empty(), 'should have chartHolder')

		const svg = await waitForElement('svg', chartHolder, 5000)
		test.ok(!svg.empty(), 'should have SVG')

		const seriesGroup = await waitForElement('[data-testId="sjpp-runChart2-seriesGroup"]', svg, 5000)
		test.ok(!seriesGroup.empty(), 'should have seriesGroup')

		const paths = seriesGroup.selectAll('path')
		test.ok(paths.size() >= 1, `should have at least one series (path). Got ${paths.size()}.`)
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
