import * as helpers from '../../test/front.helpers.js'
import tape from 'tape'
import { sleep, detectOne, detectGte, detectLst } from '../../test/test.helpers.js'
import { runproteinpaint } from '#src/app'
import { select } from 'd3-selection'

/**
 Tests:
    - No .samples[]
    - Multiple samples
 */

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38-test',
		nav: { header_mode: 'hidden' }
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', function (test) {
	test.pass('-***- plots/sampleView -***-')
	test.end()
})

tape('No .samples[]', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleView'
				}
			]
		},
		sampleView: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(sampleView) {
		const sv = sampleView.Inner
		const plotsDiv = sv.dom.plotsDiv
		const findFirstSample = plotsDiv
			.selectAll('th')
			.nodes()
			.some(n => n.textContent === Object.keys(sv.samplesData)[0])
		test.ok(findFirstSample, 'Should render first sample when no samples are provided.')

		if (test['_ok']) sv.app.destroy()
		test.end()
	}
})
//TODO
tape('Multiple samples', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleView',
					samples: [
						{ sampleId: 3416, sampleName: '3416' },
						{ sampleId: 2646, sampleName: '2646' }
					]
				}
			]
		},
		sampleView: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(sampleView) {
		const sv = sampleView.Inner

		if (test['_ok']) sv.app.destroy()
		test.end()
	}
})
