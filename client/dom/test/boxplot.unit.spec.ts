import tape from 'tape'
import * as d3s from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { drawBoxplot } from '#dom'

/* Tests
    Default drawBoxplot()
    With plot label and label color
    With out values and radius
	With filled in rect with black lines
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
	const _opts: any = {
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
	if (opts.labColor) _opts.labColor = opts.labColor
	if (opts.radius) _opts.bp.radius = opts.radius
	if (opts.color) _opts.color = opts.color
	if (opts.bp) Object.assign(_opts.bp, opts.bp)
	return _opts
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- dom/boxplot -***-')
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

tape('With plot label and label color', test => {
	test.timeoutAfter(100)

	const holder = getHolder()
	const g = appendGHolder(holder)
	const opts = {
		g,
		label: 'All Samples',
		labColor: 'black'
	}
	const boxplotData = mockBoxplotData(opts)

	drawBoxplot(boxplotData)

	const label: any = holder.select('text')
	test.true(label, 'Should render label')
	test.equal(label.node().textContent, opts.label, `Should render ${opts.label} label`)
	test.equal(label.attr('fill'), opts.labColor, `Should render ${opts.labColor} label`)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('With out values and radius', test => {
	test.timeoutAfter(100)

	const holder = getHolder()
	const g = appendGHolder(holder)
	const opts = {
		g,
		out: [{ value: 21.142465753 }],
		radius: 5
	}
	const boxplotData = mockBoxplotData(opts)

	drawBoxplot(boxplotData)

	const circle: any = holder.select('circle')
	test.true(
		circle && circle.attr('r') == opts.radius,
		`Should render circle for out value with a radius = ${opts.radius}`
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('With filled in rect with black lines', test => {
	test.timeoutAfter(100)

	const holder = getHolder()
	const g = appendGHolder(holder)
	const opts = {
		g,
		bp: {
			rectFill: 'pink'
		},
		color: 'black'
	}
	const boxplotData = mockBoxplotData(opts)
	drawBoxplot(boxplotData)

	test.equal(holder.select('rect').attr('fill'), opts.bp.rectFill, `Should render rect with fill ${opts.bp.rectFill}`)
	test.equal(holder.selectAll('line').attr('stroke'), opts.color, `Should render lines with stroke ${opts.color}`)

	if (test['_ok']) holder.remove()
	test.end()
})
