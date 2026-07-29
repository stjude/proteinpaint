import tape from 'tape'
import { getTermData, get_survival } from '../termdb.survival.ts'
import { getTwByIndex } from '#src/termdb.twFromRequest.ts'

/**
 * Tests
 *  - getTermData()
 *  - the $id that this route keys its sample data by
 *  - get_survival() request validation
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

tape('getTermData: reads a dictionary term value by term.id', function (test) {
	// this route assigns $id = term.id for a dictionary term
	const tw = { $id: 'sex', term: { id: 'sex', type: 'categorical' }, q: {} }
	test.equal(getTermData({ sex: { key: 'Male', value: 'M' } }, tw), 'Male', 'Should return the key')
	test.equal(getTermData({}, tw), undefined, 'Should skip a sample without a value')
	test.end()
})

/**********************************
 the key of the sample data
***********************************/

tape('survival keys a dictionary term by term.id, not by the posted $id', function (test) {
	/* the survival data of a dataset such as mmrf comes from a dataset-supplied getter that
	keys both samples{} and refs.byTermId{} by term.id, so this route opts out of the $id that
	the client posts. A custom termCollection has no term.id and keeps the posted $id. */
	const q: any = {
		ds: mockDs,
		term1: { $id: 'TwBase_1_12345', term: survivalTerm, q: { mode: 'discrete' } },
		term2: { $id: 'TwBase_2_67890', type: 'TermCollectionTWFraction', term: fractionTerm, q: getFractionQ() }
	}
	const twByIndex = getTwByIndex(q, { keyDictTermsByTermId: true })
	test.equal(twByIndex.get(1).$id, 'efs', 'Should key the survival term by term.id')
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
	const result = await get_survival({ ds: mockDs, term2_id: 'sex' }, mockDs)
	test.equal(result.error, 'term1 is missing', 'Should report the missing term rather than fail on it')
	test.end()
})

tape('get_survival: rejects a non-survival term1 without term2', async function (test) {
	const result = await get_survival({ ds: mockDs, term1_id: 'sex' }, mockDs)
	test.equal(result.error, 'non-survival term', 'Should require a survival term')
	test.end()
})
