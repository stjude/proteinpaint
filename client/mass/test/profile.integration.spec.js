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

function openPlot(chartType, runTests) {
	runpp({
		holder: getHolder(), //Fix for test failing because survival & summary sandboxs are not destroyed.

		state: {
			plots: [
				{
					chartType
				}
			]
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
		console.log(svg)
		test.true(svg != undefined, `Should render one svg`)
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

		test.true(self.svg != undefined, `Should render one svg`)
		if (test._ok) self.app.destroy()
		test.end()
	}
})
