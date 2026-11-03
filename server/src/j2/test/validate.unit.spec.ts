import tape from 'tape'
import { computeTypes, getJunctionData } from '../validate.js'

tape('\n', test => {
	test.comment('-***- junction/validate specs -***-')
	test.end()
})

tape('computeTypes: canonical and event types', test => {
	const junction = {
		canonical: true,
		events: [{ type: 'exon_skip' }, { type: 'alt_donor' }, { type: 'exon_skip' }]
	}

	const types = computeTypes(junction, new Set())

	test.deepEqual(types, ['canonical', 'exon_skip', 'alt_donor'], 'returns canonical and unique event types')
	test.equal(junction.canonical, undefined, 'removes canonical from the junction info object')
	test.end()
})

tape('computeTypes: hidden types are excluded', test => {
	const junction = {
		canonical: true,
		events: [{ type: 'exon_skip' }, { type: 'alt_acceptor' }]
	}

	const types = computeTypes(junction, new Set(['canonical', 'alt_acceptor']))

	test.deepEqual(types, ['exon_skip'], 'omits hidden canonical and event types')
	test.equal(junction.canonical, undefined, 'removes canonical even when hidden')
	test.end()
})

tape('computeTypes: no events and non-canonical junction', test => {
	{
		const junction = {}
		const types = computeTypes(junction, new Set())
		test.deepEqual(types, ['na'], 'returns na when the junction is not canonical and has no events')
	}
	{
		const junction = {}
		const types = computeTypes(junction, new Set(['na']))
		test.deepEqual(types, [], 'returns no visible types when na is hidden')
	}
	test.end()
})

tape('computeTypes: event type must be a string', test => {
	const junction = {
		events: [{ type: 'exon_skip' }, {}]
	}

	test.throws(() => computeTypes(junction, new Set()), /event\.type missing/, 'throws when an event type is missing')
	test.end()
})

tape('getJunctionData: reformats sn2rc for termdb.matrix', async test => {
	const tw = {
		$id: 'junction-1',
		term: { type: 'junction', chr: 'chr1', start: 100, stop: 200, strand: '+' },
		q: { readcountCutoff: 3 }
	}
	const result = await getJunctionData(
		{ terms: [tw], filter: { type: 'tvslst', lst: [] } },
		async (query, keepList) => {
			test.deepEqual(query.rglst, [{ chr: 'chr1', start: 100, stop: 200 }], 'queries the junction region')
			test.equal(query.readcountCutoff, 3, 'passes the term read-count cutoff')
			test.deepEqual(keepList, [{ start: 100, stop: 200, strand: '+' }], 'limits results to the selected junction')
			return {
				junctions: [{ start: 100, stop: 200, strand: '+', sn2rc: new Map([['sample-1', 12]]) }]
			}
		},
		{}
	)
	test.deepEqual(result.term2sample2value.get('junction-1'), { 'sample-1': 12 }, 'returns sample-to-count values')
	test.end()
})

tape('getJunctionData: keeps the samples of the sample types chosen for each term', async test => {
	const makeDs = (sampleId2Type: Map<any, number>) => ({
		sampleId2Type,
		cohort: {
			termdb: {
				sampleTypes: {
					1: { name: 'patient', parent_id: null },
					2: { name: 'diagnosis sample', parent_id: 1 },
					3: { name: 'relapse sample', parent_id: 1 }
				}
			}
		}
	})
	const junction = { type: 'junction', chr: 'chr1', start: 100, stop: 200, strand: '+' }
	const listJunctionsOf = (sn2rc: Map<any, number>) => async () => ({
		junctions: [{ start: 100, stop: 200, strand: '+', sn2rc }]
	})
	const ds = makeDs(
		new Map([
			[1, 2],
			[2, 3],
			[3, 2]
		])
	)
	const listJunctions = listJunctionsOf(
		new Map([
			[1, 5],
			[2, 7],
			[3, 9],
			// a sample without a sample type, which only a term without sample types reads
			[4, 1]
		])
	)
	const result = await getJunctionData(
		{
			terms: [
				{ $id: 'all', term: junction },
				{ $id: 'diagnosis', term: { ...junction, sampleTypes: [2] } },
				{ $id: 'relapse', term: { ...junction, sampleTypes: ['3'] } }
			]
		},
		listJunctions,
		ds
	)
	test.deepEqual(
		result.term2sample2value.get('all'),
		{ 1: 5, 2: 7, 3: 9, 4: 1 },
		'a term without sample types reads every sample'
	)
	test.deepEqual(result.term2sample2value.get('diagnosis'), { 1: 5, 3: 9 }, 'a term reads only its sample types')
	test.deepEqual(
		result.term2sample2value.get('relapse'),
		{ 2: 7 },
		'a sample type given as a numeric string matches too'
	)

	// sample ids that are strings, as on a dataset keyed by case uuid
	const uuids = await getJunctionData(
		{ terms: [{ $id: 'd', term: { ...junction, sampleTypes: [2] } }] },
		listJunctionsOf(
			new Map([
				['uuid-a', 5],
				['uuid-b', 7]
			])
		),
		makeDs(
			new Map([
				['uuid-a', 2],
				['uuid-b', 3]
			])
		)
	)
	test.deepEqual(uuids.term2sample2value.get('d'), { 'uuid-a': 5 }, 'matches string sample ids as they are')

	const refuses = async (sampleTypes: any, d: any, expected: string, message: string) => {
		try {
			await getJunctionData({ terms: [{ $id: 'x', term: { ...junction, sampleTypes } }] }, listJunctions, d)
			test.fail(message)
		} catch (e: any) {
			test.ok(String(e.message || e).includes(expected), message)
		}
	}
	await refuses('2', ds, 'must be an array', 'refuses sample types that are not an array')
	await refuses(['abc'], ds, "invalid sample type='abc'", 'refuses a sample type that is not an integer')
	await refuses([9], ds, "invalid sample type='9'", 'refuses a sample type unknown to the dataset')
	test.end()
})
