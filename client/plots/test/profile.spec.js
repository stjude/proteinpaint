import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import * as d3s from 'd3-selection'

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

tape('Test barchart', function (test) {
	//test.timeoutAfter(8000)
	//openPlot('profileBarchart2', runTests)

	async function runTests(plot) {
		//plot.on('postRender.test', null)

		const self = plot.Inner

		if (test._ok) self.app.destroy()
		test.end()
	}
})
