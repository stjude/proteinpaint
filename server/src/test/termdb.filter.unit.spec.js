/*
test sections:

simple filter
nested filter
invalid filter term
*/
import tape from 'tape'
import { getFilterCTEs } from '../termdb.filter.js'
import { init } from './load.testds.js'
import { server_init_db_queries } from '../termdb.server.init.ts'

tape('\n', function (test) {
	test.comment('-***- src/termdb.filter specs -***-')
	test.end()
})

let tdb

tape('simple filter', async function (test) {
	tdb = await init('termdb.test.ts')
	server_init_db_queries(tdb.ds)

	// Mock isoformExpression handler for custom termCollection tests.
	// The real handler requires Rust binaries not available in CI.
	if (!tdb.ds.queries) tdb.ds.queries = {}
	tdb.ds.queries.isoformExpression = {
		get: async param => {
			const term2sample2value = new Map()
			for (const tw of param.terms) {
				// Return mock TPM values for two samples per isoform.
				// Sample IDs must exist in the test db's sampleidmap.
				const s2v = { 1: 10, 2: 5 }
				term2sample2value.set(tw.$id, s2v)
			}
			return { term2sample2value, byTermId: {}, bySampleId: {} }
		}
	}

	const filter = await getFilterCTEs(
		{
			type: 'tvslst',
			in: true,
			join: '',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: { id: 'wgs_curated', type: 'categorical' },
						values: [{ key: '1', label: 'Yes' }] // always assumed OR
					}
				}
			]
		},
		tdb.ds
	)

	//console.log(filter.CTEs.join(',\n'))
	//console.log(filter.values)
	test.deepEqual(
		Object.keys(filter).sort((a, b) => (a < b ? -1 : 1)),
		['CTEname', 'CTEs', 'filters', 'values'],
		'should return an object with the four expected keys'
	)
	test.equal(filter.CTEname, 'f', 'should return the default CTE name')
	test.equal(
		filter.filters.split('?').length - 1,
		filter.values.length,
		'CTE string should have the same number of ? as values[]'
	)
	test.equal(filter.CTEs.length, 2, 'should return two CTE clauses for this simple filter')
	test.end()
})

tape('nested filter', async function (test) {
	const filter = await getFilterCTEs(
		{
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: { id: 'wgs_curated', type: 'categorical' },
						values: [{ key: '1', label: 'Yes' }] // always assumed OR
					}
				},
				{
					type: 'tvslst',
					in: true,
					join: 'or',
					lst: [
						{
							type: 'tvs',
							tvs: {
								term: { id: 'sex', type: 'categorical' },
								values: [{ key: 'male', label: 'male' }]
							}
						},
						{
							type: 'tvs',
							tvs: {
								term: { id: 'diaggrp', type: 'categorical' },
								values: [{ key: 'ALL', label: 'ALL' }]
							}
						},
						{
							type: 'tvslst',
							in: true,
							join: 'and',
							lst: [
								{
									type: 'tvs',
									tvs: {
										term: { id: 'agedx', type: 'float' },
										ranges: [{ start: 1, stop: 5 }]
									}
								},
								{
									type: 'tvs',
									tvs: {
										term: { id: 'aaclassic_5', type: 'float' },
										ranges: [{ start: 1000, stop: 4000 }]
									}
								}
							]
						}
					]
				}
			]
		},
		tdb.ds
	)

	//console.log(filter.CTEs.join(',\n'))
	//console.log(filter.values)
	test.deepEqual(
		Object.keys(filter).sort((a, b) => (a < b ? -1 : 1)),
		['CTEname', 'CTEs', 'filters', 'values'],
		'should return an object with the four expected keys'
	)
	test.equal(filter.CTEname, 'f', 'should return the default CTE name')
	test.equal(
		filter.filters.split('?').length - 1,
		filter.values.length,
		'CTE string should have the same number of ? as values[]'
	)
	test.equal(filter.CTEs.length, 8, 'should return 8 CTE clauses for this complex filter')
	test.end()
})

tape('junction numeric filter', async function (test) {
	let requestedTerm
	tdb.ds.queries.junction = {
		get: async param => {
			requestedTerm = param.terms[0]
			return { term2sample2value: new Map([['xx', { 1: 5, 2: 15, 3: 25 }]]) }
		}
	}
	const term = { type: 'junction', chr: 'chr1', start: 100, stop: 200, strand: '+' }
	const filter = await getFilterCTEs(
		{
			type: 'tvslst',
			in: true,
			join: '',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term,
						q: { readcountCutoff: 3 },
						ranges: [{ start: 10, startinclusive: true, stop: 20, stopinclusive: false }]
					}
				}
			]
		},
		tdb.ds
	)

	test.deepEqual(filter.values, ['2'], 'selects samples whose junction read count is in range')
	test.deepEqual(requestedTerm, { $id: 'xx', term, q: { readcountCutoff: 3 } }, 'passes the junction term and query')
	test.equal(filter.filters.split('?').length - 1, filter.values.length, 'CTE placeholders match values')
	test.end()
})

tape('pseudobulk numeric filter', async function (test) {
	let requestedTerms
	let requestedDs
	tdb.ds.queries.singleCell = {
		pseudobulk: {
			get: async (param, ds) => {
				requestedTerms = param.terms
				requestedDs = ds
				return { term2sample2value: new Map([['xx', { 1: 0.5, 2: 1.5, 3: 2.5 }]]) }
			}
		}
	}
	const term = {
		type: 'pseudobulk',
		assay: 'geneExpression',
		memberId: 'immune',
		category: 'T cells',
		gene: 'TP53'
	}
	const filter = await getFilterCTEs(
		{
			type: 'tvslst',
			in: true,
			join: '',
			lst: [
				{
					type: 'tvs',
					tvs: { term, ranges: [{ start: 1, startinclusive: true, stop: 2, stopinclusive: false }] }
				}
			]
		},
		tdb.ds
	)

	test.deepEqual(filter.values, ['2'], 'selects samples whose pseudobulk value is in range')
	test.deepEqual(requestedTerms, [{ $id: 'xx', term, q: undefined }], 'passes the pseudobulk term')
	test.equal(requestedDs, tdb.ds, 'passes the dataset to the pseudobulk getter')
	test.equal(filter.filters.split('?').length - 1, filter.values.length, 'CTE placeholders match values')
	test.end()
})

/* tvs.isnot inverts the membership test in numericSampleData2tvs(), which every non-dictionary
numeric term type shares (geneExpression, isoformExpression, metaboliteIntensity,
proteomeAbundance, ssGSEA, dnaMethylation, junction, pseudobulk).

Regression guard: isnot used to be ignored outright, so a negated filter matched the SAME samples
as the un-negated one. The two-group analyses build a complement group by flipping that flag, so
"Not in X" came back identical to X and every sample was reported as being in both groups. */
tape('numeric filter honors tvs.isnot (junction)', async function (test) {
	// 1 is below the range, 2 is inside it, 3 is above it. Sample 4 exists in the test db's
	// sampleidmap but is deliberately absent here -- it has no value for this term.
	tdb.ds.queries.junction = {
		get: async () => ({ term2sample2value: new Map([['xx', { 1: 5, 2: 15, 3: 25 }]]) })
	}
	const term = { type: 'junction', chr: 'chr1', start: 100, stop: 200, strand: '+' }
	const ranges = [{ start: 10, startinclusive: true, stop: 20, stopinclusive: false }]
	const build = isnot =>
		getFilterCTEs(
			{ type: 'tvslst', in: true, join: '', lst: [{ type: 'tvs', tvs: { term, q: {}, ranges, isnot } }] },
			tdb.ds
		)

	const group = await build(false)
	const complement = await build(true)

	test.deepEqual(group.values, ['2'], 'without isnot, selects the in-range sample')
	test.deepEqual(complement.values.slice().sort(), ['1', '3'], 'with isnot, selects the out-of-range samples')
	test.deepEqual(
		group.values.filter(v => complement.values.includes(v)),
		[],
		'a group and its isnot complement share no sample'
	)
	/* Also pins the missing-data rule: sample 4 has no value for the term and must appear in
	NEITHER side. Enumerating the cohort and subtracting the group -- a plausible way to "fix"
	isnot -- would put 4 in the complement and fail this. */
	test.deepEqual(
		[...group.values, ...complement.values].sort(),
		['1', '2', '3'],
		'group plus complement covers the annotated samples only, never one without a value'
	)
	test.equal(
		complement.filters.split('?').length - 1,
		complement.values.length,
		'CTE placeholders match values when negated'
	)
	test.end()
})

tape('numeric filter honors tvs.isnot (pseudobulk)', async function (test) {
	// same inversion, reached through a different term type's getter
	tdb.ds.queries.singleCell = {
		pseudobulk: { get: async () => ({ term2sample2value: new Map([['xx', { 1: 0.5, 2: 1.5, 3: 2.5 }]]) }) }
	}
	const term = { type: 'pseudobulk', assay: 'geneExpression', memberId: 'immune', category: 'T cells', gene: 'TP53' }
	const ranges = [{ start: 1, startinclusive: true, stop: 2, stopinclusive: false }]
	const filter = await getFilterCTEs(
		{ type: 'tvslst', in: true, join: '', lst: [{ type: 'tvs', tvs: { term, ranges, isnot: true } }] },
		tdb.ds
	)

	test.deepEqual(filter.values.slice().sort(), ['1', '3'], 'isnot selects the out-of-range pseudobulk samples')
	test.end()
})

tape('custom termCollection fraction filter', async function (test) {
	const filter = await getFilterCTEs(
		{
			type: 'tvslst',
			in: true,
			join: '',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: {
							type: 'termCollection',
							isCustom: true,
							memberType: 'numeric',
							name: 'Test Isoforms (TPM)',
							termlst: [
								{
									id: 'ENST00000256078',
									name: 'ENST00000256078',
									type: 'isoformExpression',
									isoform: 'ENST00000256078'
								},
								{
									id: 'ENST00000311936',
									name: 'ENST00000311936',
									type: 'isoformExpression',
									isoform: 'ENST00000311936'
								}
							],
							numerators: ['ENST00000256078'],
							propsByTermId: {}
						},
						ranges: [{ start: 0, startinclusive: false, stopunbounded: true }]
					}
				}
			]
		},
		tdb.ds
	)

	test.deepEqual(
		Object.keys(filter).sort((a, b) => (a < b ? -1 : 1)),
		['CTEname', 'CTEs', 'filters', 'values'],
		'should return an object with the four expected keys'
	)
	test.equal(filter.CTEname, 'f', 'should return the default CTE name')
	test.ok(filter.values.length > 0, 'should return matching samples (fraction > 0)')
	test.equal(filter.CTEs.length, 2, 'should return two CTE clauses')
	test.end()
})

tape('termCollection fraction filter routes by member term type, not term.isCustom', async function (test) {
	// same collection as above without the isCustom flag: the member term type decides that
	// the values come from a ds.queries[] handler, since such terms are not in the sqlite db
	let requestedTerms
	const isoformExpression = tdb.ds.queries.isoformExpression
	tdb.ds.queries.isoformExpression = {
		get: async (param, ds) => {
			requestedTerms = param.terms
			return await isoformExpression.get(param, ds)
		}
	}

	const filter = await getFilterCTEs(
		{
			type: 'tvslst',
			in: true,
			join: '',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: {
							type: 'termCollection',
							memberType: 'numeric',
							name: 'Test Isoforms (TPM)',
							termlst: [
								{
									id: 'ENST00000256078',
									name: 'ENST00000256078',
									type: 'isoformExpression',
									isoform: 'ENST00000256078'
								},
								{
									id: 'ENST00000311936',
									name: 'ENST00000311936',
									type: 'isoformExpression',
									isoform: 'ENST00000311936'
								}
							],
							numerators: ['ENST00000256078'],
							propsByTermId: {}
						},
						ranges: [{ start: 0, startinclusive: false, stopunbounded: true }]
					}
				}
			]
		},
		tdb.ds
	)

	tdb.ds.queries.isoformExpression = isoformExpression
	test.deepEqual(
		requestedTerms?.map(tw => tw.term.isoform),
		['ENST00000256078', 'ENST00000311936'],
		'queries both member terms with the isoformExpression handler'
	)
	test.ok(filter.values.length > 0, 'should return matching samples (fraction > 0)')
	test.end()
})

tape('custom termCollection fraction filter passes junction members intact', async function (test) {
	// a splice junction event collection: the members are junction terms, whose handler
	// requires chr/start/stop/strand on the term
	const junctions = [
		{ id: 'junction-1', name: 'junction-1', type: 'junction', chr: 'chr1', start: 100, stop: 200, strand: '+' },
		{ id: 'junction-2', name: 'junction-2', type: 'junction', chr: 'chr1', start: 100, stop: 500, strand: '+' }
	]
	let requestedTerms
	tdb.ds.queries.junction = {
		get: async param => {
			requestedTerms = param.terms
			// validate the same way the real junction handler does
			for (const tw of param.terms) {
				const t = tw.term
				if (!t.chr || !Number.isInteger(t.start) || !Number.isInteger(t.stop) || !t.strand) {
					throw new Error('junction.get(): junction term must include chr, integer start/stop, and strand')
				}
			}
			// junction-1 reads are 1/4 of the event total for sample 1, 1/2 for sample 2
			const values = tw => (tw.term.stop == 200 ? { 1: 5, 2: 10 } : { 1: 15, 2: 10 })
			return { term2sample2value: new Map(param.terms.map(tw => [tw.$id, values(tw)])) }
		}
	}

	const filter = await getFilterCTEs(
		{
			type: 'tvslst',
			in: true,
			join: '',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: {
							type: 'termCollection',
							isCustom: true,
							memberType: 'numeric',
							name: 'Splice junction event',
							termlst: junctions,
							denominators: ['junction-1', 'junction-2'],
							numerators: ['junction-1'],
							propsByTermId: {}
						},
						// sample 1 is at 0.25, sample 2 at 0.5
						ranges: [{ start: 0.4, stop: 0.6, startinclusive: true, stopinclusive: true }]
					}
				}
			]
		},
		tdb.ds
	)

	test.deepEqual(
		requestedTerms?.map(tw => tw.term),
		junctions,
		'passes each junction member term to the handler unchanged'
	)
	test.deepEqual(filter.values, ['2'], 'selects only the sample whose junction fraction is in range')
	test.end()
})

tape('custom termCollection fraction filter uses term.denominators[]', async function (test) {
	// every member gets the same mocked value, so the fraction is
	// numerators.length / denominators.length, regardless of term.termlst[]
	const isoforms = ['ENST00000256078', 'ENST00000311936', 'ENST00000397440']
	const term = {
		type: 'termCollection',
		isCustom: true,
		memberType: 'numeric',
		name: 'Test Isoforms (TPM)',
		termlst: isoforms.map(isoform => ({ id: isoform, name: isoform, type: 'isoformExpression', isoform })),
		numerators: [isoforms[0]],
		propsByTermId: {}
	}
	const getFilter = async denominators =>
		await getFilterCTEs(
			{
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: denominators ? { ...term, denominators } : term,
							// matches a 0.5 fraction, but not 0.33
							ranges: [{ start: 0.4, stop: 0.6, startinclusive: true, stopinclusive: true }]
						}
					}
				]
			},
			tdb.ds
		)

	const twoDenominators = await getFilter(isoforms.slice(0, 2))
	test.ok(twoDenominators.values.length > 0, 'a 1 of 2 denominator selection is a 0.5 fraction, in range')

	const allDenominators = await getFilter(isoforms)
	test.equal(allDenominators.values.length, 0, 'a 1 of 3 denominator selection is a 0.33 fraction, out of range')

	const impliedDenominators = await getFilter(undefined)
	test.equal(
		impliedDenominators.values.length,
		0,
		'without term.denominators[], every member of term.termlst[] is a denominator'
	)
	test.end()
})

tape('custom termCollection filter validates numerators', async function (test) {
	const message = 'Should throw when numerator is not in denominator'
	try {
		await getFilterCTEs(
			{
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: {
								type: 'termCollection',
								isCustom: true,
								memberType: 'numeric',
								name: 'Test Isoforms (TPM)',
								termlst: [
									{
										id: 'ENST00000256078',
										name: 'ENST00000256078',
										type: 'isoformExpression',
										isoform: 'ENST00000256078'
									}
								],
								denominators: ['ENST00000256078'],
								// numerator not in denominators
								numerators: ['ENST00000311936'],
								propsByTermId: {}
							},
							ranges: [{ start: 0, startinclusive: false, stopunbounded: true }]
						}
					}
				]
			},
			tdb.ds
		)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}
	test.end()
})

tape('invalid filter term', async function (test) {
	const message = 'Should throw for invalid term id'
	try {
		const filter = await getFilterCTEs(
			{
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: {
								id: 'invalidTerm',
								//name: 'InvalidTerm', // termdb.filter will query the db if either the term.name or term.type or both is missing
								type: 'categorical'
							},
							values: [
								{
									key: 'RMS',
									label: 'RMS'
								}
							]
						}
					}
				]
			},
			tdb.ds
		)
		test.fail(message)
	} catch (e) {
		test.pass(`${message}: ${e}`)
	}

	test.end()
})
