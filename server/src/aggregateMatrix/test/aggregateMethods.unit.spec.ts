import tape from 'tape'
import {
	CATEGORICAL,
	CONDITION,
	DNA_METHYLATION,
	FLOAT,
	GENE_EXPRESSION,
	GENE_VARIANT,
	INTEGER,
	ISOFORM_EXPRESSION,
	METABOLITE_INTENSITY,
	PSEUDOBULK,
	SNP,
	SSGSEA,
	SURVIVAL
} from '#types'
import { calculateAggregateMethod, calculateSampleBasedMethods, initAggregateMethods } from '../aggregateMethods.ts'

function getDs() {
	return {
		cohort: {
			termdb: {
				allowedTermTypes: [],
				termtypeByCohort: {}
			}
		},
		queries: {
			singleCell: {
				pseudobulk: {
					geneExpression: {
						cellType: {
							enabledMethods: new Set(['mean', 'percent']),
							categories: {
								B: {
									meanFile: 'mean.h5',
									percentFile: 'percent.h5'
								}
							}
						}
					}
				}
			}
		}
	}
}

/** A dataset with the given term types and queries, and the methods it makes available. */
function getMethodIds(
	{ allowedTermTypes = [] as string[], termtypeByCohort = {} as any, queries = {} as any } = {},
	terms?: any[]
) {
	const ds: any = { cohort: { termdb: { allowedTermTypes, termtypeByCohort } }, queries }
	initAggregateMethods(ds)
	return ds.getAvailableAggregateMethods(terms).map(method => method.id)
}

/** A dataset with a pseudobulk member that has the given methods enabled. */
function getPseudobulkQueries(enabledMethods: string[]) {
	return { singleCell: { pseudobulk: { geneExpression: { cellType: { enabledMethods: new Set(enabledMethods) } } } } }
}
const pseudobulkTerm = { type: PSEUDOBULK, assay: 'geneExpression', memberId: 'cellType', id: 'B' }

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- src/aggregateMatrix/aggregateMethods -***-')
	test.end()
})

tape('aggregate method availability follows dataset data and term kind', test => {
	const ds: any = getDs()
	initAggregateMethods(ds)

	test.deepEqual(
		ds.getAvailableAggregateMethods().map(method => method.id),
		['mean', 'percent'],
		'Should expose only methods backed by this numeric dataset'
	)
	test.deepEqual(
		ds
			.getAvailableAggregateMethods([{ type: 'pseudobulk', assay: 'geneExpression', memberId: 'cellType', id: 'B' }])
			.map(method => method.id),
		['mean', 'percent'],
		'Should expose file-backed methods for pseudobulk terms'
	)
	test.deepEqual(
		ds.getAvailableAggregateMethods([{ type: 'geneExpression' }]).map(method => method.id),
		['mean', 'percent', 'count'],
		'Should expose calculated descriptive methods for standard numeric terms'
	)
	test.deepEqual(
		ds.getAvailableAggregateMethods([{ type: 'categorical' }]).map(method => method.id),
		['percent', 'count'],
		'Should expose intersection methods for selected nonnumeric terms'
	)

	ds.cohort.termdb.termtypeByCohort = { all: { categorical: 2, numeric: 0 } }
	initAggregateMethods(ds)
	test.deepEqual(
		ds.getAvailableAggregateMethods().map(method => method.id),
		['mean', 'percent', 'count'],
		'Should expose dataset-wide methods when no term context is supplied'
	)
	test.end()
})

tape('sample-based aggregate methods share one set of counts', test => {
	const samples = {
		one: { sample: 'one', rowA: { key: 'x', value: 'x' }, column: { key: 10, value: 10 } },
		two: { sample: 'two', rowB: { key: 'y', value: 'y' }, column: { key: 20, value: 20 } },
		three: { sample: 'three', rowA: { key: 'x', value: 'x' } }
	}
	const result = calculateSampleBasedMethods(['count', 'mean', 'percent'], samples, ['rowA', 'rowB'], 'column')
	test.deepEqual(
		result.get('count'),
		{ rowA: 1, rowB: 1 },
		'Should return the matching observation "count" for each row.'
	)
	test.deepEqual(result.get('mean'), { rowA: 10, rowB: 20 }, 'Should calculate mean for non-numeric rows.')
	test.deepEqual(
		result.get('percent'),
		{ rowA: (1 / 3) * 100, rowB: (1 / 3) * 100 },
		'Should calculate "percent" of the full cohort.'
	)
	test.end()
})

tape('numeric methods ignore uncomputable column values', test => {
	const samples = {
		one: { row: { key: '<5', value: '<5' }, column: { key: 'exposed, dose unknown', value: -8888 } },
		two: { row: { key: '<5', value: '<5' }, column: { key: '5000 to <10000', value: 7000 } }
	}
	const columnTerm = {
		values: {
			'-8888': { label: 'exposed, dose unknown', uncomputable: true }
		}
	}
	const result = calculateSampleBasedMethods(['count', 'mean', 'percent'], samples, ['row'], 'column', columnTerm)

	test.equal(result.get('count')!.row, 2, 'Count should include uncomputable values.')
	test.equal(result.get('percent')!.row, (2 / 2) * 100, 'Percent should include uncomputable values.')
	test.equal(result.get('mean')!.row, 7000, 'Mean should ignore uncomputable values.')
	test.end()
})

tape('dataset-wide methods follow the data queries and term types of the dataset', test => {
	test.deepEqual(getMethodIds(), [], 'Should expose no methods for a dataset without data')
	for (const query of [
		'geneExpression',
		'isoformExpression',
		'metaboliteIntensity',
		'proteome',
		'ssGSEA',
		'junction'
	]) {
		test.deepEqual(
			getMethodIds({ queries: { [query]: {} } }),
			['mean', 'percent', 'count'],
			`Should expose every method for a dataset with a ${query} query`
		)
	}
	test.deepEqual(
		getMethodIds({ queries: { dnaMethylation: { get: () => [] } } }),
		['mean', 'percent', 'count'],
		'Should expose every method for a dataset with a dnaMethylation get() query'
	)
	test.deepEqual(
		getMethodIds({ queries: { dnaMethylation: {} } }),
		[],
		'Should not expose methods for a dnaMethylation query that cannot get values'
	)

	test.deepEqual(
		getMethodIds({ allowedTermTypes: [GENE_VARIANT] }),
		['percent', 'count'],
		'Should not expose mean for a dataset with only nonnumeric term types'
	)
	test.deepEqual(
		getMethodIds({ termtypeByCohort: { all: { [CATEGORICAL]: 4, numeric: 0 } } }),
		['percent', 'count'],
		'Should expose percent and count for a dataset with only categorical terms'
	)
	test.deepEqual(
		getMethodIds({ termtypeByCohort: { all: { [FLOAT]: 3, numeric: 3 } } }),
		['mean', 'percent', 'count'],
		'Should expose every method for a dataset with numeric dictionary terms'
	)
	test.deepEqual(
		getMethodIds({ termtypeByCohort: { all: { [FLOAT]: 0, numeric: 0 } } }),
		[],
		'Should ignore term types without terms'
	)
	test.deepEqual(
		getMethodIds({ termtypeByCohort: { all: { numeric: 5 } } }),
		[],
		'Should not treat the numeric total as a term type'
	)
	test.deepEqual(
		getMethodIds({
			termtypeByCohort: { one: { [CATEGORICAL]: 1 }, two: { [INTEGER]: 2, numeric: 2 } }
		}),
		['mean', 'percent', 'count'],
		'Should combine the term types of every cohort'
	)
	test.deepEqual(
		getMethodIds({ allowedTermTypes: [GENE_VARIANT], termtypeByCohort: { all: { [INTEGER]: 1 } } }),
		['mean', 'percent', 'count'],
		'Should combine the allowed term types with the term types of the cohorts'
	)
	test.end()
})

tape('dataset-wide methods follow the enabled pseudobulk methods', test => {
	test.deepEqual(
		getMethodIds({ queries: getPseudobulkQueries(['mean']) }),
		['mean'],
		'Should expose only mean when only mean is enabled'
	)
	test.deepEqual(
		getMethodIds({ queries: getPseudobulkQueries(['percent']) }),
		['percent'],
		'Should expose only percent when only percent is enabled'
	)
	test.deepEqual(
		getMethodIds({ queries: getPseudobulkQueries(['mean', 'percent']) }),
		['mean', 'percent'],
		'Should never expose count for pseudobulk data'
	)
	test.deepEqual(
		getMethodIds({ queries: getPseudobulkQueries([]) }),
		[],
		'Should expose no methods when none are enabled'
	)
	test.deepEqual(
		getMethodIds({ queries: { singleCell: {} } }),
		[],
		'Should expose no methods for single cell data without pseudobulk'
	)
	test.deepEqual(
		getMethodIds({ queries: { singleCell: { pseudobulk: { geneExpression: null, other: 'x', empty: {} } } } }),
		[],
		'Should skip pseudobulk assays and members that are not configured'
	)
	test.deepEqual(
		getMethodIds({ queries: { ...getPseudobulkQueries(['mean']), geneExpression: {} } }),
		['mean', 'percent', 'count'],
		'Should expose every method when the dataset also has standard numeric data'
	)
	test.end()
})

tape('methods for selected terms follow the term types', test => {
	const queries = { geneExpression: {} }
	const numericTypes = [
		INTEGER,
		FLOAT,
		GENE_EXPRESSION,
		ISOFORM_EXPRESSION,
		SSGSEA,
		DNA_METHYLATION,
		METABOLITE_INTENSITY
	]
	for (const type of numericTypes) {
		test.deepEqual(
			getMethodIds({ queries }, [{ type }]),
			['mean', 'percent', 'count'],
			`Should expose every method for ${type} terms`
		)
	}
	for (const type of [CATEGORICAL, GENE_VARIANT, CONDITION, SURVIVAL, SNP]) {
		test.deepEqual(
			getMethodIds({ queries }, [{ type }]),
			['percent', 'count'],
			`Should not expose mean for ${type} terms`
		)
	}
	test.deepEqual(
		getMethodIds({ queries }, [{ type: GENE_EXPRESSION }, { type: ISOFORM_EXPRESSION }, { type: FLOAT }]),
		['mean', 'percent', 'count'],
		'Should expose every method when every term is numeric'
	)
	test.deepEqual(
		getMethodIds({ queries }, [{ type: GENE_EXPRESSION }, { type: CATEGORICAL }]),
		['percent', 'count'],
		'Should only expose the methods that apply to every term'
	)
	test.deepEqual(
		getMethodIds({}, [{ type: GENE_VARIANT }]),
		['percent', 'count'],
		'Should expose methods for selected terms even if the dataset declares no data'
	)
	test.deepEqual(
		getMethodIds({ queries }, []),
		['mean', 'percent', 'count'],
		'Should treat no selected terms as the whole dataset'
	)
	test.end()
})

tape('methods for selected pseudobulk terms follow the enabled methods of the member', test => {
	const queries = getPseudobulkQueries(['mean', 'percent'])
	test.deepEqual(getMethodIds({ queries }, [pseudobulkTerm]), ['mean', 'percent'], 'Should expose the enabled methods')
	test.deepEqual(
		getMethodIds({ queries: getPseudobulkQueries(['mean']) }, [pseudobulkTerm]),
		['mean'],
		'Should not expose a method that is not enabled'
	)
	test.deepEqual(
		getMethodIds({ queries }, [pseudobulkTerm, { ...pseudobulkTerm, id: 'CD4' }]),
		['mean', 'percent'],
		'Should expose the methods when every term is from the same member'
	)
	test.deepEqual(
		getMethodIds({ queries }, [{ ...pseudobulkTerm, memberId: 'other' }]),
		[],
		'Should not expose methods for a member that is not configured'
	)
	test.deepEqual(
		getMethodIds({ queries }, [{ ...pseudobulkTerm, assay: 'other' }]),
		[],
		'Should not expose methods for an assay that is not configured'
	)
	test.deepEqual(
		getMethodIds({}, [pseudobulkTerm]),
		[],
		'Should not expose methods for a dataset without pseudobulk data'
	)
	test.deepEqual(
		getMethodIds({ queries }, [pseudobulkTerm, { type: CATEGORICAL }]),
		['percent'],
		'Should not expose mean or count for pseudobulk terms mixed with other terms'
	)
	test.end()
})

tape('method options describe each method', test => {
	const ds: any = { cohort: { termdb: {} }, queries: { geneExpression: {} } }
	initAggregateMethods(ds)
	const methods = ds.getAvailableAggregateMethods()
	test.deepEqual(
		methods.map(({ id, label, appliesTo }) => ({ id, label, appliesTo })),
		[
			{ id: 'mean', label: 'Mean', appliesTo: 'numeric' },
			{ id: 'percent', label: 'Percent', appliesTo: 'any' },
			{ id: 'count', label: 'Count', appliesTo: 'any' }
		],
		'Should describe the id, label, and kind of term of each method'
	)
	test.ok(
		methods.every(method => !('isAvailable' in method) && !('calculateFromStats' in method)),
		'Should not expose the server-only hooks of a method'
	)
	test.end()
})

tape('calculateAggregateMethod() calculates a method from sufficient statistics', test => {
	const stats = { matches: 5, numericMatches: 4, cohortCount: 20, sum: 10 }
	test.equal(calculateAggregateMethod('mean', stats), 2.5, 'Should divide the sum by the numeric matches for mean')
	test.equal(calculateAggregateMethod('percent', stats), 25, 'Should divide the matches by the cohort for percent')
	test.equal(
		calculateAggregateMethod('mean', { ...stats, numericMatches: 0, sum: 0 }),
		null,
		'Should return null for mean without numeric matches'
	)
	test.equal(
		calculateAggregateMethod('percent', { ...stats, cohortCount: 0, matches: 0 }),
		null,
		'Should return null for percent of an empty cohort'
	)
	test.equal(
		calculateAggregateMethod('percent', { ...stats, matches: 0 }),
		0,
		'Should return 0 for percent without matches'
	)
	test.equal(
		calculateAggregateMethod('mean', { ...stats, numericMatches: 3, sum: -9 }),
		-3,
		'Should calculate a negative mean'
	)
	test.throws(
		() => calculateAggregateMethod('count', stats),
		/Unsupported sample-based aggregate method: count/,
		'Should leave count to the caller'
	)
	test.throws(
		() => calculateAggregateMethod('median', stats),
		/Unsupported sample-based aggregate method: median/,
		'Should reject an unknown method'
	)
	test.end()
})

tape('sample-based methods reject unsupported methods', test => {
	const samples = { one: { row: { key: 'x' }, column: { value: 1 } } }
	test.throws(
		() => calculateSampleBasedMethods(['median'], samples, ['row'], 'column'),
		/Unsupported sample-based aggregate method: median/,
		'Should reject an unknown method'
	)
	test.throws(
		() => calculateSampleBasedMethods(['mean', 'median'], samples, ['row'], 'column'),
		/Unsupported sample-based aggregate method: mean, median/,
		'Should reject a request that includes an unknown method'
	)
	test.deepEqual(
		calculateSampleBasedMethods(['count'], samples, ['row'], 'column').get('count'),
		{ row: 1 },
		'Should allow count, which needs no statistics'
	)
	test.deepEqual(
		[...calculateSampleBasedMethods(['percent', 'count', 'mean'], samples, ['row'], 'column').keys()],
		['percent', 'count', 'mean'],
		'Should return the methods in the requested order'
	)
	test.end()
})

tape('sample-based methods handle samples without a match', test => {
	const samples = {
		one: { rowA: { key: 'x' }, column: { key: 10, value: 10 } },
		two: { rowA: { key: 'x' }, rowB: { key: 'y' } },
		three: { rowB: { key: 'y' }, column: { key: 30, value: 30 } },
		four: { other: { key: 'z' } }
	}
	const result = calculateSampleBasedMethods(['count', 'mean', 'percent'], samples, ['rowA', 'rowB', 'rowC'], 'column')
	test.deepEqual(
		result.get('count'),
		{ rowA: 1, rowB: 1, rowC: 0 },
		'Should only count samples that have both the row and the column'
	)
	test.deepEqual(
		result.get('mean'),
		{ rowA: 10, rowB: 30, rowC: null },
		'Should return null mean for a row without matches'
	)
	test.deepEqual(
		result.get('percent'),
		{ rowA: 25, rowB: 25, rowC: 0 },
		'Should use every sample, including samples without the row or column, as the cohort'
	)

	const empty = calculateSampleBasedMethods(['count', 'mean', 'percent'], {}, ['row'], 'column')
	test.deepEqual(empty.get('count'), { row: 0 }, 'Should count nothing in an empty cohort')
	test.deepEqual(empty.get('mean'), { row: null }, 'Should return null mean for an empty cohort')
	test.deepEqual(empty.get('percent'), { row: null }, 'Should return null percent for an empty cohort')

	test.deepEqual(
		calculateSampleBasedMethods(['count'], samples, [], 'column').get('count'),
		{},
		'Should return nothing when there are no rows'
	)
	test.end()
})

tape('sample-based percent uses a supplied cohort size', test => {
	const samples = {
		one: { row: { key: 'x' }, column: { key: 1, value: 1 } },
		two: { row: { key: 'x' }, column: { key: 2, value: 2 } }
	}
	const result = calculateSampleBasedMethods(['percent'], samples, ['row'], 'column', undefined, 8)
	test.deepEqual(result.get('percent'), { row: 25 }, 'Should divide the matches by the supplied cohort size')
	test.end()
})

tape('sample-based mean only averages computable numbers', test => {
	const columnTerm = {
		values: { '-8888': { label: 'unknown', uncomputable: true }, '-9999': { label: 'refused', uncomputable: true } }
	}
	const samples = {
		one: { row: { key: 'x' }, column: { key: 4, value: 4 } },
		two: { row: { key: 'x' }, column: { key: 8, value: 8 } },
		three: { row: { key: 'x' }, column: { key: '-8888', value: -8888 } },
		four: { row: { key: 'x' }, column: { key: 'refused', value: -9999 } },
		five: { row: { key: 'x' }, column: { key: 'text', value: 'text' } },
		six: { row: { key: 'x' }, column: { key: 'inf', value: Infinity } },
		seven: { row: { key: 'x' }, column: { key: 'none', value: null } },
		eight: { row: { key: 'x' }, column: {} },
		nine: { row: { key: 'x' }, column: null }
	}
	const result = calculateSampleBasedMethods(['count', 'mean'], samples, ['row'], 'column', columnTerm)
	test.equal(
		result.get('count')!.row,
		9,
		'Should count every sample with the row and column, even without a usable number'
	)
	test.equal(
		result.get('mean')!.row,
		6,
		'Should ignore uncomputable keys and labels, text, infinity, and missing values'
	)

	const multiple = {
		one: { row: { key: 'x' }, column: { value: 5, values: [{ key: 5 }, { key: '-8888' }] } },
		two: { row: { key: 'x' }, column: { value: 7, values: [{ key: 7 }] } }
	}
	test.equal(
		calculateSampleBasedMethods(['mean'], multiple, ['row'], 'column', columnTerm).get('mean')!.row,
		7,
		'Should ignore a value when any of its keys is uncomputable'
	)
	test.equal(
		calculateSampleBasedMethods(['mean'], multiple, ['row'], 'column').get('mean')!.row,
		6,
		'Should average every number when the column term has no uncomputable values'
	)
	test.equal(
		calculateSampleBasedMethods(['mean'], { one: { row: { key: 'x' }, column: { value: -3 } } }, ['row'], 'column').get(
			'mean'
		)!.row,
		-3,
		'Should average negative numbers'
	)
	test.end()
})
