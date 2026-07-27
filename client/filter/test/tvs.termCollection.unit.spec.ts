import tape from 'tape'
import * as d3s from 'd3-selection'
import { addFilterTable } from '../tvs.termCollection.ts'

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

tape('addFilterTable() defaults every member to numerator and denominator for a new filter', async test => {
	const opts = getOpts({ type: 'termCollection', memberType: 'numeric', name: 'Test collection', termlst: members })
	await addFilterTable(opts)

	test.deepEqual(opts.tvs.term.denominators, ['ENST01', 'ENST02', 'ENST03'], 'defaults all members as denominators')
	test.deepEqual(opts.tvs.term.numerators, ['ENST01', 'ENST02', 'ENST03'], 'defaults all members as numerators')

	if (test['_ok']) opts.holder.remove()
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
