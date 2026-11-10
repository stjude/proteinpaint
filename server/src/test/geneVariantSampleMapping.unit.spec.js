import tape from 'tape'
import Database from 'better-sqlite3'
import { mayAdd_mayGetGeneVariantData } from '../mds3.init.js'
import { getData, mayMapNonDictionaryData } from '../termdb.matrix.ts'
import { getFilterCTEs } from '../termdb.filter.js'
import { mayLimitSamples } from '../mds3.filter.js'
import { getAuthApi, authApi } from '../auth.js'
import { guardDb, sql } from '../sql.ts'

function makeDs() {
	const connection = guardDb(new Database(':memory:'), 'off')
	connection.exec(`
		CREATE TABLE sampleidmap (id INTEGER, name TEXT, sample_type INTEGER);
		CREATE TABLE sample_ancestry (sample_id INTEGER, ancestor_id INTEGER);
		CREATE TABLE anno_categorical (sample INTEGER, term_id TEXT, value TEXT);
		INSERT INTO sampleidmap VALUES (10,'p1',1),(11,'p2',1),
			(20,'c1',2),(21,'c2',2),(22,'c3',2),(30,'sister',3);
		INSERT INTO sample_ancestry VALUES (20,10),(21,10),(22,11),(30,10);
		INSERT INTO anno_categorical VALUES (20,'status','keep'),(21,'status','drop'),
			(22,'status','drop'),(10,'parentStatus','keep'),(11,'parentStatus','drop');
	`)
	const ds = {
		label: 'VariantMapping',
		genomename: 'hg38',
		sampleId2Type: new Map([
			[10, 1],
			[11, 1],
			[20, 2],
			[21, 2],
			[22, 2],
			[30, 3]
		]),
		cohort: {
			db: { connection },
			termdb: {
				hasSampleAncestry: true,
				term2SampleType: new Map(),
				sampleTypes: {
					1: { name: 'Parent', plural_name: 'Parents', parent_id: null },
					2: { name: 'Child', plural_name: 'Children', parent_id: 1 },
					3: { name: 'Sister', plural_name: 'Sisters', parent_id: 1 }
				},
				q: {
					id2sampleName: id => `sample-${id}`,
					id2rootSampleId: id => (id < 20 ? id : id === 22 ? 11 : 10)
				}
			}
		},
		queries: {}
	}
	return { ds, connection }
}

function makeTw(sampleTypes = [2]) {
	return {
		$id: 'variant',
		term: {
			type: 'geneVariant',
			name: 'G',
			sampleTypes,
			genes: [
				{
					type: 'geneVariant',
					kind: 'gene',
					id: 'G',
					gene: 'G',
					name: 'G',
					isoform: 'I',
					chr: 'chr1',
					start: 0,
					stop: 100
				}
			]
		},
		q: { type: 'values' }
	}
}

function filter(key = 'keep', sampleType = 2) {
	return {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: {
						id: sampleType === 1 ? 'parentStatus' : 'status',
						name: 'Status',
						type: 'categorical',
						sampleTypes: [sampleType]
					},
					values: [{ key }]
				}
			}
		]
	}
}

function mutation(dt, ids) {
	return {
		dt,
		class: dt === 4 ? 'CNV_amp' : dt === 2 ? 'Fuserna' : dt === 5 ? 'SV' : dt === 6 ? 'ITD' : 'M',
		mname: 'event',
		pos: 10,
		start: 10,
		stop: 30,
		value: 3,
		pairlst: [{ a: { chr: 'chr1', pos: 10 }, b: { chr: 'chr2', pos: 40 } }],
		pairlstIdx: 0,
		samples: ids.map(id => ({ sample_id: id, formatK2v: { TumorAC: `${id},5` } }))
	}
}

function installGetter(ds, source, ids, getRecords) {
	const calls = []
	const dt = { byrange: 1, byisoform: 1, fusion: 2, sv: 5, cnv: 4, geneCnv: 4, itd: 6 }[source]
	const record = mutation(dt, ids)
	const getter = async q => {
		calls.push(q)
		const variants = getRecords ? getRecords(q, record) : [record]
		const limit = await mayLimitSamples(q, null, ds)
		const result = limit
			? variants
					.map(v => ({ ...v, samples: v.samples.filter(s => limit.has(s.sample_id)) }))
					.filter(v => v.samples.length)
			: variants
		return source === 'cnv' ? { cnvs: result } : source === 'itd' ? { itds: result } : result
	}
	if (source === 'byrange' || source === 'byisoform') ds.queries.snvindel = { [source]: { get: getter } }
	else if (source === 'fusion' || source === 'sv') ds.queries.svfusion = { dtLst: [dt], byrange: { get: getter } }
	else if (source === 'geneCnv') ds.queries.geneCnv = { bygene: { get: getter } }
	else ds.queries[source] = { get: getter }
	mayAdd_mayGetGeneVariantData(ds, {})
	return { calls, record }
}

async function mapBatchSamples(tw, q, ds, source) {
	let values = new Map(
		[...source].filter(
			([sid]) =>
				!tw.term.sampleTypes?.length || !ds.sampleId2Type || tw.term.sampleTypes.includes(ds.sampleId2Type.get(sid))
		)
	)
	const input = Object.create(null)
	for (const [sid, value] of values) input[sid] = value
	const mapped = await mayMapNonDictionaryData(tw, { ...q, ds }, input)
	const isMapped = mapped !== input
	if (isMapped) values = new Map(Object.entries(mapped).map(([sid, value]) => [Number(sid), value]))
	else values = new Map([...values].map(([sid]) => [sid, mapped[sid]]))
	const limitSamples = await mayLimitSamples(q, null, ds)
	if (limitSamples) values = new Map([...values].filter(([sid]) => limitSamples.has(sid)))
	return values
}

for (const source of ['byrange', 'byisoform', 'fusion', 'sv', 'cnv', 'geneCnv', 'itd']) {
	tape(`geneVariant mapping: ${source} selects sources, maps and filters target IDs`, async t => {
		const { ds, connection } = makeDs()
		try {
			for (const down of [false, true]) {
				ds.queries = {}
				const sourceIds = down ? [10, 11, 30] : [20, 21, 22, 30]
				const { calls, record } = installGetter(ds, source, sourceIds)
				const before = structuredClone(record)
				const tw = makeTw([down ? 1 : 2])
				const q = { sampleMapping: down ? 'parentToChildren' : 'childrenToParent', sampleTypes: [down ? 2 : 1] }
				const data = await ds.mayGetGeneVariantData(tw, q)
				t.deepEqual([...data.keys()], down ? [20, 21, 22] : [10, 11], 'only related target sample types returned')
				t.equal(data.get(down ? 20 : 10).sample, down ? 20 : 10, 'outer sample is the target ID')
				t.equal(
					data.get(down ? 20 : 10).variant.values[0].TumorAC,
					`${sourceIds[0]},5`,
					'source format fields are intact'
				)
				if (!down) t.equal(data.get(10).variant.values.length, 1, 'multiple children retain one complete annotation')
				const aligned = await ds.mayGetGeneVariantData(tw, {})
				t.deepEqual(
					[...aligned.keys()],
					sourceIds.filter(id => id !== 30),
					'source types restrict unmapped data'
				)
				const filtered = await ds.mayGetGeneVariantData(tw, { ...q, filter: filter() })
				t.deepEqual([...filtered.keys()], [down ? 20 : 10], 'target filter does not discard source data prematurely')
				t.deepEqual(calls.at(-1).filterObj, filter(), 'target filter is passed into variant getter')
				t.equal(calls.at(-1).sampleMapping, q.sampleMapping, 'variant getter receives mapping direction')
				t.equal(calls.at(-1).skipSampleFiltering, true, 'variant getter is told to defer sample filtering')
				const excluded = await ds.mayGetGeneVariantData(tw, { ...q, filter: filter('absent') })
				t.equal(excluded.size, 0, 'excluding all targets returns an empty Map')
				const empty = await ds.mayGetGeneVariantData(tw, { ...q, filter: { type: 'tvslst', lst: [] } })
				t.deepEqual([...empty.keys()], [...data.keys()], 'empty filter preserves all mapped samples')
				t.deepEqual(record, before, 'source records are not mutated')
				t.notOk(Object.hasOwn(q, 'filter'), 'original query is not mutated')
			}
		} finally {
			connection.close()
		}
		t.end()
	})
}

tape('geneVariant mapping: getter receives hidden filters and request metadata', async t => {
	const { ds, connection } = makeDs()
	try {
		const q = {
			filter: filter(),
			filter0: { cohort: 'hidden' },
			sessionid: 'session',
			__protected__: { role: 'test' },
			__abortSignal: new AbortController().signal,
			token: 'test',
			sampleMapping: 'parentToChildren',
			sampleTypes: [2]
		}
		ds.validate_filter0 = value => value
		const { calls } = installGetter(ds, 'byisoform', [10])
		await ds.mayGetGeneVariantData(makeTw([1]), q)
		const source = calls[0]
		for (const key of ['filter0', 'sessionid', '__protected__', '__abortSignal', 'token'])
			t.equal(source[key], q[key], `${key} is retained`)
		t.equal(source.filterObj, q.filter, 'original filter is not cleared')
		t.equal(source.sampleMapping, q.sampleMapping, 'mapping is not cleared')
		t.equal(source.skipSampleFiltering, true, 'sample filtering is deferred without rewriting query context')
	} finally {
		connection.close()
	}
	t.end()
})

tape('geneVariant mapping: assay availability is selected and mapped with mutations', async t => {
	const { ds, connection } = makeDs()
	try {
		installGetter(ds, 'byisoform', [20])
		ds.assayAvailability = {
			byDt: {
				1: {
					byOrigin: {
						somatic: {
							bySampleType: {
								2: { yesSamples: new Set([20, 21]), noSamples: new Set([22]) },
								3: { yesSamples: new Set([30]), noSamples: new Set() }
							}
						}
					}
				}
			}
		}
		const snapshot = structuredClone(ds.assayAvailability)
		const tw = makeTw()
		const q = { sampleMapping: 'childrenToParent', sampleTypes: [1] }
		const data = await ds.mayGetGeneVariantData(tw, q)
		t.deepEqual([...data.keys()], [10, 11], 'availability contributes only selected source types')
		t.equal(data.get(10).variant.values[0].class, 'M', 'first child mutation retained over other child status')
		t.equal(data.get(11).variant.values[0].class, 'Blank', 'not-tested child maps to parent')
		t.equal(data.get(11).variant.values[0].origin, 'somatic', 'origin is preserved')
		t.equal(data.get(11).variant.values[0]._SAMPLEID_, 22, 'status source provenance is preserved')
		const disabled = await ds.mayGetGeneVariantData(tw, { ...q, disableAssayAvailability: true })
		t.deepEqual([...disabled.keys()], [10], 'availability disable flag is preserved')
		installGetter(ds, 'byisoform', [])
		const wt = await ds.mayGetGeneVariantData(tw, { ...q, filter: filter() })
		t.deepEqual([...wt.keys()], [10], 'empty mutation data still maps and filters availability')
		t.equal(wt.get(10).variant.values[0].class, 'WT', 'assayed source without mutations remains WT')
		t.deepEqual(ds.assayAvailability, snapshot, 'cached availability sets are unchanged')
		const empty = await ds.mayGetGeneVariantData(tw, { ...q, disableAssayAvailability: true })
		t.equal(empty.size, 0, 'empty data without availability remains empty')
		ds.assayAvailability.byDt[1] = {
			bySampleType: {
				1: { yesSamples: new Set([10]), noSamples: new Set([11]) },
				3: { yesSamples: new Set([30]), noSamples: new Set() }
			}
		}
		const children = await ds.mayGetGeneVariantData(makeTw([1]), {
			sampleMapping: 'parentToChildren',
			sampleTypes: [2],
			filter: filter()
		})
		t.deepEqual([...children.keys()], [20], 'availability without origins maps downward before target filtering')
		t.equal(children.get(20).variant.values[0].class, 'WT', 'parent status is copied to selected child')
	} finally {
		connection.close()
	}
	t.end()
})

function groupset() {
	return {
		groups: [
			{
				name: 'Chosen',
				type: 'filter',
				filter: {
					type: 'tvslst',
					in: true,
					join: '',
					lst: [
						{
							type: 'tvs',
							tvs: { term: { type: 'dtsnvindel', dt: 1 }, values: [{ key: 'M' }], genotype: 'variant', mcount: 'any' }
						}
					]
				}
			}
		]
	}
}

tape('geneVariant mapping: groups are evaluated on source samples before mapping the complete annotation', async t => {
	const { ds, connection } = makeDs()
	try {
		installGetter(ds, 'byisoform', [20, 21])
		const tw = makeTw()
		tw.term.genes.push({ ...tw.term.genes[0], id: 'H', gene: 'H', name: 'H' })
		tw.term.groupsetting = { disabled: false, lst: [groupset()] }
		const q = { sampleMapping: 'childrenToParent', sampleTypes: [1] }
		for (const mode of [
			{ type: 'custom-groupset', customset: groupset() },
			{ type: 'predefined-groupset', predefined_groupset_idx: 0 }
		]) {
			tw.q = mode
			const data = await ds.mayGetGeneVariantData(tw, q)
			t.equal(data.get(10).variant.key, 'Chosen', `${mode.type}: target receives selected group`)
			t.deepEqual(
				data.get(10).variant.values.map(v => v.gene),
				['G', 'H'],
				'first child has complete geneset, not combined children'
			)
		}
		installGetter(ds, 'byisoform', [20, 21], (q, record) => [
			{ ...record, class: 'N', samples: [record.samples[0]] },
			{ ...record, samples: [record.samples[1]] }
		])
		const grouped = await ds.mayGetGeneVariantData(tw, q)
		t.deepEqual([...grouped.keys()], [10], 'matching second child is available when the first child has no group')
		t.equal(grouped.get(10).sample, 10, 'mapped grouped annotation stores the target sample ID')
		t.equal(grouped.get(10).variant.key, 'Chosen', 'group assignment survives mapping')
		t.ok(
			grouped.get(10).variant.values.every(v => v.TumorAC === '21,5'),
			'mapped values belong to the matching source'
		)
		const filtered = await ds.mayGetGeneVariantData(tw, { ...q, filter: filter() })
		t.deepEqual([...filtered.keys()], [10], 'target filtering follows source group assignment and mapping')
	} finally {
		connection.close()
	}
	t.end()
})

tape('geneVariant mapping: outer pipeline selects one complete source annotation across getters and genes', async t => {
	const { ds, connection } = makeDs()
	try {
		installGetter(ds, 'byisoform', [20, 21], (q, record) => [
			{ ...record, samples: [record.samples[q.isoform === 'I' ? 0 : 1]] }
		])
		installGetter(ds, 'cnv', [21])
		const tw = makeTw()
		tw.term.genes.push({ ...tw.term.genes[0], id: 'H', gene: 'H', name: 'H', isoform: 'J' })
		const data = await ds.mayGetGeneVariantData(tw, { sampleMapping: 'childrenToParent', sampleTypes: [1] })
		t.deepEqual([...data.keys()], [10], 'source data maps to one parent')
		t.deepEqual(
			data.get(10).variant.values.map(v => [v.gene, v.dt, v.TumorAC]),
			[['G', 1, '20,5']],
			'selected child annotation is not combined with another child across genes or data types'
		)
	} finally {
		connection.close()
	}
	t.end()
})

tape('geneVariant mapping: DT and legacy variant filters consume getter-mapped IDs', async t => {
	const { ds, connection } = makeDs()
	try {
		installGetter(ds, 'byisoform', [20, 21])
		const parentTerm = makeTw().term
		for (const tvs of [
			{ term: { type: 'dtsnvindel', dt: 1, parentTerm }, values: [{ key: 'M' }], genotype: 'variant', mcount: 'any' },
			{ term: parentTerm, values: [{ dt: 1, mclassExcludeLst: [] }] }
		]) {
			const cte = await getFilterCTEs(
				{ type: 'tvslst', in: true, lst: [{ type: 'tvs', tvs }] },
				ds,
				'childrenToParent',
				[1]
			)
			const rows = connection.prepare(sql`WITH ${cte.filters} SELECT sample FROM ${sql.id(cte.CTEname)}`).all()
			t.deepEqual(
				rows.map(row => row.sample),
				[10],
				`${tvs.term.type} returns target IDs exactly once`
			)
		}
	} finally {
		connection.close()
	}
	t.end()
})

tape('geneVariant mapping: remote string IDs and hidden filters keep existing behavior', async t => {
	const calls = []
	const ds = {
		cohort: {
			termdb: {
				filterSamples: async q => {
					calls.push(q)
					return new Set(['case-a'])
				}
			}
		},
		validate_filter0: value => value,
		queries: {
			snvindel: {
				byisoform: {
					get: async q => {
						const limit = await mayLimitSamples(q, null, ds)
						const record = mutation(1, ['case-a', 'case-b'])
						return [{ ...record, samples: record.samples.filter(s => !limit || limit.has(s.sample_id)) }]
					}
				}
			}
		}
	}
	mayAdd_mayGetGeneVariantData(ds, {})
	const tw = makeTw()
	const data = await ds.mayGetGeneVariantData(tw, { filter0: { cohort: 'hidden' } })
	t.deepEqual([...data.keys()], ['case-a'], 'remote string IDs remain strings and respect hidden scope')
	t.equal(data.get('case-a').sample, 'case-a', 'remote outer ID is unchanged')
	t.deepEqual(calls[0].filter0, { cohort: 'hidden' }, 'remote hidden filter is passed through')
	t.end()
})

tape('geneVariant mapping: object collection preserves unmapped sample ID types', async t => {
	const ids = [7, '008', '__proto__']
	const ds = {
		cohort: { termdb: {} },
		queries: { snvindel: { byisoform: { get: async () => [mutation(1, ids)] } } }
	}
	mayAdd_mayGetGeneVariantData(ds, {})
	const data = await ds.mayGetGeneVariantData(makeTw(), {})
	t.deepEqual([...data.keys()], ids, 'numeric, numeric-looking and prototype-named IDs retain their types')
	for (const id of ids) {
		t.equal(data.get(id).sample, id, 'outer sample ID matches its Map key')
		t.equal(data.get(id).variant.values[0].TumorAC, `${id},5`, 'object collection preserves sample values')
	}
	t.end()
})

tape('geneVariant mapping: matrix infers mapping and batch processing preserves dictionary annotations', async t => {
	if (!authApi) await getAuthApi({ doNotFreezeAuthApi: true, get() {}, post() {}, all() {}, use() {} }, {}, {}, true)
	const { ds, connection } = makeDs()
	try {
		installGetter(ds, 'byisoform', [20, 21, 22, 30])
		const dict = { $id: 'status', term: { id: 'status', type: 'categorical', name: 'Status', sampleTypes: [2] }, q: {} }
		const variant = makeTw([3])
		let data = await getData({ terms: [dict, variant] }, ds)
		t.notOk(data.error, 'mixed sibling types infer upward mapping')
		t.deepEqual(Object.keys(data.samples), ['10', '11'], 'dictionary and variants share target rows')
		t.equal(data.samples[10].variant.values[0].TumorAC, '30,5', 'selected sister-type source mapped')
		t.equal(data.refs.bySampleId[10].label, 'sample-10', 'references describe target IDs')

		let count = 0
		ds.queries.snvindel = {
			byisoform: {
				processTwsInOneQuery: true,
				get: async (q, tws, samples) => {
					count++
					t.ok(!q.filter || q.filter.lst.length, 'batch getter receives the original request filter')
					const source = new Map(
						[20, 21, 22, 30].map(id => [id, { key: 'G', values: [{ dt: 1, class: 'M', mname: `event-${id}` }] }])
					)
					for (const [id, value] of await mapBatchSamples(tws[0], q, ds, source))
						samples[id] = {
							...samples[id],
							sample: id,
							[tws[0].$id]: value,
							[tws[1].$id]: {
								key: 'H',
								values: [{ dt: 1, class: 'N', mname: value.values[0].mname.replace('event', 'other') }]
							}
						}
				}
			}
		}
		const tw = makeTw()
		const tw2 = { ...makeTw(), $id: 'other' }
		const dictionaryData = await getData({ terms: [dict], sampleMapping: 'childrenToParent', filter: filter() }, ds)
		data = await getData({ terms: [dict, tw, tw2], sampleMapping: 'childrenToParent', filter: filter() }, ds)
		t.notOk(data.error, 'batch request succeeds')
		t.equal(count, 1, 'all wrappers execute in one batch query')
		t.deepEqual(Object.keys(data.samples), ['10'], 'batch output is filtered in target space')
		t.deepEqual(
			data.samples[10].status,
			dictionaryData.samples[10].status,
			'dictionary annotation is preserved and not mapped again'
		)
		t.equal(data.samples[10].variant.values[0].mname, 'event-20', 'batch selects first child')
		t.equal(data.samples[10].other.values[0].mname, 'other-20', 'each batch term is mapped independently')
		t.equal(data.samples[10].sample, 10, 'batch outer sample is target ID')
		t.equal(data.refs.bySampleId[10].label, 'sample-10', 'batch references use target IDs')
		ds.cohort.termdb.hasSampleAncestry = false
		const aligned = await getData({ terms: [tw, tw2] }, ds)
		t.notOk(aligned.error, 'local batch works without hierarchy mapping')
		t.deepEqual(Object.keys(aligned.samples), ['20', '21', '22'], 'unmapped batch still selects source sample types')
	} finally {
		connection.close()
	}
	t.end()
})

tape('geneVariant mapping: legacy matrix output and non-hierarchical batch output remain compatible', async t => {
	if (!authApi) await getAuthApi({ doNotFreezeAuthApi: true, get() {}, post() {}, all() {}, use() {} }, {}, {}, true)
	const remoteDs = {
		cohort: { termdb: { q: { id2sampleName: id => id }, sampleTypes: {} } },
		queries: {
			snvindel: {
				byisoform: {
					processTwsInOneQuery: true,
					get: async (q, tws, samples) => {
						t.equal(q.filter0.cohort, 'hidden', 'non-hierarchical batch retains hidden filter')
						samples['case-a'] = { sample: 'case-a', [tws[0].$id]: { key: 'G', values: [{ dt: 1, class: 'M' }] } }
					}
				}
			}
		}
	}
	const remote = await getData({ terms: [makeTw()], filter0: { cohort: 'hidden' } }, remoteDs)
	t.notOk(remote.error, 'non-hierarchical batch keeps its existing direct path')
	t.deepEqual(Object.keys(remote.samples), ['case-a'], 'batch string IDs remain unchanged')
	t.equal(remote.samples['case-a'].variant.values[0].class, 'M', 'batch value shape is unchanged')
	t.end()
})
