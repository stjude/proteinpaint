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
	test.comment('-***- plots/dataDownload -***-')
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
		dataDownload.on('postRender.test', null)
		const ddDom = dataDownload.Inner.dom

		test.equal(ddDom.terms.node().querySelectorAll('.term_name_btn').length, 0, `Should render no term pills`)
		test.equal(
			ddDom.terms.node().querySelectorAll('.sja_filter_tag_btn.add_term_btn').length,
			1,
			`Should render 1 'Add variable' button`
		)
		test.equal(
			ddDom.submitNote.node().innerText,
			`no sample data`,
			`Should render "no sample data" next to Download button`
		)
		test.ok(ddDom.submitBtn.node().disabled, `Should show Download button as disabled`)

		if (test._ok) dataDownload.Inner.app.destroy()
		test.end()
	}
})

tape('Data download with terms selected', test => {
	test.timeoutAfter(2000)

	const terms = [
		{ $id: 0, id: 'sex' },
		{ $id: 1, id: 'agedx' },
		{ $id: 2, id: 'genetic_race' },
		{ $id: 3, id: 'aaclassic_5' },
		{ $id: 4, id: 'Arrhythmias' }
	]

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

	async function runTests(dataDownload) {
		dataDownload.on('postRender.test', null)
		const ddDom = dataDownload.Inner.dom

		await detectGte({
			elem: ddDom.terms.node(),
			selector: '.term_name_btn',
			count: 5
		})

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
