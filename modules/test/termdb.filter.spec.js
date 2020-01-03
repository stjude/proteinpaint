/*

$ npx tape modules/test/*.spec.js

*/

const tape = require('tape')
const getFilterCTEs = require('../termdb.filter').getFilterCTEs

tape('\n', function(test) {
	test.pass('-***- modules/termdb.filter specs -***-')
	test.end()
})

tape('simple filter', function(test) {
	const filter = getFilterCTEs({
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'wgs_sequenced', iscategorical: true },
					values: [{ key: '1', label: 'Yes' }] // always assumed OR
				}
			}
		]
	})

	console.log(filter.CTEs.join(',\n'))
	console.log(filter.values)
	test.end()
})

tape.only('complex filter', function(test) {
	const filter = getFilterCTEs({
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'wgs_sequenced', iscategorical: true },
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
							term: { id: 'sex', iscategorical: true },
							values: [{ key: 'male', label: 'male' }]
						}
					},
					{
						type: 'tvs',
						tvs: {
							term: { id: 'diaggrp', iscategorical: true },
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
									term: { id: 'agedx', isfloat: true },
									ranges: [{ start: 1, stop: 5 }]
								}
							},
							{
								type: 'tvs',
								tvs: {
									term: { id: 'aaclassic_5', isfloat: true },
									ranges: [{ start: 1000, stop: 4000 }]
								}
							}
						]
					}
				]
			}
		]
	})

	console.log(filter.CTEs.join(',\n'))
	console.log(filter.values)
	test.end()
})
