import tape from 'tape'
import * as d3s from 'd3-selection'
import { mayRenderFractionSelection } from '../termCollectionFractionSelection.ts'

/*************************
 reusable helper functions
**************************/

function getDivs() {
	const holder = d3s.select('body').append('div')
	return { holder, listDiv: holder.append('div'), fractionDiv: holder.append('div').style('display', 'none') }
}

function getCollectionTerm(overrides: any = {}) {
	return {
		type: 'termCollection',
		isCustom: true,
		memberType: 'numeric',
		name: 'Splice junction event',
		termlst: [
			{ id: 'junction-1', name: 'junction-1' },
			{ id: 'junction-2', name: 'junction-2' }
		],
		...overrides
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/handlers/termCollectionFractionSelection -***-')
	test.end()
})

tape('mayRenderFractionSelection() renders the chooser for a numeric collection', test => {
	const { holder, listDiv, fractionDiv } = getDivs()
	let selected: any
	const term = getCollectionTerm()

	const isStaged = mayRenderFractionSelection({
		term,
		selectionMode: 'fraction',
		listDiv,
		fractionDiv,
		callback: tw => (selected = tw)
	})

	test.equal(isStaged, true, 'defers the selection to the chooser')
	test.equal(listDiv.style('display'), 'none', 'hides the term list')
	test.ok(fractionDiv.text().includes('Denominator'), 'renders the denominator selector')
	test.ok(fractionDiv.text().includes('Numerator'), 'renders the numerator selector')
	;(fractionDiv.select('[data-testid="sjpp-term-collection-fraction-select"]').node() as HTMLButtonElement).click()
	test.equal(selected?.type, 'TermCollectionTWFraction', 'submits a fraction wrapper')
	test.deepEqual(selected?.q.denominators, ['junction-1', 'junction-2'], 'defaults all members as denominators')
	test.deepEqual(selected?.q.numerators, ['junction-1'], 'defaults only the first member as numerator')
	test.equal(selected?.term, term, 'wraps the clicked term as is')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('mayRenderFractionSelection() back button restores the term list', test => {
	const { holder, listDiv, fractionDiv } = getDivs()
	mayRenderFractionSelection({
		term: getCollectionTerm(),
		selectionMode: 'fraction',
		listDiv,
		fractionDiv,
		callback: () => {}
	})
	;(fractionDiv.select('[data-testid="sjpp-term-collection-fraction-back"]').node() as HTMLButtonElement).click()

	test.notEqual(listDiv.style('display'), 'none', 'shows the term list again')
	test.equal(fractionDiv.style('display'), 'none', 'hides the chooser')
	test.equal(fractionDiv.selectAll('*').size(), 0, 'clears the chooser')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('mayRenderFractionSelection() skips terms that do not require a fraction', test => {
	const cases = [
		{ label: 'no fraction selection mode', selectionMode: undefined, term: getCollectionTerm() },
		{
			label: 'categorical collection',
			selectionMode: 'fraction',
			term: getCollectionTerm({ memberType: 'categorical' })
		},
		{ label: 'collection without members', selectionMode: 'fraction', term: getCollectionTerm({ termlst: [] }) },
		{ label: 'non-collection term', selectionMode: 'fraction', term: { type: 'junction', id: 'junction-1' } }
	]
	for (const c of cases) {
		const { holder, listDiv, fractionDiv } = getDivs()
		const isStaged = mayRenderFractionSelection({
			term: c.term,
			selectionMode: c.selectionMode as any,
			listDiv,
			fractionDiv,
			callback: () => {}
		})
		test.equal(isStaged, false, `does not stage a selection for ${c.label}`)
		test.equal(fractionDiv.selectAll('*').size(), 0, `renders no chooser for ${c.label}`)
		test.notEqual(listDiv.style('display'), 'none', `keeps the term list visible for ${c.label}`)
		if (test['_ok']) holder.remove()
	}
	test.end()
})
