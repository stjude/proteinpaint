import tape from 'tape'
import { termjson } from '../../test/testdata/termjson'
import { ViewModel } from '../../plots/boxplot/ViewModel'

/*
Tests:
    new ViewModel()
*/

const mockConfig = {
	term: {},
	term2: { term: termjson['sex'] }
}

const mockData = {
	plots: [
		{
			seriesId: '1',
			boxplot: {
				label: '1, n=1',
				min: 20,
				max: 100
			}
		},
		{
			seriesId: '2',
			boxplot: {
				label: '2, n=2',
				min: 0,
				max: 60
			}
		}
	]
}

const mockSettings = {
	boxplotWidth: 20,
	color: 'blue',
	labelPad: 10,
	rowHeight: 20,
	rowSpace: 10
}

tape('\n', function (test) {
	test.pass('-***- plots/boxplot -***-')
	test.end()
})

tape('new ViewModel()', function (test) {
	test.timeoutAfter(100)

	new ViewModel(mockConfig, mockData, mockSettings)

	test.equal((mockData as any).plotDim.totalRowHeight, 30, 'Should set totalRowHeight to 30')
	test.equal(
		(mockData as any).plots[0].color,
		termjson['sex'].values[1].color,
		'Should set plot color to the color defined for 1:"Female"'
	)
	test.equal(
		(mockData as any).plots[1].color,
		termjson['sex'].values[2].color,
		'Should set plot color to the color defined for 2:"Male"'
	)

	test.end()
})
