import tape from 'tape'
import { tid2value2filter, combinePPfilterAndTid2value } from '../mds3.filter.js'
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
/**************
 helpers
***************/
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
