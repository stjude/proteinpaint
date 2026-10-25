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
		}
	)
	test.deepEqual(result.term2sample2value.get('junction-1'), { 'sample-1': 12 }, 'returns sample-to-count values')
	test.end()
})
