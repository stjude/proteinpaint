import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import * as d3color from 'd3-color'
import * as d3s from 'd3-selection'
import {
	detectLst,
	detectStyle,
	detectAttr,
	detectChildAttr,
	detectChildStyle,
	detectGte,
	detectOne
} from '../../test/test.helpers.js'

const runpp = helpers.getRunPp('mass', {
	state: {
		vocab: {
			dslabel: 'ProfileFull',
			genome: 'hg38'
		}
	},
	debug: 1
})

function getHolder() {
	return d3s.select('body').append('div')
}

function openRadarPlot(chartType, plot, runTests) {
	runpp({
		holder: getHolder(), //Fix for test failing because survival & summary sandboxs are not destroyed.

		state: {
			plots: [{ chartType, plot }]
		},
		[chartType]: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
}

function openPlot(chartType, runTests) {
	runpp({
		holder: getHolder(), //Fix for test failing because survival & summary sandboxs are not destroyed.

		state: {
			plots: [{ chartType }]
		},
		[chartType]: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
}
/**************
 test sections
***************/
tape('\n', function (test) {
	test.pass('-***- plots/profile -***-')
	test.end()
})

tape('Test polar', function (test) {
	test.timeoutAfter(8000)
	openPlot('profilePolar', runTests)

	async function runTests(plot) {
		console.log(plot)
		//plot.on('postRender.test', null)

		const self = plot.Inner
		const svg = self.dom.plotDiv.select('svg')
		const tableDiv = self.dom.tableDiv
		console.log(svg)
		test.true(!svg.empty(), `Should render one svg`)
		test.true(svg.selectAll('path').size() > 0, `Should render several slices`)
		test.true(!tableDiv.select('table').empty(), `Should have a table`)

		if (test._ok) self.app.destroy()
		test.end()
	}
})

tape('Test barchart', function (test) {
	test.timeoutAfter(8000)
	openPlot('profilePolar', runTests)

	async function runTests(plot) {
		//plot.on('postRender.test', null)

		const self = plot.Inner
		const svg = self.dom.plotDiv.select('svg')
		test.true(!svg.empty(), `Should render one svg`)
		test.true(svg.selectAll('g > g > path').size() > 10, `Should render several rects`)

		if (test._ok) self.app.destroy()
		test.end()
	}
})

tape('Test radar POC vs SC', function (test) {
	test.timeoutAfter(8000)
	openRadarPlot('profileRadar', 'plot1', runTests)

	async function runTests(plot) {
		//plot.on('postRender.test', null)

		const self = plot.Inner
		const svg = self.dom.plotDiv.select('svg')
		test.true(!svg.empty(), `Should render one svg`)
		console.log(svg.selectAll('circle'))
		test.true(svg.selectAll('circle').size() > 0, `Should render several dots`)

		if (test._ok) self.app.destroy()
		test.end()
	}
})
