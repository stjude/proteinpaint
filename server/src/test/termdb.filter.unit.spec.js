/*

$ npx tape modules/test/*.spec.js

*/

const tape = require('tape')
const getFilterCTEs = require('../termdb.filter').getFilterCTEs
const tdb = require('./load.testds').init('termdb.test.js')
const { server_init_db_queries } = require('../termdb.server.init')
server_init_db_queries(tdb.ds)

tape('\n', function (test) {
	test.pass('-***- modules/termdb.filter specs -***-')
	test.end()
})

tape('simple filter', async function (test) {
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
								name: 'InvalidTerm',
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
