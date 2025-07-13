import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import * as d3color from 'd3-color'
import * as d3s from 'd3-selection'
import { detectLst } from '../../test/test.helpers.js'

const runpp = helpers.getRunPp('mass', {
	state: {
		vocab: {
			dslabel: 'profile',
			genome: 'hg38'
		}
	},
	debug: 1
})

function getHolder() {
	return d3s.select('body').append('div')
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- plots/profile -***-')
	test.end()
})

tape('Test polar', function (test) {
	//test.timeoutAfter(8000)
	//openPlot('profilePolar', runTests)

	async function runTests(plot) {
		if (test._ok) self.app.destroy()
		test.end()
	}
})

tape('Test barchart', function (test) {
	//test.timeoutAfter(8000)
	//openPlot('profilePolar', runTests)

	async function runTests(plot) {
		//plot.on('postRender.test', null)

		const self = plot.Inner

		if (test._ok) self.app.destroy()
		test.end()
	}
})

// tape('Test radar POC vs SC', function (test) {
// 	test.timeoutAfter(8000)
// 	openRadarPlot('profileRadar', runTests)

// 	async function runTests(plot) {
// 		plot.on('postRender.test', null)

// 		const self = plot.Inner
// 		const svg = self.dom.plotDiv.select('svg')
// 		test.true(!svg.empty(), `Should render one svg`)
// 		test.true(svg.selectAll('circle').size() > 0, `Should render several dots`)
// 		const matched = await detectLst({
// 			target: self.dom.plotDiv.node(),
// 			selector: 'circle',

// 			trigger() {
// 				self.app.dispatch({ type: 'plot_edit', id: self.id, config: { settings: { country: 'Mexico' } } })
// 			},
// 			matcher(mutations) {
// 				return mutations
// 			}
// 		})
// 		const dot = matched.find(m => m.target.__data__.module == 'National Context' && m.target.__data__.percentage == 57)
// 		test.true(dot != null, `Should find a dot for National Context with percentage 58`)

// 		if (test._ok) self.app.destroy()
// 		test.end()
// 	}
// })
