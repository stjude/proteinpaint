import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'
import * as d3s from 'd3-selection'
import { detectAttr } from '../../../test/test.helpers.js'

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: { activeTab: 1, header_mode: 'hidden' },
		vocab: { dslabel: 'TermdbTest', genome: 'hg38-test' }
	},
	debug: 1
})

const state = {
	plots: [
		{
			chartType: 'runChart2',
			term: { id: 'date' },
			term2: { id: 'hrtavg' }
		}
	]
}

function getHolder() {
	return d3s.select('body').append('div')
}

// test sections

tape('\n', function (test) {
	test.comment('-***- plots/runChart2/RunChart2 -***-')
	test.end()
})

tape('runChart2 renders and has chart DOM', test => {
	test.timeoutAfter(5000)
	test.plan(4)

	runpp({
		state: {
			plots: [
				{
					chartType: 'runChart2',
					term: { id: 'date' },
					term2: { id: 'hrtavg' }
				}
			]
		},
		runChart2: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(runChart2: any) {
		runChart2.on('postRender.test', null)

		test.ok(runChart2?.view, 'should have view')
		test.ok(runChart2?.view?.chartDom, 'should have chartDom')
		test.ok(runChart2.view.chartDom.svg, 'should have SVG')
		test.ok(runChart2.view.chartDom.xAxis && runChart2.view.chartDom.yAxis, 'should have xAxis and yAxis groups')

		test.end()
	}
})

tape('Render TermdbTest runChart2 plot', function (test) {
	test.timeoutAfter(8000)
	test.plan(2)
	const holder = getHolder()
	runpp({
		holder,
		state,
		runChart2: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(runChart2: any) {
		runChart2.on('postRender.test', null)

		const chartHolder = runChart2.dom.chartHolder
		const svg = chartHolder.select('svg')
		const seriesGroup = svg.select('[data-testId="sjpp-runChart2-seriesGroup"]')
		const circles = seriesGroup.selectAll('circle')

		const series = runChart2.view?.viewData?.series ?? []
		const expectedPoints = series.reduce((n: number, s: any) => n + (s.points?.length ?? 0), 0)

		test.ok(!svg.empty(), 'should have SVG in chartHolder')
		test.equal(
			circles.size(),
			expectedPoints,
			`should render ${expectedPoints} circles (one per point). Rendered ${circles.size()}.`
		)

		if ((test as any)._ok) holder.remove()
		test.end()
	}
})

tape('Change chart width and height from menu', function (test) {
	test.timeoutAfter(8000)

	const holder = getHolder()
	const testWidth = 900
	const testHeight = 450

	runpp({
		holder,
		state,
		runChart2: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(runChart2: any) {
		runChart2.on('postRender.test', null)

		const settings = runChart2.state?.config?.settings?.runChart2
		if (!settings) {
			test.fail('missing runChart2 settings')
			test.end()
			return
		}

		const inputs = runChart2.dom.controls.selectAll('input').nodes() as HTMLInputElement[]
		const widthInput = inputs.find(e => e.value === String(settings.svgw))
		const heightInput = inputs.find(e => e.value === String(settings.svgh))

		if (!widthInput || !heightInput) {
			test.fail('could not find width/height inputs')
			if ((test as any)._ok) holder.remove()
			test.end()
			return
		}

		widthInput.value = String(testWidth)
		heightInput.value = String(testHeight)

		await detectAttr({
			target: runChart2.dom.chartHolder.select('svg').node(),
			observe: { attributeFilter: ['width', 'height'] },
			trigger() {
				widthInput.dispatchEvent(new Event('change'))
				heightInput.dispatchEvent(new Event('change'))
			}
		})

		const updated = runChart2.state?.config?.settings?.runChart2
		test.equal(updated?.svgw, testWidth, `chart width should be ${testWidth}`)
		test.equal(updated?.svgh, testHeight, `chart height should be ${testHeight}`)

		if ((test as any)._ok) holder.remove()
		test.end()
	}
})
