import tape from 'tape'
import * as d3s from 'd3-selection'
import { formatHeaderText, getChartTitle } from '../textFormatHelpers'

/*
Tests:
- formatHeaderText() correctly formats the header text with prefix, text, and suffix.
- formatHeaderText() correctly appends the chart type span. 
- getChartTitle() returns the correct chart title with term0 and sample count.
- getChartTitle() returns the chartId if term0 is not present.
*/

/*************************
 reusable helper functions
**************************/

function getHolder() {
	return d3s.select('body').append('div')
}

/**************
 test section
***************/

tape('\n', function (test) {
	test.comment('-***- dom/summary/textFormatHelpers -***-')
	test.end()
})

tape('formatHeaderText() formats the header text and chart type', test => {
	const holder = getHolder()

	formatHeaderText({
		header: holder,
		chartType: 'boxplot',
		prefix: 'Term:',
		text: 'Age',
		suffix: '(years)'
	})

	const textSpan = holder.select('[data-testid="sjpp-header-text-boxplot"]')
	const chartTypeSpan = holder.selectAll('span').filter((_, index) => index === 1)

	test.equal(holder.attr('data-testid'), 'sjpp-header-boxplot', 'Should set the header test id')
	test.equal(textSpan.text(), 'Term: Age (years)', 'Should format the header text with prefix and suffix')
	test.equal(textSpan.style('margin-right'), '5px', 'Should add margin after the header text')
	test.equal(chartTypeSpan.size(), 1, 'Should append one chart type span')
	test.equal(chartTypeSpan.text(), 'BOXPLOT', 'Should uppercase the chart type')
	test.equal(chartTypeSpan.style('font-size'), '0.8em', 'Should set the chart type font size')
	test.equal(chartTypeSpan.style('opacity'), '0.8', 'Should set the chart type opacity')

	holder.remove()
	test.end()
})

tape('getChartTitle() returns the term title, value label, and sample count', test => {
	const config = {
		term0: {
			term: {
				name: 'Disease status',
				values: {
					case: { label: 'Case' }
				}
			}
		}
	}

	test.equal(
		getChartTitle(config, 'case', 42),
		'Disease status: Case (n=42)',
		'Should use the term name, value label, and sample count'
	)
	test.equal(
		getChartTitle(config, 'control'),
		'Disease status: control',
		'Should fall back to chartId when the value label is missing'
	)

	test.end()
})

tape('getChartTitle() returns chartId when term0 is not present', test => {
	test.equal(getChartTitle({}, 'scatterplot'), 'scatterplot', 'Should return chartId without term0')
	test.end()
})

