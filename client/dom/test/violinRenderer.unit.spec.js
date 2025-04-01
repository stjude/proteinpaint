import tape from 'tape'
import { violinRenderer } from '../../dom/violinRenderer'
import { select, brushX } from 'd3'

tape('violin brush', test => {
	//Mock holder body element
	const holder = select('body').append('div').attr('id', 'test-brush')

	//Mock plot data
	const plotData = {
		minvalue: 0,
		maxvalue: 100,
		xMin: 0,
		xMax: 100,
		density: [
			{ x0: 0, density: 0.1 },
			{ x0: 50, density: 0.5 },
			{ x0: 100, density: 1.0 }
		],
		densityMax: 0.5,
		densityMin: 0.1,
		color: 'rgb(221, 221, 221)'
	}

	let brushRange
	let rangeStart
	let rangeEnd
	const brushingCallback = ({ rangeStart, rangeEnd }) => {
		brushRange = { rangeStart, rangeEnd }
	}

	const violin = new violinRenderer(holder, plotData, 500, 100, 20, 20, brushingCallback)
	violin.render()

	//Simulate the brushing
	const brush = brushX()
		.extent([
			[20, 20],
			[520, 120]
		])
		.on('end', async event => {
			const selection = event.selection
			if (selection) {
				rangeStart = violin.axisScale.invert(selection[0] - 20)
				rangeEnd = violin.axisScale.invert(selection[1] - 20)
				brushingCallback({ rangeStart, rangeEnd })
			} else {
				brushingCallback({ rangeStart: null, rangeEnd: null })
			}
		})

	violin.svg.append('g').attr('class', 'brush').call(brush)

	const brushG = violin.svg.select('.brush')
	brushG.call(brush.move, [100, 300])

	if (brushRange) {
		test.ok(brushRange, 'Brush range is set')
		test.equal(brushRange.rangeStart, 16, `Brush range start is ${brushRange.rangeStart}`)
		test.equal(brushRange.rangeEnd, 56.00000000000001, `Brush range end is ${brushRange.rangeEnd}`)
	} else {
		console.log('No brush range set')
	}
	holder.remove()
	test.end()
})
