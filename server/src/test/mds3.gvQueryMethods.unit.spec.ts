import tape from 'tape'
import { getGvQueryMethods } from '../mds3.gvQueryMethods.ts'

/*
Tests:
	getGvQueryMethods()
*/

tape('\n', test => {
	test.comment('-***- mds3.gvQueryMethods unit tests -***-')
	test.end()
})

tape('getGvQueryMethods()', test => {
	const gene = ['gene']
	const both = ['gene', 'coord']
	test.deepEqual(
		getGvQueryMethods({ snvindel: { byrange: {} }, svfusion: { byrange: {} }, cnv: {}, itd: {} } as any),
		{ snvindel: both, svfusion: both, cnv: both, itd: both },
		'every query takes a region when queried by range'
	)
	test.deepEqual(
		getGvQueryMethods({ snvindel: { byisoform: {} } } as any),
		{ snvindel: gene },
		'snvindel.byisoform without byrange takes no region, as a region has no gene to map to an isoform'
	)
	test.deepEqual(
		getGvQueryMethods({ snvindel: { byrange: {}, byisoform: {} } } as any),
		{ snvindel: both },
		'snvindel.byisoform with byrange takes a region, which byrange queries'
	)
	test.deepEqual(
		getGvQueryMethods({ svfusion: { byname: {} } } as any),
		{ svfusion: gene },
		'svfusion.byname without byrange takes no region, as it matches by gene name'
	)
	test.deepEqual(
		getGvQueryMethods({ svfusion: { byrange: {}, byname: {} } } as any),
		{ svfusion: gene },
		'svfusion.byname with byrange takes no region, as a region would miss the events of byname'
	)
	test.deepEqual(
		getGvQueryMethods({ snvindel: { byrange: {} }, cnv: {}, geneCnv: { bygene: {} } } as any),
		{ snvindel: both, cnv: gene },
		'cnv takes no region when gene-level geneCnv is queried instead, as for gdc, while snvindel still does'
	)
	test.deepEqual(
		getGvQueryMethods({ geneCnv: { bygene: {} } } as any),
		{ cnv: gene },
		'geneCnv alone is listed under cnv, the query key of its dt'
	)
	test.deepEqual(
		getGvQueryMethods({
			snvindel: { byrange: {}, byisoform: { processTwsInOneQuery: true } },
			cnv: {},
			itd: {}
		} as any),
		{ snvindel: gene, cnv: gene, itd: gene },
		'no query takes a region with a batch snvindel.byisoform getter, which takes every term of a request'
	)
	test.deepEqual(getGvQueryMethods({ geneExpression: {} } as any), {}, 'nothing without geneVariant data')
	test.deepEqual(getGvQueryMethods(undefined), {}, 'nothing without queries')
	test.end()
})
