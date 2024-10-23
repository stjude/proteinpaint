import tape from 'tape'
import * as d3s from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { drawBoxplot } from '#dom'

/* Tests
    Default drawBoxplot()
    With plot label and out values
*/

/**************
 helper functions
***************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

function appendGHolder(holder) {
	return holder.append('svg').attr('width', 1000).attr('height', 200).append('g').attr('transform', 'translate(150,50)')
}

function mockBoxplotData(opts) {
	return {
		g: opts.g,
		bp: {
			w1: -0.0415824538,
			w2: 15.453551913,
			p05: 1.7267759563,
			p25: 3.1506849315,
			p50: 6.0130398982,
			p75: 8.602739726,
			p95: 15.453551913,
			iqr: 5.4520547944999995,
			out: opts.out || [],
			label: opts.label || null
		},
		color: 'blue',
		scale: scaleLinear().domain([-1.7643835616, 24.142465753]).range([0, 550]),
		rowheight: 100,
		labpad: 10
	}
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- dom/boxplot -***-')
	test.end()
})

tape('Default drawBoxplot()', test => {
	test.timeoutAfter(100)

	const holder = getHolder()
	const g = appendGHolder(holder)
	const boxplotData = mockBoxplotData({ g })

	drawBoxplot(boxplotData)

	test.equal(holder.selectAll('rect').size(), 1, 'Should render center rect')
	test.equal(holder.selectAll('line').size(), 4, 'Should render 4 lines')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('With plot label and out values', test => {
	test.timeoutAfter(100)

	const holder = getHolder()
	const g = appendGHolder(holder)
	const boxplotData = mockBoxplotData({ g, label: 'All Samples', out: [{ value: 21.142465753 }] })

	drawBoxplot(boxplotData)

	test.equal(holder.selectAll('text').size(), 1, 'Should render label')
	test.equal(holder.selectAll('circle').size(), 1, 'Should render circle for out value')

	if (test['_ok']) holder.remove()
	test.end()
})
