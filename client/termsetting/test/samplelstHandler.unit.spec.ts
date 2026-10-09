import tape from 'tape'
import { select } from 'd3-selection'
import { getHandler } from '../handlers/samplelst.ts'

/*
The edit menu of a samplelst term. A group of the term either lists its samples, which the menu
shows in a table to pick from, or is defined by a filter, and the menu shows its name and size.

test sections:
	- showEditMenu: each group by its shape
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
