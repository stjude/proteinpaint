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
		{ x0: 0, x1: 0.5, density: 0.05929514663008059 },
		{ x0: 0.5, x1: 1, density: 0.06489024181101011 },
		{ x0: 1, x1: 1.5, density: 0.06958497684788201 },
		{ x0: 1.5, x1: 2, density: 0.07424755616532326 },
		{ x0: 2, x1: 2.5, density: 0.07794546389984566 },
		{ x0: 2.5, x1: 3, density: 0.08154690447607614 },
		{ x0: 3, x1: 3.5, density: 0.0841193620305265 },
		{ x0: 3.5, x1: 4, density: 0.0865310409878237 },
		{ x0: 4, x1: 4.5, density: 0.08784942548447951 },
		{ x0: 4.5, x1: 5, density: 0.08807451552049392 },
		{ x0: 5, x1: 5.5, density: 0.0872063110958669 },
		{ x0: 5.5, x1: 6, density: 0.08524481221059853 },
		{ x0: 6, x1: 6.5, density: 0.08219001886468873 },
		{ x0: 6.5, x1: 7, density: 0.07804193105813755 },
		{ x0: 7, x1: 7.5, density: 0.07280054879094496 },
		{ x0: 7.5, x1: 8, density: 0.06833090379008747 },
		{ x0: 8, x1: 8.5, density: 0.0628965872063111 },
		{ x0: 8.5, x1: 9, density: 0.0574301149031041 },
		{ x0: 9, x1: 9.5, density: 0.05106328245583948 },
		{ x0: 9.5, x1: 10, density: 0.046593637454982 },
		{ x0: 10, x1: 10.5, density: 0.04141656662665066 },
		{ x0: 10, x1: 10, density: 0 }
	]
	test.deepEqual(bins, getBinsDensity(axisScale, v), 'should match expected output')
	test.end()
})
