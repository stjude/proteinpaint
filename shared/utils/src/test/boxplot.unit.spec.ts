import tape from 'tape'
import { boxplot_getvalue } from '../boxplot.ts'

tape('boxplot_getvalue() supports numeric values', test => {
	const result = boxplot_getvalue([0, 1, 2, 3, 4, 5, 100])
	test.equal(result.p50, 3, 'calculates the median')
	test.deepEqual(result.out, [100], 'returns numeric outliers for numeric input')
	test.end()
})

tape('boxplot_getvalue() supports value objects', test => {
	const values = [0, 1, 2, 3, 4, 5, 100].map(value => ({ value }))
	const result = boxplot_getvalue(values)
	test.equal(result.p50, 3, 'calculates the median')
	test.deepEqual(result.out, [{ value: 100 }], 'retains object outliers for object input')
	test.end()
})

tape('boxplot_getvalue() supports partial and outlier-free results', test => {
	const shortValues = [1, 2, 3]
	test.deepEqual(boxplot_getvalue(shortValues), { out: shortValues }, 'returns input as out for fewer than five values')
	test.deepEqual(boxplot_getvalue([0, 1, 2, 3, 4, 5, 100], true).out, [], 'can omit outliers')
	test.end()
})
