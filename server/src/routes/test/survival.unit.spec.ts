import tape from 'tape'
import { getTermData, get_survival, orderTests } from '../termdb.survival.ts'
import { getTwByIndex } from '#src/termdb.twFromRequest.ts'

/**
 * Tests
 *  - getTermData()
 *  - the $id that this route keys its sample data by
 *  - get_survival() request validation
 *  - orderTests()
 *
 * The reassembly of a posted term wrapper is covered by termdb.twFromRequest.unit.spec.ts
 */

const survivalTerm = { id: 'efs', name: 'Event-free survival', type: 'survival' }

const fractionTerm = {
	type: 'termCollection',
	name: 'Alkylating agents',
	memberType: 'numeric',
	isCustom: true,
	termlst: [
		{ id: 'drugA', name: 'Drug A', type: 'float' },
		{ id: 'drugB', name: 'Drug B', type: 'float' }
	]
}

function getFractionQ() {
	return {
		mode: 'discrete',
		type: 'custom-bin',
		denominators: ['drugA', 'drugB'],
		numerators: ['drugA'],
		lst: [
			{ startunbounded: true, stop: 0.5, label: '<50%' },
			{ start: 0.5, stopunbounded: true, startinclusive: true, label: '≥50%' }
		]
	}
}

/** minimal ds for the request validation that runs before getData() */
const mockDs = {
	cohort: {
		termdb: {
			q: {
				termjsonByOneid: (id: string) => (id == survivalTerm.id ? survivalTerm : { id, name: id, type: 'categorical' })
			}
		}
	}
}

tape('\n', function (test) {
	test.comment('-***- #routes/termdb.survival -***-')
	test.end()
})

/**************
 getTermData
***************/

tape('getTermData: reads a fraction tw value by $id', function (test) {
	const tw = { $id: 'tw2', type: 'TermCollectionTWFraction', term: fractionTerm, q: getFractionQ() }
	const sample = { tw2: { key: '≥50%', value: 0.75 } }
	test.equal(getTermData(sample, tw), '≥50%', 'Should return the bin label computed by getData()')
	test.end()
})

tape('getTermData: returns undefined for a sample without fraction data', function (test) {
	const tw = { $id: 'tw2', type: 'TermCollectionTWFraction', term: fractionTerm, q: getFractionQ() }
	test.equal(getTermData({}, tw), undefined, 'Should skip a sample with no value for the collection')
	test.end()
})

tape('getTermData: reads a dictionary term value by its $id', function (test) {
	const tw = { $id: 'TwBase_2_67890', term: { id: 'sex', type: 'categorical' }, q: {} }
	test.equal(getTermData({ TwBase_2_67890: { key: 'Male', value: 'M' } }, tw), 'Male', 'Should return the key')
	test.equal(getTermData({}, tw), undefined, 'Should skip a sample without a value')
	test.end()
})

/**********************************
 the key of the sample data
***********************************/

tape('survival keys every term by the $id that the client posts', function (test) {
	/* the survival data of a dataset such as mmrf comes from a dataset-supplied getter, which
	keys both samples{} and refs.byTermId{} by tw.$id. The survival plot reads refs.byTermId
	by the same $id, for the survMsg of that getter. */
	const q: any = {
		ds: mockDs,
		term1: { $id: 'TwBase_1_12345', term: survivalTerm, q: { mode: 'discrete' } },
		term2: { $id: 'TwBase_2_67890', type: 'TermCollectionTWFraction', term: fractionTerm, q: getFractionQ() }
	}
	const twByIndex = getTwByIndex(q)
	test.equal(twByIndex.get(1).$id, 'TwBase_1_12345', 'Should key the survival term by the posted $id')
	test.equal(twByIndex.get(2).$id, 'TwBase_2_67890', 'Should key a custom collection by the posted $id')
	test.end()
})

/**************
 get_survival - request validation
***************/

tape('get_survival: rejects a continuous fraction overlay', async function (test) {
	const q: any = {
		ds: mockDs,
		term1_id: survivalTerm.id,
		term1_$id: 'tw1',
		term2: {
			$id: 'tw2',
			type: 'TermCollectionTWFraction',
			term: fractionTerm,
			q: { ...getFractionQ(), mode: 'continuous' }
		}
	}
	const result = await get_survival(q, mockDs)
	test.ok(
		result.error?.includes('must use discrete bins'),
		'Should error since a continuous fraction gives one series per sample'
	)
	test.end()
})

tape('get_survival: rejects a continuous fraction overlay posted in the split form', async function (test) {
	const q: any = {
		ds: mockDs,
		term1_id: survivalTerm.id,
		term1_$id: 'tw1',
		term2: fractionTerm,
		term2_q: { ...getFractionQ(), mode: 'continuous' },
		term2_$id: 'tw2',
		term2_type: 'TermCollectionTWFraction'
	}
	const result = await get_survival(q, mockDs)
	test.ok(result.error?.includes('must use discrete bins'), 'Should apply the same validation to either form')
	test.end()
})

tape('get_survival: rejects a request without term1', async function (test) {
	const result = await get_survival({ ds: mockDs, term2_id: 'sex', term2_$id: 'tw2' }, mockDs)
	test.equal(result.error, 'term1 is missing', 'Should report the missing term rather than fail on it')
	test.end()
})

tape('get_survival: rejects a non-survival term1 without term2', async function (test) {
	const result = await get_survival({ ds: mockDs, term1_id: 'sex', term1_$id: 'tw1' }, mockDs)
	test.equal(result.error, 'non-survival term', 'Should require a survival term')
	test.end()
})

tape('get_survival: rejects a term posted without a $id', async function (test) {
	const result = await get_survival({ ds: mockDs, term1_id: survivalTerm.id }, mockDs)
	test.equal(result.error, 'term1 is missing $id', 'Should not serve a request whose data key is unknown')
	test.end()
})

/**************
 orderTests
***************/

tape('orderTests: orders the tests by the bin order of the overlay', function (test) {
	// as the rust module orders the series by label
	const tests = [
		{ series1: '7 to 12', series2: '<7', pvalue: '0.1' },
		{ series1: '7 to 12', series2: '>12', pvalue: '0.2' },
		{ series1: '<7', series2: '>12', pvalue: '0.3' }
	]
	test.deepEqual(
		orderTests(tests, ['<7', '7 to 12', '>12']),
		[
			{ series1: '<7', series2: '7 to 12', pvalue: '0.1' },
			{ series1: '<7', series2: '>12', pvalue: '0.3' },
			{ series1: '7 to 12', series2: '>12', pvalue: '0.2' }
		],
		'Should give the pairs in the order of combn() over the bin order, with series1 before series2'
	)
	test.end()
})

tape('orderTests: matches number series keys to the string series of the tests', function (test) {
	const tests = [
		{ series1: '1', series2: '2', pvalue: '0.1' },
		{ series1: '1', series2: '10', pvalue: '0.2' },
		{ series1: '2', series2: '10', pvalue: '0.3' }
	]
	test.deepEqual(
		orderTests(tests, [10, 2, 1]).map(t => [t.series1, t.series2]),
		[
			['10', '2'],
			['10', '1'],
			['2', '1']
		],
		'Should order by the series keys'
	)
	test.end()
})

tape('orderTests: keeps a series that is not in the order after the others', function (test) {
	const tests = [
		{ series1: 'A', series2: 'B', pvalue: '0.1' },
		{ series1: 'A', series2: 'C', pvalue: '0.2' },
		{ series1: 'B', series2: 'C', pvalue: '0.3' }
	]
	test.deepEqual(
		orderTests(tests, ['C', 'B']).map(t => [t.series1, t.series2]),
		[
			['C', 'B'],
			['C', 'A'],
			['B', 'A']
		],
		'Should put the unknown series last'
	)
	test.end()
})
