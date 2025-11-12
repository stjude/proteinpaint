import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
//import { sleep, detectLst, detectGte, detectOne } from '../../test/test.helpers.js'
//import * as d3s from 'd3-selection'

/*
test sections
*/

tape('\n', function (test) {
	test.comment('-***- plots/summaryInput -***-')
	test.end()
})

tape('test', function (test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summaryInput',
					term: { id: 'diaggrp' }
				}
			]
		},
		summaryInput: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(chart) {
		chart.on('postRender.test', null)
		/*const controlRows = chart.Inner.dom.controls.selectAll('tr')
        const t1row = controlRows.filter((_, i) => i === 0)
        const t1btn = await detectOne({ elem: t1row.node(), selector: '.sja_filter_tag_btn.add_term_btn' })
        //const t1btn = t1row.select('.sja_filter_tag_btn add_term_btn').node()
        t1btn.click()
        await sleep(300)
        const termDivs = d3s.select('body').selectAll('.termdiv')
        const parentTermDiv = termDivs.filter(d => d.name === 'Cancer-related Variables')
        parentTermDiv.select('div[data-testid="sjpp_termdbbutton"]').node().click()
        await sleep(300)
        const childDiv = parentTermDiv.select('.termchilddiv')
        const childTermDiv = childDiv.select('.termdiv')
        childTermDiv.select('div[data-testid="sjpp_termdbbutton"]').node().click()
        await sleep(300)
        // FIXME: branches are getting duplicated upon clicking. See "client/termdb/test/tree.integration.spec.js" for how to navigate through termdb tree.*/
		//if (test._ok) chart.Inner.app.destroy()
		test.end()
	}
})

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: {
			activeTab: 1
		},
		vocab: {
			dslabel: 'TermdbTest',
			genome: 'hg38-test'
		}
	},
	debug: 1
})
