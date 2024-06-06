import tape from 'tape'
import { getBinsDensity } from '../violin.bins'
import { scaleLinear } from 'd3-scale'

const v = { values: [0, 1, 2, 2, 2, 3, 4, 5, 0, 4, 5, 6, 6, 7, 8, 9, 10] }

const axisScale = scaleLinear().domain([0, 10]).range([0, 100])

/**************
 test sections
***************/
tape('\n', function (test) {
	test.pass('-***- termdb.violinBins specs -***-')
	test.end()
})

tape('compute bins given an array', function (test) {
	const bins = [
		{ x0: 0, density: 0 },
		{ x0: 0, density: 0.03520078944718524 },
		{ x0: 0.5, density: 0 },
		{ x0: 1, density: 0.01760039472359262 },
		{ x0: 1.5, density: 0 },
		{ x0: 2, density: 0.052801184170777865 },
		{ x0: 2.5, density: 0 },
		{ x0: 3, density: 0.01760039472359262 },
		{ x0: 3.5, density: 0 },
		{ x0: 4, density: 0.03520078944718524 },
		{ x0: 4.5, density: 0 },
		{ x0: 5, density: 0.03520078944718524 },
		{ x0: 5.5, density: 0 },
		{ x0: 6, density: 0.03520078944718524 },
		{ x0: 6.5, density: 0 },
		{ x0: 7, density: 0.01760039472359262 },
		{ x0: 7.5, density: 0 },
		{ x0: 8, density: 0.01760039472359262 },
		{ x0: 8.5, density: 0 },
		{ x0: 9, density: 0.01760039472359262 },
		{ x0: 9.5, density: 0 },
		{ x0: 10, density: 0.01760039472359262 },
		{ x0: 10, density: 0.01760039472359262 },
		{ x0: 10, density: 0 }
	]
	const result = getBinsDensity(axisScale, v, true, 20)
	test.deepEqual(result.bins, bins, 'should match expected output')
	test.end()
})
