import tape from 'tape'
//import { copyMerge } from '#rx/index.js'
import { groupsInit, maxGroupsPerVariable } from '../groups'
import { select } from 'd3-selection'
import * as helpers from '../../test/front.helpers.js'
import { sleep, detectLst, detectGte, detectOne } from '../../test/test.helpers.js'
import { getFilterItemByTag, filterJoin } from '#filter'
import { fillTermWrapper } from '#termsetting'

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
	const applyBtn = await detectOne({ elem: tipd, selector: '[data-testid="sjpp-tvs-apply"]' })
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

tape('a variable made from groups is defined by their filters', test => {
	test.timeoutAfter(20000)

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

	const tvslst = (id, key) => ({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [{ type: 'tvs', tvs: { term: { id, type: 'categorical' }, values: [{ key }] } }]
	})
	const male = { name: 'male', filter: tvslst('sex', '1') }
	const female = { name: 'female', filter: tvslst('sex', '2') }
	const all = { name: 'ALL', filter: tvslst('diaggrp', 'Acute lymphoblastic leukemia') }

	async function runTests(groupsApi) {
		groupsApi.on('postRender.test', null)
		const groups = groupsApi.Inner
		const vocabApi = groups.app.vocabApi
		// a group is its filter and the filter of the app, as the variable is made with
		const count = async filter =>
			Number.parseInt(await vocabApi.getFilteredSampleCount(filterJoin([filter, groups.state.termfilter.filter])))
		const sum = tw => tw.q.groups.reduce((n, g) => n + g.sampleCount, 0)

		// a variable is made without asking for the samples of a group
		const getFilteredSampleList = vocabApi.getFilteredSampleList
		let listRequests = 0
		vocabApi.getFilteredSampleList = function (...args) {
			listRequests++
			return getFilteredSampleList.apply(this, args)
		}
		const confirm = window.confirm
		let confirms = 0
		window.confirm = () => {
			confirms++
			return true
		}

		try {
			// two groups that share no sample
			let tw = await groups.groups2samplelst([male, female])
			test.deepEqual(
				tw.q.groups.map(g => g.name),
				['male', 'female'],
				'should make one group per selected group'
			)
			test.ok(
				tw.q.groups.every(g => g.filter && !('values' in g) && g.sampleCount > 0) &&
					Object.values(tw.term.values).every(v => !('list' in v)),
				'should define each group by a filter, with its number of samples, and list no sample'
			)
			test.equal(confirms, 0, 'should not report an overlap for two groups that share no sample')

			// the server takes the variable, and gives every group its samples
			await fillTermWrapper(tw, vocabApi)
			const data = await vocabApi.getAnnotatedSampleData({ terms: [tw] })
			const keys = new Set(data.lst.map(s => s[tw.$id]?.key))
			test.ok(keys.has('male') && keys.has('female'), 'should get samples of both groups from the server')

			// one group, and the rest of the samples
			tw = await groups.groups2samplelst([male])
			test.deepEqual(
				tw.q.groups.map(g => g.name),
				['male', 'Not in male'],
				'should add the group of the other samples to a single group'
			)
			test.equal(
				sum(tw),
				(await count(male.filter)) + (await count(female.filter)),
				'should count the other samples as those that are not in the group'
			)

			// two groups that share samples
			tw = await groups.groups2samplelst([male, all])
			test.equal(confirms, 1, 'should report the overlap of two groups that share samples')
			test.deepEqual(
				tw.q.groups.map(g => g.name),
				['male', 'ALL', 'Group overlap'],
				'should add a group of the samples that are in both'
			)
			const either = { type: 'tvslst', in: true, join: 'or', lst: [male.filter, all.filter] }
			test.equal(sum(tw), await count(either), 'should have each sample of the two groups in one group only')
			test.ok(
				tw.q.groups[2].sampleCount > 0 &&
					tw.q.groups[2].sampleCount == (await count(filterJoin([male.filter, all.filter]))),
				'should put the samples that are in both groups in the added group'
			)

			test.equal(listRequests, 0, 'should not request the list of samples of any group')

			try {
				await groups.groups2samplelst(Array.from({ length: maxGroupsPerVariable + 1 }, () => male))
				test.fail('should refuse more groups than a variable is made from')
			} catch (e) {
				test.match(String(e), /up to \d+ groups/, 'should refuse more groups than a variable is made from')
			}
		} catch (e) {
			test.fail(String(e?.message || e))
		} finally {
			vocabApi.getFilteredSampleList = getFilteredSampleList
			window.confirm = confirm
		}

		if (test._ok) {
			await sleep(50)
			groups.app.destroy()
		}
		test.end()
	}
})
