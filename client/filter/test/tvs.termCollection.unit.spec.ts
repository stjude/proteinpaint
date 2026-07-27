import tape from 'tape'
import * as d3s from 'd3-selection'
import { addFilterTable, handler } from '../tvs.termCollection.ts'

/*************************
 reusable helper functions
**************************/

const members = [
	{ id: 'ENST01', name: 'ENST01' },
	{ id: 'ENST02', name: 'ENST02' },
	{ id: 'ENST03', name: 'ENST03' }
]

function getOpts(term: any) {
	const holder = d3s.select('body').append('div')
	return { holder, tvs: { term, ranges: [] }, details: { termlst: members, type: 'numeric' } }
}

function getInputs(holder, testid: string): HTMLInputElement[] {
	return holder.selectAll(`[data-testid="${testid}"]`).nodes() as HTMLInputElement[]
}

const getNumerators = holder => getInputs(holder, 'sjpp-term-collection-numerator')
const getDenominators = holder => getInputs(holder, 'sjpp-term-collection-denominator')

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- filter/tvs.termCollection -***-')
	test.end()
})

tape('addFilterTable() checkboxes follow term.denominators[] and term.numerators[]', async test => {
	const opts = getOpts({
		type: 'termCollection',
		memberType: 'numeric',
		name: 'Test collection',
		termlst: members,
		denominators: ['ENST01', 'ENST03'],
		numerators: ['ENST03']
	})
	const validateSelection = await addFilterTable(opts)

	test.deepEqual(
		getDenominators(opts.holder).map(i => i.checked),
		[true, false, true],
		'checks the configured denominators'
	)
	test.deepEqual(
		getNumerators(opts.holder).map(i => i.checked),
		[false, false, true],
		'checks the configured numerators'
	)
	test.deepEqual(
		getNumerators(opts.holder).map(i => i.disabled),
		[false, true, false],
		'disables the numerator of a member that is not a denominator'
	)
	test.equal(validateSelection(), true, 'accepts the configured selection')
	test.deepEqual(
		opts.tvs.term.termlst.map(t => t.id),
		['ENST01', 'ENST02', 'ENST03'],
		'keeps every member on the term, the denominator is not implied by termlst[]'
	)

	if (test['_ok']) opts.holder.remove()
	test.end()
})

tape('addFilterTable() updates the tvs term as checkboxes change', async test => {
	const opts = getOpts({
		type: 'termCollection',
		memberType: 'numeric',
		name: 'Test collection',
		termlst: members,
		denominators: ['ENST01', 'ENST02', 'ENST03'],
		numerators: ['ENST01', 'ENST02']
	})
	const validateSelection = await addFilterTable(opts)

	getDenominators(opts.holder)[1].click() // deselect the ENST02 denominator
	test.equal(getNumerators(opts.holder)[1].checked, false, 'clears the numerator of a deselected denominator')
	test.equal(getNumerators(opts.holder)[1].disabled, true, 'disables the numerator of a deselected denominator')
	test.deepEqual(opts.tvs.term.denominators, ['ENST01', 'ENST03'], 'updates term.denominators in place')
	test.deepEqual(opts.tvs.term.numerators, ['ENST01'], 'updates term.numerators in place')

	getNumerators(opts.holder)[2].click() // add ENST03 to the numerator
	test.deepEqual(opts.tvs.term.numerators, ['ENST01', 'ENST03'], 'adds a checked numerator, in member order')
	test.equal(validateSelection(), true, 'accepts the edited selection')

	if (test['_ok']) opts.holder.remove()
	test.end()
})

tape('addFilterTable() implies the denominator from termlst[] when term.denominators[] is missing', async test => {
	// shape of a filter saved before term.denominators[] existed: termlst[] was pruned
	// to the selected denominators
	const opts = getOpts({
		type: 'termCollection',
		memberType: 'numeric',
		name: 'Test collection',
		termlst: [members[0], members[1]],
		numerators: ['ENST01']
	})
	await addFilterTable(opts)

	test.deepEqual(
		getDenominators(opts.holder).map(i => i.checked),
		[true, true, false],
		'checks every member of the pruned termlst as a denominator'
	)
	test.deepEqual(opts.tvs.term.denominators, ['ENST01', 'ENST02'], 'sets the implied denominator on the term')
	test.deepEqual(
		getNumerators(opts.holder).map(i => i.checked),
		[true, false, false],
		'checks the configured numerator'
	)

	if (test['_ok']) opts.holder.remove()
	test.end()
})

tape('addFilterTable() defaults to all denominators and the first member as numerator', async test => {
	const opts = getOpts({ type: 'termCollection', memberType: 'numeric', name: 'Test collection', termlst: members })
	await addFilterTable(opts)

	test.deepEqual(opts.tvs.term.denominators, ['ENST01', 'ENST02', 'ENST03'], 'defaults all members as denominators')
	test.deepEqual(opts.tvs.term.numerators, ['ENST01'], 'defaults only the first member as numerator')
	test.deepEqual(
		getNumerators(opts.holder).map(i => i.checked),
		[true, false, false],
		'checks only the first numerator checkbox'
	)

	if (test['_ok']) opts.holder.remove()
	test.end()
})

tape('fillMenu() defaults a new filter to x>0.1 on the first member', async test => {
	const holder = d3s.select('body').append('div')
	let applied: any
	const self = {
		opts: { vocabApi: { termdbConfig: {} }, callback: (tvs: any) => (applied = tvs) },
		dom: { tip: { hide: () => {} } }
	}
	const tvs = {
		term: { type: 'termCollection', isCustom: true, memberType: 'numeric', name: 'Test collection', termlst: members },
		ranges: []
	}

	await handler.fillMenu(self, holder, tvs as any)

	// the exclusive default renders in the canonical "start < x" form used by every range input
	test.equal(
		holder.select('input[name="rangeInput"]').property('value').trim(),
		'0.1 < x',
		'fills the range input with an exclusive 0.1 start'
	)
	test.deepEqual(
		getNumerators(holder).map(i => i.checked),
		[true, false, false],
		'checks only the first member as numerator'
	)
	test.deepEqual(
		getDenominators(holder).map(i => i.checked),
		[true, true, true],
		'checks every member as denominator'
	)
	test.equal(holder.selectAll('button.sjpp_apply_btn').size(), 1, 'renders the APPLY control as a <button>')
	test.equal(holder.selectAll('table').size(), 1, 'lays out the range input without a table, only the member table')
	;(holder.select('button.sjpp_apply_btn').node() as HTMLButtonElement).click()
	test.equal(applied?.ranges[0].start, 0.1, 'applies a range starting at 0.1')
	test.equal(applied?.ranges[0].startinclusive, false, 'applies an exclusive start')
	test.equal(applied?.ranges[0].stopunbounded, true, 'applies an unbounded stop')
	test.deepEqual(applied?.term.numerators, ['ENST01'], 'applies the first member as numerator')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('fillMenu() only applies the filter from the APPLY button', async test => {
	const holder = d3s.select('body').append('div')
	let applied: any
	let hidden = false
	const self = {
		opts: { vocabApi: { termdbConfig: {} }, callback: (tvs: any) => (applied = tvs) },
		dom: { tip: { hide: () => (hidden = true) } }
	}
	const tvs = {
		term: { type: 'termCollection', isCustom: true, memberType: 'numeric', name: 'Test collection', termlst: members },
		ranges: []
	}

	await handler.fillMenu(self, holder, tvs as any)

	// an edited range input fires 'change' when it loses focus, e.g. on clicking a checkbox
	// in the member table, which must not apply the filter and close the menu
	const input = holder.select('input[name="rangeInput"]').node() as HTMLInputElement
	input.value = '0.2 < x'
	input.dispatchEvent(new Event('change'))
	test.equal(applied, undefined, 'editing the range does not apply the filter')
	test.equal(hidden, false, 'editing the range does not close the menu')

	getNumerators(holder)[1].click()
	test.equal(applied, undefined, 'selecting a numerator does not apply the filter')
	test.equal(hidden, false, 'selecting a numerator does not close the menu')
	;(holder.select('button.sjpp_apply_btn').node() as HTMLButtonElement).click()
	test.equal(applied?.ranges[0].start, 0.2, 'APPLY applies the edited range')
	test.deepEqual(applied?.term.numerators, ['ENST01', 'ENST02'], 'APPLY applies the edited numerators')
	test.equal(hidden, true, 'APPLY closes the menu')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addFilterTable() rejects an empty numerator selection', async test => {
	const opts = getOpts({
		type: 'termCollection',
		memberType: 'numeric',
		name: 'Test collection',
		termlst: members,
		denominators: ['ENST01'],
		numerators: ['ENST01']
	})
	const validateSelection = await addFilterTable(opts)
	getNumerators(opts.holder)[0].click() // uncheck the only numerator

	const alerts: any[] = []
	const alert0 = window.alert
	window.alert = msg => alerts.push(msg)
	const isValid = validateSelection()
	window.alert = alert0

	test.equal(isValid, false, 'does not accept the selection')
	test.equal(alerts.length, 1, 'alerts the user')
	test.ok(`${alerts[0]}`.includes('numerator'), `alert names the offending list: ${alerts[0]}`)

	if (test['_ok']) opts.holder.remove()
	test.end()
})
