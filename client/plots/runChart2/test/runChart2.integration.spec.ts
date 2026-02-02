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
