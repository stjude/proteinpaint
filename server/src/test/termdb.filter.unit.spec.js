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
import { validateQueryIsoformExpression } from '#routes/termdb.cluster.ts'

tape('\n', function (test) {
	test.comment('-***- src/termdb.filter specs -***-')
	test.end()
})

let tdb

tape('simple filter', async function (test) {
	tdb = await init('termdb.test.ts')
	server_init_db_queries(tdb.ds)
	await validateQueryIsoformExpression(tdb.ds, null)

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
		['CTEname', 'CTEs', 'filters', 'sampleTypes', 'values'],
		'should return an object with the five expected keys'
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
		['CTEname', 'CTEs', 'filters', 'sampleTypes', 'values'],
		'should return an object with the five expected keys'
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

tape('custom termCollection percentage filter', async function (test) {
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
		['CTEname', 'CTEs', 'filters', 'sampleTypes', 'values'],
		'should return an object with the five expected keys'
	)
	test.equal(filter.CTEname, 'f', 'should return the default CTE name')
	test.ok(filter.values.length > 0, 'should return matching samples (percentage > 0)')
	test.equal(filter.CTEs.length, 2, 'should return two CTE clauses')
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
								// numerator not in termlst
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
