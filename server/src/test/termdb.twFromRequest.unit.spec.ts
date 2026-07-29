import tape from 'tape'
import { getTwByIndex, getTwBins } from '../termdb.twFromRequest.ts'

/**
 * Tests
 *  - getTwByIndex(), for a term wrapper posted whole and for the superseded split form
 *  - getTwBins()
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

/** minimal ds. lookedUpIds[] records the terms that had to be filled in from the termdb */
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
	test.comment('-***- modules/termdb.twFromRequest -***-')
	test.end()
})

/**********************************
 a term wrapper posted whole
***********************************/

tape('getTwByIndex: keeps a whole tw intact', function (test) {
	const ds = getMockDs()
	const term = { id: 'sex', name: 'Sex', type: 'categorical', values: { M: { label: 'Male' } } }
	const tw2 = { $id: 'TwBase_2_67890', type: 'CatTWValues', term, q: { type: 'values' } }
	const tw = getTwByIndex({ ds, term2: tw2 }).get(2)
	// the wrapper type of a dictionary term did not survive the split form, which forced
	// each route to guess it back from the term type and q
	test.equal(tw.type, 'CatTWValues', 'Should keep the posted wrapper type')
	test.equal(tw.term, term, 'Should use the posted term as-is')
	test.deepEqual(ds.lookedUpIds, [], 'Should not look up a term that was posted whole')
	test.equal(tw.$id, 'TwBase_2_67890', 'Should key the sample data by the posted $id')
	test.end()
})

tape('getTwByIndex: keeps a whole fraction termCollection tw intact', function (test) {
	const tw2 = { $id: 'TwBase_1_12345', type: 'TermCollectionTWFraction', term: fractionTerm, q: getFractionQ() }
	const tw = getTwByIndex({ ds: mockDs, term2: tw2 }).get(2)
	test.equal(tw.type, 'TermCollectionTWFraction', 'Should keep the posted wrapper type')
	test.equal(tw.$id, 'TwBase_1_12345', 'Should keep the posted $id, which keys the sample data')
	test.equal(tw.term, fractionTerm, 'Should use the posted term')
	test.deepEqual(tw.q.numerators, ['drugA'], 'Should use the posted q')
	test.end()
})

tape('getTwByIndex: fills in a whole tw that carries only a term id', function (test) {
	const ds = getMockDs()
	const tw = getTwByIndex({ ds, term2: { term: { id: 'sex' }, q: {} } }).get(2)
	test.equal(tw.term.type, 'categorical', 'Should fill in the term from the termdb')
	test.equal(tw.$id, 'sex', 'Should key the filled-in term by term.id')
	test.end()
})

tape('getTwByIndex: skips a tw whose term id is unknown', function (test) {
	const twByIndex = getTwByIndex({ ds: mockDs, term1_id: 'unknown', term2: { term: { id: 'unknown' }, q: {} } })
	test.equal(twByIndex.get(1), undefined, 'Should serve the request as if the split term were absent')
	test.equal(twByIndex.get(2), undefined, 'Should serve the request as if the whole tw were absent')
	test.end()
})

/**********************************
 $id, the key of the sample data
***********************************/

tape('getTwByIndex: keys a dictionary term by term.id when the route opts in', function (test) {
	// a dataset-supplied getter may key its data and refs by term.id, so a route serving
	// such a dataset cannot use the $id that the client posts
	const q: any = { ds: mockDs, term2: { $id: 'TwBase_2_67890', term: { id: 'sex', type: 'categorical' }, q: {} } }
	test.equal(getTwByIndex(q).get(2).$id, 'TwBase_2_67890', 'Should use the posted $id by default')
	test.equal(
		getTwByIndex(q, { keyDictTermsByTermId: true }).get(2).$id,
		'sex',
		'Should use term.id when keyDictTermsByTermId is set'
	)
	test.end()
})

tape('getTwByIndex: keys a custom termCollection by the posted $id under either rule', function (test) {
	// a custom collection has no term.id, so the posted $id is its only stable key
	const q: any = { ds: mockDs, term2: { $id: 'TwBase_2_frac', term: fractionTerm, q: getFractionQ() } }
	test.equal(getTwByIndex(q).get(2).$id, 'TwBase_2_frac', 'Should use the posted $id by default')
	test.equal(
		getTwByIndex(q, { keyDictTermsByTermId: true }).get(2).$id,
		'TwBase_2_frac',
		'Should still use the posted $id when keyDictTermsByTermId is set'
	)
	test.end()
})

tape('getTwByIndex: falls back to the term name when a termCollection has no $id', function (test) {
	const q: any = { ds: mockDs, term2: fractionTerm, term2_q: getFractionQ() }
	test.equal(getTwByIndex(q).get(2).$id, fractionTerm.name, 'Should key a custom collection by its name')
	test.end()
})

/**********************************
 the superseded split form
***********************************/

tape('getTwByIndex: reassembles a fraction termCollection from the split form', function (test) {
	const q: any = {
		ds: mockDs,
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
	const q: any = { ds: mockDs, term2: fractionTerm, term2_q: getFractionQ(), term2_$id: 'tw2' }
	test.equal(getTwByIndex(q).get(2).type, 'TermCollectionTWFraction', 'Should infer the fraction tw type')
	test.end()
})

tape('getTwByIndex: resolves a term posted as term<i>_id', function (test) {
	const q: any = { ds: mockDs, term1_id: survivalTerm.id, term2_id: 'sex', term2_q: { type: 'values' } }
	const twByIndex = getTwByIndex(q)
	test.equal(twByIndex.get(1).term, survivalTerm, 'Should look up term1 by id')
	test.deepEqual(twByIndex.get(2).q, { type: 'values' }, 'Should carry over term2_q')
	test.equal(twByIndex.get(2).type, undefined, 'Should not set a tw type')
	test.equal(twByIndex.get(0), undefined, 'Should not create a tw for a missing term0')
	test.end()
})

tape('getTwByIndex: takes term2_id over a bare term posted in term2', function (test) {
	const q: any = { ds: mockDs, term2_id: 'sex', term2: fractionTerm }
	test.equal(getTwByIndex(q).get(2).term.id, 'sex', 'Should resolve the id first, as before')
	test.end()
})

tape('getTwByIndex: parses a JSON-encoded term', function (test) {
	const q: any = { ds: mockDs, term2: encodeURIComponent(JSON.stringify(fractionTerm)), term2_q: getFractionQ() }
	const tw = getTwByIndex(q).get(2)
	test.equal(tw.term.name, fractionTerm.name, 'Should parse the term string')
	test.equal(tw.type, 'TermCollectionTWFraction', 'Should infer the fraction tw type from the parsed term')
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
	/* the bins of an overlay term supply the order of the series keys, so a bins lookup that
	does not match the sample data lookup silently returns no order at all */
	const q: any = {
		ds: mockDs,
		term2: { $id: 'TwBase_2_1', type: 'NumTWRegularBin', term: { id: 'agedx', name: 'Age', type: 'float' }, q: {} }
	}
	for (const opts of [{}, { keyDictTermsByTermId: true }]) {
		const tw = getTwByIndex(q, opts).get(2)
		const bins = [{ label: '<10' }, { label: '≥10' }]
		const sampleData = { [tw.$id]: { key: '<10', value: 5 } }
		const data = { refs: { byTermId: { [tw.$id]: { bins } } } }
		test.equal(getTwBins(tw, data), bins, `Should find the bins under the same key as the sample data`)
		test.ok(sampleData[tw.$id], `Should read the sample data under $id='${tw.$id}'`)
	}
	test.end()
})
