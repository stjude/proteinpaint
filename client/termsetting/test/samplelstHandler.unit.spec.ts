import tape from 'tape'
import { select } from 'd3-selection'
import { getHandler, fillTW } from '../handlers/samplelst.ts'

/*
The edit menu of a samplelst term. A group of the term either lists its samples, which the menu
shows in a table to pick from, or is defined by a filter, and the menu shows its name and size.

test sections:
	- showEditMenu: each group by its shape
	- fillTW: groups of the custom variable
*/

tape('\n', test => {
	test.comment('-***- termsetting/handlers/samplelst -***-')
	test.end()
})

function showMenu(groups: any[]) {
	let applied = 0
	const self: any = {
		q: { groups },
		vocabApi: { termdbConfig: { displaySampleIds: true }, hasVerifiedToken: () => true },
		api: { runCallback: () => applied++ }
	}
	const holder = select(document.body).append('div')
	getHandler(self).showEditMenu(holder)
	return { holder, apply: holder.select('[data-testid="sjpp-ts-samplelst-apply"]'), applied: () => applied }
}

tape('showEditMenu: each group by its shape', test => {
	const listed = () => ({
		name: 'Listed',
		in: true,
		values: [
			{ sampleId: 1, sample: 's1' },
			{ sampleId: 2, sample: 's2' }
		]
	})
	const byFilter = () => ({
		name: 'ByFilter',
		in: true,
		filter: { type: 'tvslst', in: true, join: '', lst: [] },
		sampleCount: 7
	})

	const mixed = showMenu([listed(), byFilter()])
	test.ok(mixed.holder.text().includes('ByFilter, n=7'), 'should show the name and size of a group defined by a filter')
	test.ok(mixed.holder.text().includes('Listed'), 'should show a group that lists its samples in the same menu')
	test.equal(mixed.apply.size(), 1, 'should offer Apply for the group that lists its samples')
	const applyButton = mixed.apply.node() as HTMLElement
	applyButton.click()
	test.equal(mixed.applied(), 1, 'should apply without an error from the group that lists no sample')
	mixed.holder.remove()

	const filters = showMenu([byFilter()])
	test.ok(filters.holder.text().includes('ByFilter, n=7'), 'should show a term of filter groups only')
	test.equal(filters.apply.size(), 0, 'should offer no Apply when no group lists its samples')
	filters.holder.remove()

	const lists = showMenu([listed()])
	test.equal(lists.apply.size(), 1, 'should offer Apply for a term of listed groups only')
	lists.holder.remove()
	test.end()
})

tape('fillTW: groups of the custom variable', async test => {
	const byFilter = {
		name: 'ByFilter',
		in: true,
		filter: { type: 'tvslst', in: true, join: '', lst: [] },
		sampleCount: 7
	}
	const customTw: any = {
		term: { name: 'Custom', type: 'samplelst', values: { ByFilter: { key: 'ByFilter', label: 'ByFilter' } } },
		q: { groups: [byFilter] }
	}
	const vocabApi: any = { getCustomTerms: async () => [customTw] }
	// as a tree gives the term of a custom variable, without its tw
	const termOnly = (): any => ({ term: structuredClone(customTw.term), q: {} })

	const tw = termOnly()
	await fillTW(tw, vocabApi)
	test.deepEqual(tw.q.groups, [byFilter], 'should get the groups defined by filters from the custom variable')
	test.notEqual(tw.q.groups[0], byFilter, 'should copy the groups, not share them with the custom variable')

	const other = termOnly()
	other.term.name = 'Other'
	await fillTW(other, vocabApi)
	test.equal(other.q.groups[0].values, undefined, 'should not use the groups of a custom variable with another name')

	const listed: any = {
		term: {
			name: 'Custom',
			type: 'samplelst',
			values: { Listed: { key: 'Listed', label: 'Listed', list: [{ sampleId: 1, sample: 's1' }] } }
		},
		q: {}
	}
	await fillTW(listed, vocabApi)
	test.deepEqual(
		listed.q.groups.map(g => [g.name, g.values]),
		[['Listed', [{ sampleId: 1, sample: 's1' }]]],
		'should build the groups from a term whose values list their samples'
	)
	test.end()
})
