import tape from 'tape'
import { getTwByIndex, getTermData, getTwBins, get_survival } from '../termdb.survival.ts'

/**
 * Tests
 *  - getTwByIndex(), for a term wrapper posted whole and for the superseded split form
 *  - getTermData()
 *  - getTwBins()
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

/** minimal ds for the request validation that runs before getData().
 * lookedUpIds[] records the terms that had to be filled in from the termdb. */
function getMockDs() {
	const lookedUpIds: string[] = []
	return {
		lookedUpIds,
		cohort: {
			termdb: {
				q: {
					termjsonByOneid: (id: string) => {
						lookedUpIds.push(id)
						if (id == survivalTerm.id) return survivalTerm
						if (id == 'unknown') return null
						return { id, name: id, type: 'categorical' }
					}
				}
			}
		}
	}
}

const mockDs = getMockDs()

tape('\n', function (test) {
	test.comment('-***- #routes/termdb.survival -***-')
	test.end()
})

/**********************************
 getTwByIndex - term wrapper posted whole
***********************************/

tape('getTwByIndex: keeps a whole fraction termCollection tw intact', function (test) {
	const tw2 = {
		$id: 'TwBase_1_12345',
		type: 'TermCollectionTWFraction',
		term: fractionTerm,
		q: getFractionQ()
	}
	const twByIndex = getTwByIndex({ ds: mockDs, term1_id: survivalTerm.id, term2: tw2 })
	const tw = twByIndex.get(2)
	test.equal(tw.type, 'TermCollectionTWFraction', 'Should keep the posted wrapper type')
	test.equal(tw.$id, 'TwBase_1_12345', 'Should keep the posted $id, which keys the sample data')
	test.equal(tw.term, fractionTerm, 'Should use the posted term')
	test.deepEqual(tw.q.numerators, ['drugA'], 'Should use the posted q')
	test.end()
})

tape('getTwByIndex: keeps the wrapper type of a whole dictionary tw', function (test) {
	// the wrapper type of a dictionary term did not survive the split form, which forced
	// each route to guess it back from the term type and q
	const ds = getMockDs()
	const term = { id: 'sex', name: 'Sex', type: 'categorical', values: { M: { label: 'Male' } } }
	const tw2 = { $id: 'TwBase_2_67890', type: 'CatTWValues', term, q: { type: 'values' } }
	const tw = getTwByIndex({ ds, term1_id: survivalTerm.id, term2: tw2 }).get(2)
	test.equal(tw.type, 'CatTWValues', 'Should keep the posted wrapper type')
	test.equal(tw.term, term, 'Should use the posted term as-is')
	test.deepEqual(ds.lookedUpIds, [survivalTerm.id], 'Should not look up a term that was posted whole')
	test.equal(tw.$id, 'sex', 'Should keep a dictionary term keyed by term.id')
	test.end()
})

tape('getTwByIndex: fills in a whole tw that carries only a term id', function (test) {
	const ds = getMockDs()
	const tw = getTwByIndex({ ds, term1_id: survivalTerm.id, term2: { term: { id: 'sex' }, q: {} } }).get(2)
	test.equal(tw.term.type, 'categorical', 'Should fill in the term from the termdb')
	test.equal(tw.$id, 'sex', 'Should key the filled-in term by term.id')
	test.end()
})

tape('getTwByIndex: skips a whole tw whose term id is unknown', function (test) {
	const q: any = { ds: mockDs, term1_id: survivalTerm.id, term2: { term: { id: 'unknown' }, q: {} } }
	test.equal(getTwByIndex(q).get(2), undefined, 'Should serve the request as if the term were absent')
	test.end()
})

/**********************************
 getTwByIndex - superseded split form
***********************************/

tape('getTwByIndex: reassembles a fraction termCollection from the split form', function (test) {
	const q: any = {
		ds: mockDs,
		term1_id: survivalTerm.id,
		term2: fractionTerm,
		term2_q: getFractionQ(),
		term2_$id: 'TwBase_1_12345',
		term2_type: 'TermCollectionTWFraction'
	}
	const tw = getTwByIndex(q).get(2)
	test.equal(tw.type, 'TermCollectionTWFraction', 'Should carry over term2_type')
	test.equal(tw.$id, 'TwBase_1_12345', 'Should carry over term2_$id, which keys the sample data')
	test.equal(tw.term, fractionTerm, 'Should use the posted term')
	test.deepEqual(tw.q.numerators, ['drugA'], 'Should carry over term2_q')
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

tape('getTwByIndex: keys a dictionary term by term.id, ignoring the posted $id', function (test) {
	// the client posts its own tw.$id for every term, but only a custom termCollection may use
	// it: a dataset-supplied getter may key its data and refs by term.id
	const q: any = {
		ds: mockDs,
		term1_id: survivalTerm.id,
		term2_id: 'sex',
		term2_q: { type: 'values' },
		term2_$id: 'TwBase_2_67890'
	}
	const twByIndex = getTwByIndex(q)
	test.equal(twByIndex.get(1).term, survivalTerm, 'Should look up term1 by id')
	test.equal(twByIndex.get(2).$id, 'sex', 'Should keep a dictionary term keyed by term.id')
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

tape('getTwByIndex: takes term2_id over a bare term posted in term2', function (test) {
	const q: any = { ds: mockDs, term1_id: survivalTerm.id, term2_id: 'sex', term2: fractionTerm }
	test.equal(getTwByIndex(q).get(2).term.id, 'sex', 'Should resolve the id first, as before')
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
	// getTwByIndex() assigns $id = term.id for a dictionary term
	const tw = { $id: 'sex', term: { id: 'sex', type: 'categorical' }, q: {} }
	test.equal(getTermData({ sex: { key: 'Male', value: 'M' } }, tw), 'Male', 'Should return the key')
	test.equal(getTermData({}, tw), undefined, 'Should skip a sample without a value')
	test.end()
})

/**************
 getTwBins
***************/

tape('getTwBins: reads the bins that getData() computed for a tw', function (test) {
	const bins = [{ label: '<50%' }, { label: '≥50%' }]
	const data = { refs: { byTermId: { tw2: { bins } } } }
	test.equal(getTwBins({ $id: 'tw2' }, data), bins, 'Should read the bins by $id')
	test.deepEqual(getTwBins(undefined, data), [], 'Should return an empty list without a tw')
	test.deepEqual(getTwBins({ $id: 'sex' }, data), [], 'Should return an empty list for a term with no bins')
	test.deepEqual(getTwBins({ $id: 'tw2' }, { refs: {} }), [], 'Should tolerate refs without byTermId')
	test.end()
})

tape('getTwBins: reads the same key that the sample data is keyed by', function (test) {
	/* the bins of an overlay term supply the order of the series keys, so a bins lookup
	that does not match the sample data lookup silently returns no order at all */
	const tw = getTwByIndex({
		ds: mockDs,
		term1_id: survivalTerm.id,
		term2: { $id: 'TwBase_2_1', type: 'NumTWRegularBin', term: { id: 'agedx', name: 'Age', type: 'float' }, q: {} }
	}).get(2)
	const bins = [{ label: '<10' }, { label: '≥10' }]
	const data = { refs: { byTermId: { [tw.$id]: { bins } } } }
	const sample = { [tw.$id]: { key: '<10', value: 5 } }
	test.equal(getTwBins(tw, data), bins, 'Should find the bins of the overlay term')
	test.ok(
		getTwBins(tw, data).some(bin => bin.label == getTermData(sample, tw)),
		'Should order the series key that getTermData() reads for the same tw'
	)
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
