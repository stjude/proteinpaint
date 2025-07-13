import tape from 'tape'
//import { copyMerge } from '#rx/index.js'
import { groupsInit } from '../groups'
import { select } from 'd3-selection'
import * as helpers from '../../test/front.helpers.js'
import { sleep, detectLst, detectGte, detectOne } from '../../test/test.helpers.js'
import { getFilterItemByTag } from '#filter'

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38-test'
	},
	debug: 1
})
async function addDemographicSexFilter(btn, groups) {
	btn.click()
	await sleep(500)

	const tipd = groups.filterPrompt.Inner.dom.treeTip.d.node()
	const termdiv1 = await detectGte({ elem: tipd, selector: '.termdiv', count: 1 })
	const demoPill = termdiv1.find(elem => elem.__data__.id === 'Demographic Variables')
	demoPill.querySelectorAll('.termbtn')[0].click()

	const termdivSex = await detectLst({ elem: tipd, selector: '.termdiv', count: 6, matchAs: '>=' })
	const sexPill = termdivSex.find(elem => elem.__data__.id === 'sex')
	sexPill.querySelectorAll('.termlabel')[0].click()
	const detectSelect = await detectLst({ elem: tipd, selector: "input[type='checkbox']", count: 1, matchAs: '>=' })
	detectSelect[0].click()
	const applyBtn = await detectOne({ elem: tipd, selector: '.sjpp_apply_btn' })
	applyBtn.click()
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- mass/groups -***-')
	test.end()
})

tape('add a new group', test => {
	test.timeoutAfter(1000)
	test.plan(1)
	//const {app, holder, groups} = await getGroups(); console.log(groups)

	runpp({
		state: {
			nav: {
				activeTab: 2
			}
		},
		groups: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(groupsApi) {
		groupsApi.on('postRender.test', null)
		const groups = groupsApi.Inner
		const tipd = groups.dom.filterTableDiv.node()
		await addDemographicSexFilter(groups.dom.holder.node().querySelector('.sja_new_filter_btn'), groups)
		await sleep(1)
		const groupsState = groups.app.getState().groups
		const filterUiRoot = getFilterItemByTag(groupsState[0]?.filter, 'filterUiRoot')
		test.equal(
			filterUiRoot?.lst.find(f => f.tvs?.term?.id == 'sex')?.tvs?.term?.id,
			'sex',
			`should have 1 matching entry after adding a group`
		)

		// TODO: test that the groups UI reacts to cohort changes,
		// sample count and tree terms should change when changing cohort

		if (test._ok) {
			await sleep(50)
			groups.app.destroy()
		}
		test.end()
	}
})
