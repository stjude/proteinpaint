import * as helpers from '../../../test/front.helpers.js'
import tape from 'tape'

/**************
Tests:
	- Render wsiviewer as chartType

***************/

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		dslabel: 'nintendoPublic',
		genome: 'mm10'
	},
	debug: 1
})

tape.skip('\n', function (test) {
	test.comment('-***- plots/wsiviewer/wsiviewer -***-')
	test.end()
})

//Data not available to run in Termdb test (i.e. CI)
//Run locally
tape.skip('Render wsiviewer as chartType', function (test) {
	test.timeoutAfter(5000)

	runpp({
		state: {
			dslabel: 'nintendoPublic',
			genome: 'mm10',
			nav: { header_mode: 'hidden' },
			sample_id: 'B-T87L964D',
			plots: [
				{
					chartType: 'WSIViewer',
					subfolder: 'wsiviewer',
					extension: 'ts'
				}
			]
		},
		WSIViewer: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(WSIViewer) {
		const wsiviewer = WSIViewer.Inner
		const holder = wsiviewer.opts.holder
		test.ok(holder.select('#wsi-viewer').node(), 'Should render wsi viewer')
		test.end()
	}
})
