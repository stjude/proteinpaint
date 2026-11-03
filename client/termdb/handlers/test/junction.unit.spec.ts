import tape from 'tape'
import * as d3s from 'd3-selection'
import type { JunctionTerm } from '#types'
import { SearchHandler } from '../junction.ts'
import { makeJunctionCustomTerm } from '../junction.customTerm.ts'

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

function getOpts(
	holder,
	dslabel: string,
	customTerms: any[] = [],
	callback = (_term: any) => {},
	termCollectionSelectionMode?: 'fraction'
) {
	const state = { customTerms }
	return {
		holder,
		callback,
		termCollectionSelectionMode,
		genomeObj: { name: 'hg38' },
		app: {
			vocabApi: {
				vocab: { dslabel },
				state,
				async deleteCustomTermById(id: string) {
					const index = state.customTerms.findIndex(term => term.id === id)
					if (index !== -1) state.customTerms.splice(index, 1)
				}
			}
		}
	}
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

	holder.remove()
	test.end()
})

tape('ungrouped junctions render as selectable pills and can be deleted', async test => {
	const holder = d3s.select('body').append('div')
	const handler = new SearchHandler()
	let selected: any
	const dslabel = 'junction-handler-ungrouped'
	const customTerms = [makeJunctionCustomTerm([makeJunction('junction-1')])]
	await handler.init(
		getOpts(holder, dslabel, customTerms, term => {
			selected = term
		})
	)

	const pill = holder.select('.ts_pill')
	test.equal(pill.text(), 'Name junction-1', 'renders the junction name in a pill')
	;(pill.node() as HTMLElement).click()
	test.equal(selected?.id, 'junction-1', 'selects the individual junction')
	;(holder.select('[data-testid="sjpp-junction-delete"]').node() as HTMLButtonElement).click()
	await new Promise(resolve => setTimeout(resolve, 0))
	test.equal(holder.selectAll('.ts_pill').size(), 0, 'removes the deleted junction pill')
	test.ok(holder.text().includes('Junctions selected from genome browser'), 'restores the empty state')

	holder.remove()
	test.end()
})

tape('event junctions render as one pill that selects and deletes the term collection', async test => {
	const holder = d3s.select('body').append('div')
	const handler = new SearchHandler()
	let selected: any
	const dslabel = 'junction-handler-event'
	const customTerms = [makeJunctionCustomTerm([makeJunction('junction-1'), makeJunction('junction-2')], 'Event A')]
	await handler.init(
		getOpts(holder, dslabel, customTerms, term => {
			selected = term
		})
	)

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
	test.ok(selected?.propsByTermId['junction-1'].color, 'assigns the first junction a color')
	test.ok(selected?.propsByTermId['junction-2'].color, 'assigns the second junction a color')
	test.notEqual(
		selected?.propsByTermId['junction-1'].color,
		selected?.propsByTermId['junction-2'].color,
		'assigns distinct member colors'
	)
	;(holder.select('[data-testid="sjpp-junction-delete"]').node() as HTMLButtonElement).click()
	await new Promise(resolve => setTimeout(resolve, 0))
	test.equal(holder.selectAll('.ts_pill').size(), 0, 'removes the complete event choice')

	holder.remove()
	test.end()
})

tape('init() only shows state-backed junction custom terms', async test => {
	const holder = d3s.select('body').append('div')
	const handler = new SearchHandler()
	const customTerms = [
		makeJunctionCustomTerm([makeJunction('active-junction')]),
		{ id: 'other-custom-term', name: 'Other', tw: { term: { type: 'float', id: 'other', name: 'Other' } } }
	]

	await handler.init(getOpts(holder, 'active', customTerms))

	test.equal(holder.selectAll('.ts_pill').size(), 1, 'renders only one matching junction term')
	test.equal(holder.select('.ts_pill').text(), 'Name active-junction', 'renders the state-backed junction')

	holder.remove()
	test.end()
})

tape('event junction renders fraction choices when requested', async test => {
	const holder = d3s.select('body').append('div')
	const handler = new SearchHandler()
	let selected: any
	const customTerms = [makeJunctionCustomTerm([makeJunction('junction-1'), makeJunction('junction-2')], 'Event A')]
	await handler.init(
		getOpts(
			holder,
			'junction-handler-fraction',
			customTerms,
			term => {
				selected = term
			},
			'fraction'
		)
	)
	;(holder.select('.ts_pill').node() as HTMLElement).click()
	test.ok(holder.text().includes('Denominator'), 'renders denominator choices for the event collection')
	;(holder.select('[data-testid="sjpp-term-collection-fraction-select"]').node() as HTMLButtonElement).click()
	test.equal(selected?.type, 'TermCollectionTWFraction', 'returns a fraction wrapper')
	test.deepEqual(selected?.q.denominators, ['junction-1', 'junction-2'], 'defaults both junctions as denominators')
	test.deepEqual(selected?.q.numerators, ['junction-1'], 'defaults only the first junction as numerator')
	test.equal(selected?.term.termlst.length, 2, 'retains both junction members')

	holder.remove()
	test.end()
})

tape('the sample type row sets the chosen sample types on the picked junction and event', async test => {
	const holder = d3s.select('body').append('div')
	const handler = new SearchHandler()
	let selected: any
	const customTerms = [
		makeJunctionCustomTerm([makeJunction('junction-1')]),
		makeJunctionCustomTerm([makeJunction('junction-2'), makeJunction('junction-3')], 'Event A')
	]
	const opts: any = getOpts(holder, 'junction-handler-sampletypes', customTerms, term => {
		selected = term
	})
	opts.app.vocabApi.termdbConfig = {
		queries: { junction: { sampleTypes: [2, 3] } },
		sampleTypes: {
			1: { name: 'patient', plural_name: 'patients', parent_id: null },
			2: { name: 'diagnosis sample', plural_name: 'diagnosis samples', parent_id: 1 },
			3: { name: 'relapse sample', plural_name: 'relapse samples', parent_id: 1 }
		}
	}
	await handler.init(opts)

	const pills = () => holder.selectAll('.ts_pill').nodes() as HTMLElement[]
	const boxes = () => holder.selectAll('input[type=checkbox]').nodes() as HTMLInputElement[]
	test.equal(boxes().length, 2, 'renders a checkbox for each sample type of the junction file')

	pills()[0].click()
	test.equal(selected.name, 'Name junction-1', 'keeps the name when every sample type is checked')
	test.notOk('sampleTypes' in selected, 'reads every sample, as before the selector, when every type is checked')

	boxes()[1].click()
	pills()[0].click()
	test.deepEqual(selected.sampleTypes, [2], 'sets the checked sample types on the junction term')
	test.equal(selected.name, 'Name junction-1 (diagnosis samples)', 'names the sample types')
	test.equal(selected.id, 'junction-1', 'keeps the junction id')
	test.notOk(customTerms[0].tw.term.sampleTypes, 'leaves the stored custom term unchanged')

	pills()[1].click()
	test.deepEqual(selected.sampleTypes, [2], 'sets the sample types on the event collection')
	test.ok(
		selected.termlst.every(m => m.sampleTypes?.[0] == 2),
		'sets them on each member junction, which the server reads on its own'
	)

	// a delete draws the list again, which must keep the choice and not apply the sample types twice
	;(holder.select('[data-testid="sjpp-junction-delete"]').node() as HTMLButtonElement).click()
	await new Promise(resolve => setTimeout(resolve, 0))
	test.equal(boxes()[1].checked, false, 'keeps the sample type choice after a delete')
	pills()[0].click()
	test.equal(selected.name, 'Event A (diagnosis samples)', 'names the sample types once after the list is redrawn')

	if (test['_ok']) holder.remove()
	test.end()
})
