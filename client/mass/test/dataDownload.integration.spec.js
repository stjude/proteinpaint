import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { select, selectAll } from 'd3-selection'
import { detectOne, detectGte } from '../../test/test.helpers.js'

/* 
Tests:
    Data download with no selected terms
    Data download with terms selected
*/

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: {
			header_mode: 'hide_search',
			activeTab: 1
		},
		vocab: {
			dslabel: 'TermdbTest',
			genome: 'hg38-test'
		}
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- plots/dataDownload -***-')
	test.end()
})

tape('Data download with no selected terms', test => {
	test.timeoutAfter(1000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'dataDownload'
				}
			]
		},
		dataDownload: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(dataDownload) {
		const ddDom = dataDownload.Inner.dom
		test.equal(ddDom.terms.node().querySelectorAll('.term_name_btn').length, 0, `Should render no term pills`)
		test.equal(
			ddDom.submitNote.node().innerText,
			`no sample data`,
			`Should render "no sample data" next to Download button`
		)

		if (test._ok) dataDownload.Inner.app.destroy()
		test.end()
	}
})

tape('Data download with terms selected', test => {
	test.timeoutAfter(1000)

	const terms = [{ id: 'sex' }, { id: 'agedx' }, { id: 'genetic_race' }, { id: 'aaclassic_5' }, { id: 'Arrhythmias' }]

	runpp({
		state: {
			plots: [
				{
					chartType: 'dataDownload',
					terms
				}
			]
		},
		dataDownload: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(dataDownload) {
		const ddDom = dataDownload.Inner.dom
		test.equal(
			ddDom.terms.node().querySelectorAll('.term_name_btn').length,
			terms.length,
			`Should render ${terms.length} term pills`
		)
		test.equal(
			ddDom.submitNote.node().innerText,
			`${dataDownload.Inner.activeSamples.length} samples`,
			`Should render "${dataDownload.Inner.activeSamples.length} samples" next to Download button`
		)

		if (test._ok) dataDownload.Inner.app.destroy()
		test.end()
	}
})
