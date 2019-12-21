const tape = require('tape')
const getFilterCTEs = require('../termdb.filter').getFilterCTEs

tape('\n', function(test) {
	test.pass('-***- modules/termdb.filter specs -***-')
	test.end()
})

tape('default', function(test) {
	const filter = getFilterCTEs({
		$and: [
			{
				$in: false,
				$and: [
					{
						term: { id: 'sex', iscategorical: true },
						values: [{ key: 'male', label: 'male' }]
					},
					{
						term: { id: 'diaggrp', iscategorical: true },
						values: [{ key: 'ALL', label: 'ALL' }]
					}
					/*{
						$or: [
							{
								term: "genotype-TNFR1",
								mclass: ["*"] 
							},
							{
								term: "genotype-FLT3",
								mclass: ["F"] 
							},
						]
					}*/
				]
			},
			{
				term: { id: 'age', isfloat: true },
				ranges: [{ start: 10, stopunbounded: true }] // always assumed OR
			}
		]
	})

	console.log(filter.CTEs.join(',\n'))
	console.log(filter.values)
	test.end()
})
