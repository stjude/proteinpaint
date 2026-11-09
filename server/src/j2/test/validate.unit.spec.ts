import tape from 'tape'
import { computeTypes, getJunctionData, removeIRtype, validate_query_junction } from '../validate.js'

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

tape('computeTypes: intron retention', test => {
	{
		const junction = { canonical: true, events: [{ type: 'IR', intron: { start: 11, stop: 20 } }] }
		test.deepEqual(computeTypes(junction, new Set()), ['canonical', 'IR'], 'lists IR after canonical')
	}
	{
		const junction = { events: [{ type: 'IR' }] }
		test.deepEqual(computeTypes(junction, new Set()), ['na', 'IR'], 'a non-canonical junction with only IR is also na')
	}
	{
		const junction = { events: [{ type: 'IR' }] }
		test.deepEqual(computeTypes(junction, new Set(['IR'])), ['na'], 'remains na when IR is hidden')
		test.equal((junction as any).events, undefined, 'removes the hidden IR event')
	}
	{
		const junction = { events: [{ type: 'IR' }] }
		test.deepEqual(computeTypes(junction, new Set(['na'])), ['IR'], 'is only IR when na is hidden')
	}
	{
		const junction = { events: [{ type: 'a5ss' }, { type: 'IR' }] }
		test.deepEqual(computeTypes(junction, new Set()), ['a5ss', 'IR'], 'is not na with another event')
	}
	{
		const junction = { events: [{ type: 'a5ss' }, { type: 'IR' }] }
		test.deepEqual(computeTypes(junction, new Set(['a5ss'])), ['IR'], 'is not na when the other event is hidden')
	}
	test.end()
})

tape('removeIRtype', test => {
	{
		const j: any = { types: ['canonical', 'a5ss', 'IR'], info: { events: [{ type: 'a5ss' }, { type: 'IR' }] } }
		removeIRtype(j)
		test.deepEqual(j.types, ['canonical', 'a5ss'], 'removes IR from types')
		test.deepEqual(j.info.events, [{ type: 'a5ss' }], 'removes the IR event')
	}
	{
		const j: any = { types: ['na', 'IR'], info: { events: [{ type: 'IR' }] } }
		removeIRtype(j)
		test.deepEqual(j.types, ['na'], 'leaves na')
		test.equal(j.info.events, undefined, 'removes events when none is left')
	}
	test.end()
})

tape('getJunctionData: reformats sn2rc for termdb.matrix', async test => {
	const tw = {
		$id: 'junction-1',
		term: { type: 'junction', chr: 'chr1', start: 100, stop: 200, strand: '+' },
		q: { readcountCutoff: 3 }
	}
	const result = await getJunctionData(
		{ terms: [tw], filter: { type: 'tvslst', lst: [] }, sampleTypes: [1] },
		async (query, keepList) => {
			test.notOk(
				'sampleTypes' in query,
				'should not read the sample types of the request, which may be for other terms'
			)
			test.deepEqual(query.rglst, [{ chr: 'chr1', start: 100, stop: 200 }], 'queries the junction region')
			test.equal(query.readcountCutoff, 3, 'passes the term read-count cutoff')
			test.deepEqual(keepList, [{ start: 100, stop: 200, strand: '+' }], 'limits results to the selected junction')
			return {
				junctions: [{ start: 100, stop: 200, strand: '+', sn2rc: new Map([['sample-1', 12]]) }]
			}
		},
		{}
	)
	test.deepEqual(
		{ ...result.term2sample2value.get('junction-1') },
		{ 'sample-1': 12 },
		'returns sample-to-count values'
	)
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
				{ $id: 'relapse', term: { ...junction, sampleTypes: [3] } },
				{ $id: 'emptyTypes', term: { ...junction, sampleTypes: [] } }
			]
		},
		listJunctions,
		ds
	)
	test.deepEqual(
		{ ...result.term2sample2value.get('all') },
		{ 1: 5, 2: 7, 3: 9, 4: 1 },
		'a term without sample types reads every sample'
	)
	test.deepEqual({ ...result.term2sample2value.get('diagnosis') }, { 1: 5, 3: 9 }, 'a term reads only its sample types')
	test.deepEqual({ ...result.term2sample2value.get('relapse') }, { 2: 7 }, 'a second term selects its own sample types')
	test.deepEqual(
		{ ...result.term2sample2value.get('emptyTypes') },
		{ ...result.term2sample2value.get('all') },
		'empty sample types keep all source values'
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
	test.deepEqual({ ...uuids.term2sample2value.get('d') }, { 'uuid-a': 5 }, 'matches string sample ids as they are')
	const filteredSamples = await getJunctionData(
		{
			terms: [{ $id: 'd', term: junction }],
			filter: { type: 'tvslst', lst: [{ type: 'tvs', tvs: { term: { id: 'status' } } }] }
		},
		listJunctionsOf(
			new Map([
				[1, 5],
				[2, 7]
			])
		),
		{ cohort: { termdb: { filterSamples: async () => new Set([1]) } } }
	)
	test.deepEqual(
		{ ...filteredSamples.term2sample2value.get('d') },
		{ 1: 5 },
		'request filtering compares object keys with numeric sample IDs'
	)

	test.end()
})

/* test/tp/files/hg38/junction/test.junction.gz, of samples S1-S4, holds a junction:
- 1000-2000, canonical with IR: IR ratio in every sample, one of which has a read count of 5
- 3000-4000, canonical with a5ss and IR: IR ratio in 2 samples, after the value of a5ss
- 5000-6000, with only IR and no IR ratio in any sample, of the highest read count, 40
- 7000-8000, canonical with IR: IR ratio in 1 sample
*/
async function getJunctionQuery() {
	const ds: any = { label: 'test', queries: { junction: { file: 'files/hg38/junction/test.junction.gz' } } }
	const genome = { chrlookup: { CHR17: { name: 'chr17', len: 83257441 } } }
	await validate_query_junction(ds, genome)
	return ds.queries.junction
}
async function listJunctions(q, param = {}) {
	const result = await q.listJunctions({ rglst: [{ chr: 'chr17', start: 0, stop: 10000 }], ...param })
	return {
		maxReadCount: result.maxReadCount,
		byStart: new Map(result.junctions.map(j => [j.start, j]))
	}
}

tape('listJunctions: intron retention', async test => {
	const q = await getJunctionQuery()
	{
		const { byStart, maxReadCount } = await listJunctions(q)
		const a: any = byStart.get(1000)
		test.deepEqual(a.types, ['canonical', 'IR'], 'lists IR in types')
		test.equal(a.IR.sampleCount, 4, 'counts the samples with an IR ratio')
		test.ok(Math.abs(a.IR.medianRatio - 0.3) < 1e-9, 'median of an even number of IR ratios')
		test.equal(a.sampleCount, 4, 'counts the samples of the junction')
		const b: any = byStart.get(3000)
		test.deepEqual(b.IR, { sampleCount: 2, medianRatio: 0.4 }, 'reads the IR ratio after the value of another event')
		const c: any = byStart.get(5000)
		test.deepEqual(c.types, ['na'], 'removes IR from types when no sample has an IR ratio')
		test.equal(c.IR, undefined, 'has no IR summary then')
		test.equal(c.info.events, undefined, 'removes the IR event then')
		const d: any = byStart.get(7000)
		test.deepEqual(d.IR, { sampleCount: 1, medianRatio: 0.25 }, 'the median of one IR ratio is that ratio')
		test.equal(maxReadCount, 40, 'max read count of all junctions')
	}
	{
		const { byStart } = await listJunctions(q, { readcountCutoff: 10 })
		const a: any = byStart.get(1000)
		test.deepEqual(
			a.IR,
			{ sampleCount: 3, medianRatio: 0.2 },
			'counts the IR ratio of a sample only when its read count passes the cutoff'
		)
		test.equal(byStart.get(3000), undefined, 'skips a junction with no sample passing the cutoff')
	}
	{
		const { byStart } = await listJunctions(q, { hiddenTypes: 'a5ss' })
		const b: any = byStart.get(3000)
		test.deepEqual(b.types, ['canonical', 'IR'], 'a5ss is hidden')
		test.deepEqual(b.IR, { sampleCount: 2, medianRatio: 0.4 }, 'still reads the IR ratio of each sample at its place')
	}
	{
		const { byStart } = await listJunctions(q, { hiddenTypes: 'IR' })
		for (const j of byStart.values() as any) {
			if (j.types.includes('IR') || j.IR) test.fail(`a junction at ${j.start} has IR while IR is hidden`)
		}
		test.deepEqual((byStart.get(5000) as any).types, ['na'], 'a junction with only IR is na')
	}
	{
		const { byStart, maxReadCount } = await listJunctions(q, { hiddenTypes: 'na' })
		test.equal(byStart.get(5000), undefined, 'skips a junction left with no type after removing IR')
		test.equal(maxReadCount, 30, 'the max read count is of the junctions returned')
	}
	test.end()
})

tape('getJunctionData: IR ratio of a junction term of measure IR', async test => {
	const q = await getJunctionQuery()
	const term = { type: 'junction', chr: 'chr17', start: 3000, stop: 4000, strand: '+' }
	const get = async (terms: any[], param = {}) => (await q.get({ terms, ...param })).term2sample2value
	{
		const data = await get([
			{ $id: 'rc', term },
			{ $id: 'ir', term: { ...term, measure: 'IR' } }
		])
		test.deepEqual(data.get('rc'), { S1: 8, S2: 6, S4: 9 }, 'a term without measure reads the read counts')
		test.deepEqual(
			data.get('ir'),
			{ S1: 0.3, S2: 0, S4: 0.5 },
			'reads the IR ratio after the value of another event, 0 for a sample of the junction with none'
		)
	}
	{
		const data = await get([{ $id: 'ir', term: { ...term, start: 1000, stop: 2000, measure: 'IR' } }], {
			readcountCutoff: 10
		})
		test.deepEqual(
			data.get('ir'),
			{ S1: 0.2, S2: 0.4, S4: 0.1 },
			'reads the IR ratio of a sample only when its read count passes the cutoff'
		)
	}
	{
		const data = await get([{ $id: 'ir', term: { ...term, start: 5000, stop: 6000, measure: 'IR' } }])
		test.deepEqual(data.get('ir'), { S1: 0, S2: 0 }, 'every sample of the junction has 0 when none retains the intron')
	}
	{
		// a junction that is found, with read counts but no IR event, so listJunctions() gives no sn2ir
		const listJunctions = async () => ({
			junctions: [{ start: 100, stop: 200, strand: '+', sn2rc: new Map([['sample-1', 12]]) }]
		})
		const result = await getJunctionData(
			{
				terms: [
					{ $id: 'ir', term: { type: 'junction', chr: 'chr1', start: 100, stop: 200, strand: '+', measure: 'IR' } }
				]
			},
			listJunctions,
			{}
		)
		test.deepEqual(result.term2sample2value.get('ir'), {}, 'a junction with no IR event has no IR ratio')
	}
	try {
		await get([{ $id: 'x', term: { ...term, measure: 'exonskip' } }])
		test.fail('should throw on an unsupported measure')
	} catch (e: any) {
		test.ok(
			String(e.message || e).includes("invalid junction term measure='exonskip'"),
			'throws on an unsupported measure'
		)
	}
	test.end()
})
