import tape from 'tape'
import { violinBinsObj } from '../violin.bins'
import { scaleLinear } from 'd3-scale'

const v = { values: [0, 1, 2, 2, 2, 3, 4, 5, 0, 4, 5, 6, 6, 7, 8, 9, 10] }

const axisScale = scaleLinear()
	.domain([0, 10])
	.range([0, 100])

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- termdb.violinBins specs -***-')
	test.end()
})

tape('compute bins given an array', function(test) {
	const bins = {
		bins0: [
			[0, 0],
			[],
			[1],
			[],
			[2, 2, 2],
			[],
			[3],
			[],
			[4, 4],
			[],
			[5, 5],
			[],
			[6, 6],
			[],
			[7],
			[],
			[8],
			[],
			[9],
			[],
			[10]
		],
		bins: [
			{ x0: 0, x1: 0.5, binValueCount: 2 },
			{ x0: 0.5, x1: 1, binValueCount: 0 },
			{ x0: 1, x1: 1.5, binValueCount: 1 },
			{ x0: 1.5, x1: 2, binValueCount: 0 },
			{ x0: 2, x1: 2.5, binValueCount: 3 },
			{ x0: 2.5, x1: 3, binValueCount: 0 },
			{ x0: 3, x1: 3.5, binValueCount: 1 },
			{ x0: 3.5, x1: 4, binValueCount: 0 },
			{ x0: 4, x1: 4.5, binValueCount: 2 },
			{ x0: 4.5, x1: 5, binValueCount: 0 },
			{ x0: 5, x1: 5.5, binValueCount: 2 },
			{ x0: 5.5, x1: 6, binValueCount: 0 },
			{ x0: 6, x1: 6.5, binValueCount: 2 },
			{ x0: 6.5, x1: 7, binValueCount: 0 },
			{ x0: 7, x1: 7.5, binValueCount: 1 },
			{ x0: 7.5, x1: 8, binValueCount: 0 },
			{ x0: 8, x1: 8.5, binValueCount: 1 },
			{ x0: 8.5, x1: 9, binValueCount: 0 },
			{ x0: 9, x1: 9.5, binValueCount: 1 },
			{ x0: 9.5, x1: 10, binValueCount: 0 },
			{ x0: 10, x1: 10, binValueCount: 1 }
		]
	}

	test.deepEqual(bins, violinBinsObj(axisScale, v), 'should match expected output')
	test.end()
})
