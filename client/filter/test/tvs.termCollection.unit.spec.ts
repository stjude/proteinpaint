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

const getNumerators = holder => getInputs(holder, 'sjpp-tvs-collection-numerator')
const getDenominators = holder => getInputs(holder, 'sjpp-tvs-collection-denominator')

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
	const getTableData = await addFilterTable(opts)

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

	const tvsProps = getTableData()
	test.deepEqual(tvsProps.denominators, ['ENST01', 'ENST03'], 'returns the denominator ids')
	test.deepEqual(tvsProps.numerators, ['ENST03'], 'returns the numerator ids')
	test.deepEqual(
		tvsProps.termlst.map(t => t.id),
		['ENST01', 'ENST02', 'ENST03'],
		'keeps every member on the term, the denominator is not implied by termlst[]'
	)

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
	const getTableData = await addFilterTable(opts)
	const tvsProps = getTableData()

	test.deepEqual(tvsProps.denominators, ['ENST01', 'ENST02', 'ENST03'], 'defaults all members as denominators')
	test.deepEqual(tvsProps.numerators, ['ENST01', 'ENST02', 'ENST03'], 'defaults all members as numerators')

	if (test['_ok']) opts.holder.remove()
	test.end()
})

tape('addFilterTable() rejects a numerator that is not a denominator', async test => {
	const opts = getOpts({
		type: 'termCollection',
		memberType: 'numeric',
		name: 'Test collection',
		termlst: members,
		denominators: ['ENST01'],
		numerators: ['ENST01']
	})
	const getTableData = await addFilterTable(opts)
	// select a numerator that is not selected as a denominator
	getNumerators(opts.holder)[1].checked = true

	const alerts: any[] = []
	const alert0 = window.alert
	window.alert = msg => alerts.push(msg)
	const tvsProps = getTableData()
	window.alert = alert0

	test.equal(tvsProps, undefined, 'returns no selection')
	test.equal(alerts.length, 1, 'alerts the user')
	test.ok(`${alerts[0]}`.includes('numerator'), `alert names the offending list: ${alerts[0]}`)

	if (test['_ok']) opts.holder.remove()
	test.end()
})
