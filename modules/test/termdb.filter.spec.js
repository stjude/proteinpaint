const tape = require('tape')
const getFilterCTEs = require('../termdb.filter').getFilterCTEs

tape('\n', function(test) {
	test.pass('-***- modules/termdb.filter specs -***-')
	test.end()
})

tape('simple filter', function(test) {
	const filter = getFilterCTEs({
		$in: true,
		$join: 'and',
		$lst: [
			{
				term: { id: 'wgs_sequenced', iscategorical: true },
				values: [{ key: '1', label: 'Yes' }] // always assumed OR
			}
		]
	})

	console.log(filter.CTEs.join(',\n'))
	console.log(filter.values)
	test.end()
})

tape('complex filter', function(test) {
	const filter = getFilterCTEs({
		$in: true,
		$join: 'and',
		$lst: [
			{
				term: { id: 'wgs_sequenced', iscategorical: true },
				values: [{ key: '1', label: 'Yes' }] // always assumed OR
			},
			{
				$in: true,
				$join: 'or',
				$lst: [
					{
						term: { id: 'sex', iscategorical: true },
						values: [{ key: 'male', label: 'male' }]
					},
					{
						term: { id: 'diaggrp', iscategorical: true },
						values: [{ key: 'ALL', label: 'ALL' }]
					},
					{
						$in: true,
						$join: 'and',
						$lst: [
							{
								term: { id: 'agedx', isfloat: true },
								ranges: [{ start: 1, stop: 5 }]
							},
							{
								term: { id: 'aaclassic_5', isfloat: true },
								ranges: [{ start: 1000, stop: 4000 }]
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
