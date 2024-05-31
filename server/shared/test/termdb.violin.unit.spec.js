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
		{ x0: 0, density: 0.02784412516636495 },
		{ x0: 0, density: 0.04544451988995757 },
		{ x0: 0.5, density: 0.05724058037772917 },
		{ x0: 1, density: 0.06881904693745426 },
		{ x0: 1.5, density: 0.07281185565013851 },
		{ x0: 2, density: 0.07328864505632252 },
		{ x0: 2.5, density: 0.07281185565013851 },
		{ x0: 3, density: 0.06881904693745426 },
		{ x0: 3.5, density: 0.06425841675139654 },
		{ x0: 4, density: 0.06593198077550223 },
		{ x0: 4.5, density: 0.07281185565013851 },
		{ x0: 5, density: 0.07617571121827457 },
		{ x0: 5.5, density: 0.07281185565013852 },
		{ x0: 6, density: 0.06593198077550223 },
		{ x0: 6.5, density: 0.05724058037772917 },
		{ x0: 7, density: 0.04833158605190961 },
		{ x0: 7.5, density: 0.041669305105319805 },
		{ x0: 8, density: 0.03808785560913728 },
		{ x0: 8.5, density: 0.03816038691848611 },
		{ x0: 9, density: 0.03808785560913728 },
		{ x0: 9.5, density: 0.03465146873165242 },
		{ x0: 10, density: 0.02784412516636495 },
		{ x0: 10, density: 0.02784412516636495 },
		{ x0: 10, density: 0.02784412516636495 }
	]
	const result = getBinsDensity(axisScale, v, true, 20)
	test.deepEqual(bins, result.bins, 'should match expected output')
	test.end()
})
