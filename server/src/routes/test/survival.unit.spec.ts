import tape from 'tape'
import { getTwByIndex, getTermData, get_survival } from '../termdb.survival.ts'

/**
 * Tests
 *  - getTwByIndex()
 *  - getTermData()
 *  - get_survival() request validation of a fraction termCollection
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
 getTwByIndex
***************/

tape('getTwByIndex: keeps a fraction termCollection tw intact', function (test) {
	const q: any = {
		ds: mockDs,
		term1_id: survivalTerm.id,
		term2: fractionTerm,
		term2_q: getFractionQ(),
		term2_$id: 'TwBase_1_12345',
		term2_type: 'TermCollectionTWFraction'
	}
	const twByIndex = getTwByIndex(q)
	const tw = twByIndex.get(2)
	test.equal(tw.type, 'TermCollectionTWFraction', 'Should carry over term2_type')
	test.equal(tw.$id, 'TwBase_1_12345', 'Should carry over term2_$id, which keys the sample data')
	test.equal(tw.term, fractionTerm, 'Should use the posted term')
	test.deepEqual(tw.q.numerators, ['drugA'], 'Should use the posted q')
	test.end()
})

tape('getTwByIndex: infers the fraction tw type from q.denominators', function (test) {
	// a request that is not assembled by the client tw router may omit term2_type
	const q: any = {
		ds: mockDs,
		term1_id: survivalTerm.id,
		term2: fractionTerm,
		term2_q: getFractionQ(),
		term2_$id: 'tw2'
	}
	const tw = getTwByIndex(q).get(2)
	test.equal(tw.type, 'TermCollectionTWFraction', 'Should infer the fraction tw type')
	test.end()
})

tape('getTwByIndex: falls back to the term name when a termCollection has no $id', function (test) {
	const q: any = { ds: mockDs, term1_id: survivalTerm.id, term2: fractionTerm, term2_q: getFractionQ() }
	const tw = getTwByIndex(q).get(2)
	test.equal(tw.$id, fractionTerm.name, 'Should key a custom collection by its name')
	test.end()
})

tape('getTwByIndex: does not assign $id or type to a dictionary term', function (test) {
	const q: any = { ds: mockDs, term1_id: survivalTerm.id, term2_id: 'sex', term2_q: { type: 'values' } }
	const twByIndex = getTwByIndex(q)
	test.equal(twByIndex.get(1).term, survivalTerm, 'Should look up term1 by id')
	test.equal(twByIndex.get(2).$id, undefined, 'Should leave a dictionary term keyed by term.id')
	test.equal(twByIndex.get(2).type, undefined, 'Should not set a tw type')
	test.equal(twByIndex.get(0), undefined, 'Should not create a tw for a missing term0')
	test.end()
})

tape('getTwByIndex: parses a JSON-encoded term', function (test) {
	const q: any = {
		ds: mockDs,
		term1_id: survivalTerm.id,
		term2: encodeURIComponent(JSON.stringify(fractionTerm)),
		term2_q: getFractionQ()
	}
	const tw = getTwByIndex(q).get(2)
	test.equal(tw.term.name, fractionTerm.name, 'Should parse the term string')
	test.equal(tw.type, 'TermCollectionTWFraction', 'Should infer the fraction tw type from the parsed term')
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
	const tw = { term: { id: 'sex', type: 'categorical' }, q: {} }
	test.equal(getTermData({ sex: { key: 'Male', value: 'M' } }, tw), 'Male', 'Should return the key')
	test.equal(getTermData({}, tw), undefined, 'Should skip a sample without a value')
	test.end()
})

/**************
 get_survival - request validation
***************/

tape('get_survival: rejects a continuous fraction overlay', async function (test) {
	const q: any = {
		ds: mockDs,
		term1_id: survivalTerm.id,
		term2: fractionTerm,
		term2_q: { ...getFractionQ(), mode: 'continuous' },
		term2_$id: 'tw2',
		term2_type: 'TermCollectionTWFraction'
	}
	const result = await get_survival(q, mockDs)
	test.ok(
		result.error?.includes('must use discrete bins'),
		'Should error since a continuous fraction gives one series per sample'
	)
	test.end()
})
