import tape from 'tape'
import { tid2value2filter, combinePPfilterAndTid2value, mayLimitSamples } from '../mds3.filter.js'
/*
test sections:
tid2value2filter - empty tid2value
tid2value2filter - single term
tid2value2filter - multiple terms (AND join)
tid2value2filter - unknown term id is skipped
combinePPfilterAndTid2value - no inputs returns undefined
combinePPfilterAndTid2value - filter only
combinePPfilterAndTid2value - filterObj only
combinePPfilterAndTid2value - tid2value only
combinePPfilterAndTid2value - filter + tid2value combined
combinePPfilterAndTid2value - filterObj + filter + tid2value combined
mayLimitSamples - sampleTypes filters samples
mayLimitSamples - sampleTypes intersects sample filters
mayLimitSamples - sampleTypes applies with only filter0 on a sqlite dataset
mayLimitSamples - omitted sampleTypes does not filter
mayLimitSamples - skipSampleFiltering defers filtering
*/
tape('\n', function (test) {
	test.comment('-***- src/mds3.filter specs -***-')
	test.end()
})
tape('tid2value2filter - empty tid2value', function (test) {
	const ds = getMockDs({})
	const f = tid2value2filter({}, ds)
	test.deepEqual(
		f,
		{ type: 'tvslst', in: true, join: 'and', lst: [] },
		'should return an empty tvslst when tid2value is empty'
	)
	test.end()
})
tape('tid2value2filter - single term', function (test) {
	const term = { id: 'sex', type: 'categorical' }
	const ds = getMockDs({ sex: term })
	const f = tid2value2filter({ sex: 'M' }, ds)
	test.deepEqual(
		f,
		{
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [makeTvs(term, 'M')]
		},
		'should wrap a single tid2value entry into one tvs in a tvslst'
	)
	test.end()
})
tape('tid2value2filter - multiple terms (AND join)', function (test) {
	const termA = { id: 'sex', type: 'categorical' }
	const termB = { id: 'race', type: 'categorical' }
	const ds = getMockDs({ sex: termA, race: termB })
	const f = tid2value2filter({ sex: 'F', race: 'white' }, ds)
	test.equal(f.join, 'and', 'should join multiple entries with "and"')
	test.equal(f.lst.length, 2, 'should produce one tvs per tid2value entry')
	test.deepEqual(f.lst[0], makeTvs(termA, 'F'), 'first tvs should match first entry')
	test.deepEqual(f.lst[1], makeTvs(termB, 'white'), 'second tvs should match second entry')
	test.end()
})
tape('tid2value2filter - unknown term id is skipped', function (test) {
	const term = { id: 'sex', type: 'categorical' }
	// only "sex" is known; "bogus" will return undefined from termjsonByOneid
	const ds = getMockDs({ sex: term })
	const f = tid2value2filter({ sex: 'M', bogus: 'x' }, ds)
	test.equal(f.lst.length, 1, 'unknown term ids should be silently skipped')
	test.deepEqual(f.lst[0], makeTvs(term, 'M'), 'only the known term should be present')
	test.end()
})
tape('combinePPfilterAndTid2value - no inputs returns undefined', function (test) {
	const ds = getMockDs({})
	const result = combinePPfilterAndTid2value({}, ds)
	test.equal(result, undefined, 'should return undefined when no filter constructs are present')
	test.end()
})
tape('combinePPfilterAndTid2value - filter only', function (test) {
	const ds = getMockDs({})
	const filter = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: { term: { id: 'sex', type: 'categorical' }, values: [{ key: 'M' }] }
			}
		]
	}
	const result = combinePPfilterAndTid2value({ filter }, ds)
	test.deepEqual(result, filter, 'should return the single pp filter unchanged')
	test.end()
})
tape('combinePPfilterAndTid2value - filterObj only', function (test) {
	const ds = getMockDs({})
	const filterObj = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: { term: { id: 'race', type: 'categorical' }, values: [{ key: 'white' }] }
			}
		]
	}
	const result = combinePPfilterAndTid2value({ filterObj }, ds)
	test.deepEqual(result, filterObj, 'should return the single filterObj unchanged')
	test.end()
})
tape('combinePPfilterAndTid2value - tid2value only', function (test) {
	const term = { id: 'sex', type: 'categorical' }
	const ds = getMockDs({ sex: term })
	const result = combinePPfilterAndTid2value({ tid2value: { sex: 'M' } }, ds)
	test.deepEqual(
		result,
		{
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [makeTvs(term, 'M')]
		},
		'should return the filter derived from tid2value when it is the only input'
	)
	test.end()
})
tape('combinePPfilterAndTid2value - filter + tid2value combined', function (test) {
	const term = { id: 'sex', type: 'categorical' }
	const ds = getMockDs({ sex: term })
	const filter = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: { term: { id: 'race', type: 'categorical' }, values: [{ key: 'white' }] }
			}
		]
	}
	const result = combinePPfilterAndTid2value({ filter, tid2value: { sex: 'M' } }, ds)
	test.ok(result, 'should return a combined filter object')
	test.equal(result.type, 'tvslst', 'combined filter should be tvslst')
	test.equal(result.join, 'and', 'combined filter should be joined with "and"')
	test.equal(result.lst.length, 2, 'combined filter should hold both tvs items')
	// the race tvs (from filter) should be present
	const hasRace = result.lst.some((it: any) => it?.tvs?.term?.id === 'race' && it?.tvs?.values?.[0]?.key === 'white')
	test.ok(hasRace, 'combined filter should include the race tvs from the pp filter')
	// the sex tvs (from tid2value) should be present
	const hasSex = result.lst.some((it: any) => it?.tvs?.term?.id === 'sex' && it?.tvs?.values?.[0]?.key === 'M')
	test.ok(hasSex, 'combined filter should include the sex tvs from tid2value')
	test.end()
})
tape('combinePPfilterAndTid2value - filterObj + filter + tid2value combined', function (test) {
	const termSex = { id: 'sex', type: 'categorical' }
	const ds = getMockDs({ sex: termSex })
	const filterObj = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: { term: { id: 'race', type: 'categorical' }, values: [{ key: 'white' }] }
			}
		]
	}
	const filter = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: { term: { id: 'diagnosis', type: 'categorical' }, values: [{ key: 'ALL' }] }
			}
		]
	}
	const result = combinePPfilterAndTid2value({ filterObj, filter, tid2value: { sex: 'F' } }, ds)
	test.ok(result, 'should return a combined filter object')
	test.equal(result.type, 'tvslst', 'combined filter should be tvslst')
	test.equal(result.join, 'and', 'combined filter should be joined with "and"')
	test.equal(result.lst.length, 3, 'combined filter should hold tvs items from all three sources')
	const ids = result.lst.map((it: any) => it?.tvs?.term?.id).sort()
	test.deepEqual(
		ids,
		['diagnosis', 'race', 'sex'],
		'combined filter should include tvs from filterObj, filter, and tid2value'
	)
	test.end()
})
tape('mayLimitSamples - skipSampleFiltering defers filtering', async function (test) {
	let filterCalls = 0
	let validationCalls = 0
	const ds = {
		sampleId2Type: new Map([
			[10, 1],
			[11, 2]
		]),
		validate_filter0: filter => {
			validationCalls++
			return filter
		},
		cohort: {
			termdb: {
				filterSamples: async () => {
					filterCalls++
					return new Set([10, 11])
				}
			}
		}
	}
	const param = {
		sampleTypes: [1],
		filterObj: { type: 'tvslst', lst: [makeTvs({ id: 'sex', type: 'categorical' }, 'M')] },
		filter0: { cohort: 'hidden' }
	}
	test.equal(
		await mayLimitSamples({ ...param, skipSampleFiltering: true }, [10], ds),
		undefined,
		'skip flag returns no restriction even with filters and a supplied sample list'
	)
	test.equal(validationCalls, 0, 'deferred filters are not validated here')
	test.equal(filterCalls, 0, 'deferred filters are not queried here')
	for (const skipSampleFiltering of [false, undefined]) {
		test.deepEqual(
			await mayLimitSamples({ ...param, skipSampleFiltering }, [10], ds),
			new Set([10]),
			'false or absent flag preserves filtering and sample intersection'
		)
	}
	test.equal(validationCalls, 2, 'normal calls still validate the hidden filter')
	test.equal(filterCalls, 2, 'normal calls still query matching samples')
	test.end()
})
tape('mayLimitSamples - sampleTypes filters samples', async function (test) {
	const ds = getMockSampleTypeDs()
	const result = await mayLimitSamples({ sampleTypes: [1] }, null, ds)
	test.deepEqual(result, new Set([10, 12]), 'selects dataset samples of the requested type')
	const limited = await mayLimitSamples({ sampleTypes: [1] }, [12, 13], ds)
	test.deepEqual(limited, new Set([12]), 'restricts the supplied integer sample list')
	test.deepEqual(
		await mayLimitSamples({ sampleTypes: [2] }, [{ name: 10 }, { name: 11 }], ds),
		new Set([11]),
		'restricts samples from file headers'
	)
	test.deepEqual(
		await mayLimitSamples({ sampleTypes: [1, 2] }, null, ds),
		new Set([10, 11, 12, 13]),
		'accepts multiple sample types'
	)
	test.deepEqual(
		await mayLimitSamples({ sampleTypes: [3] }, null, ds),
		new Set(),
		'returns an empty set when no sample types match'
	)
	test.deepEqual(
		await mayLimitSamples({ sampleTypes: [1] }, [], ds),
		new Set(),
		'preserves an empty supplied sample list'
	)
	test.end()
})
tape('mayLimitSamples - sampleTypes intersects sample filters', async function (test) {
	const matchingSamples = new Set([10, 11, 12])
	const ds = {
		...getMockSampleTypeDs(),
		cohort: { termdb: { filterSamples: async () => matchingSamples } }
	}
	const filterObj = { type: 'tvslst', lst: [makeTvs({ id: 'sex', type: 'categorical' }, 'M')] }
	test.deepEqual(
		await mayLimitSamples({ sampleTypes: [1], filterObj }, [11, 12, 13], ds),
		new Set([12]),
		'intersects sample types, sample filters and supplied samples'
	)
	test.deepEqual(matchingSamples, new Set([10, 11, 12]), 'does not mutate the filter result')
	test.deepEqual(
		await mayLimitSamples({ sampleTypes: [], filterObj }, [11, 12, 13], ds),
		new Set([11, 12]),
		'empty sampleTypes preserves existing filtering'
	)
	test.deepEqual(
		await mayLimitSamples({ sampleTypes: [2], filterObj }, [10, 12], ds),
		new Set(),
		'returns an empty intersection when no supplied samples match the type'
	)
	test.end()
})
tape('mayLimitSamples - sampleTypes applies with only filter0 on a sqlite dataset', async function (test) {
	const ds = {
		...getMockSampleTypeDs(),
		cohort: { db: {} },
		validate_filter0: filter => filter
	}
	test.deepEqual(
		await mayLimitSamples({ sampleTypes: [1], filter0: {} }, null, ds),
		new Set([10, 12]),
		'does not bypass type selection when there is no pp filter'
	)
	test.end()
})
tape('mayLimitSamples - omitted sampleTypes does not filter', async function (test) {
	const ds = getMockSampleTypeDs()
	test.equal(await mayLimitSamples({}, null, ds), undefined, 'should return undefined when sampleTypes is omitted')
	test.equal(
		await mayLimitSamples({ sampleTypes: null }, null, ds),
		undefined,
		'should return undefined when sampleTypes is null'
	)
	test.equal(await mayLimitSamples({ sampleTypes: [] }, [12, 13], ds), undefined, 'empty types do not filter samples')
	test.end()
})
/**************
 helpers
***************/
// build a minimal ds mock with sampleId2Type and no filtering method
function getMockSampleTypeDs() {
	return {
		cohort: {},
		sampleId2Type: new Map([
			[10, 1],
			[11, 2],
			[12, 1],
			[13, 2]
		])
	}
}
// build a minimal ds mock supplying termjsonByOneid()
function getMockDs(terms: { [id: string]: any }) {
	return {
		cohort: {
			termdb: {
				q: {
					termjsonByOneid(id: string) {
						return terms[id]
					}
				}
			}
		}
	}
}
// build a sample categorical tvs (matching shape produced by tid2value2filter)
function makeTvs(term: any, key: any) {
	return {
		type: 'tvs',
		tvs: {
			term,
			values: [{ key }]
		}
	}
}
