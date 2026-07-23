import tape from 'tape'
import * as d3s from 'd3-selection'
import type { JunctionTerm } from '#types'
import { publishJunction } from '../junction.broker.ts'
import { SearchHandler } from '../junction.ts'

function makeJunction(id: string): JunctionTerm {
	return {
		type: 'junction',
		id,
		name: `Name ${id}`,
		chr: 'chr1',
		start: 100,
		stop: 200,
		strand: '+',
		info: {}
	} as JunctionTerm
}

function getOpts(holder, dslabel: string, callback = (_term: any) => {}) {
	return {
		holder,
		callback,
		genomeObj: { name: 'hg38' },
		app: { vocabApi: { vocab: { dslabel } } }
	}
}

function publish(key: string, junctions: JunctionTerm[], eventlabel?: string) {
	const source = d3s.select('body').append('div')
	const button = source.append('button').node() as HTMLButtonElement
	const msgDiv = source.append('div')
	publishJunction(key, junctions, button, msgDiv, eventlabel)
	source.remove()
}

tape('\n', test => {
	test.comment('-***- termdb/handlers/junction -***-')
	test.end()
})

tape('init() shows the empty-state message', async test => {
	const holder = d3s.select('body').append('div')
	const handler = new SearchHandler()
	await handler.init(getOpts(holder, 'junction-handler-empty'))

	test.ok(holder.text().includes('Junctions selected from genome browser'), 'shows the empty-state instructions')

	handler.unsubscribe?.()
	holder.remove()
	test.end()
})

tape('ungrouped junctions render as selectable pills and can be deleted', async test => {
	const holder = d3s.select('body').append('div')
	const handler = new SearchHandler()
	let selected: any
	const dslabel = 'junction-handler-ungrouped'
	await handler.init(
		getOpts(holder, dslabel, term => {
			selected = term
		})
	)
	publish(`hg38:${dslabel}`, [makeJunction('junction-1')])

	const pill = holder.select('.ts_pill')
	test.equal(pill.text(), 'Name junction-1', 'renders the junction name in a pill')
	;(pill.node() as HTMLElement).click()
	test.equal(selected?.id, 'junction-1', 'selects the individual junction')
	;(holder.select('[data-testid="sjpp-junction-delete"]').node() as HTMLButtonElement).click()
	test.equal(holder.selectAll('.ts_pill').size(), 0, 'removes the deleted junction pill')
	test.ok(holder.text().includes('Junctions selected from genome browser'), 'restores the empty state')

	handler.unsubscribe?.()
	holder.remove()
	test.end()
})

tape('event junctions render as one pill that selects and deletes the term collection', async test => {
	const holder = d3s.select('body').append('div')
	const handler = new SearchHandler()
	let selected: any
	const dslabel = 'junction-handler-event'
	await handler.init(
		getOpts(holder, dslabel, term => {
			selected = term
		})
	)
	publish(`hg38:${dslabel}`, [makeJunction('junction-1'), makeJunction('junction-2')], 'Event A')

	const pills = holder.selectAll('.ts_pill')
	test.equal(pills.size(), 1, 'renders one pill for the event and no member junction pills')
	test.equal(pills.text(), 'Event A', 'uses the event label as the pill text')
	test.ok(holder.text().includes('junction-1'), 'lists the first junction ID')
	test.ok(holder.text().includes('junction-2'), 'lists the second junction ID')
	;(pills.node() as HTMLElement).click()
	test.equal(selected?.type, 'termCollection', 'selects a term collection')
	test.equal(selected?.memberType, 'numeric', 'creates a numeric collection')
	test.equal(selected?.name, 'Event A', 'uses the event label as the collection name')
	test.deepEqual(selected?.termIds, ['junction-1', 'junction-2'], 'includes all event junction IDs')
	test.notOk(selected?.termlst[0].eventlabel, 'does not retain broker metadata on member terms')
	test.ok(selected?.propsByTermId['junction-1'].color, 'assigns the first junction a color')
	test.ok(selected?.propsByTermId['junction-2'].color, 'assigns the second junction a color')
	test.notEqual(
		selected?.propsByTermId['junction-1'].color,
		selected?.propsByTermId['junction-2'].color,
		'assigns distinct member colors'
	)
	;(holder.select('[data-testid="sjpp-junction-delete"]').node() as HTMLButtonElement).click()
	test.equal(holder.selectAll('.ts_pill').size(), 0, 'removes the complete event choice')

	handler.unsubscribe?.()
	holder.remove()
	test.end()
})
