import tape from 'tape'
import * as d3s from 'd3-selection'
import { ColorScale } from '../ColorScale'

/* Tests
    - new ColorScale()
    - ColorScale.render() - default bottom
    - ColorScale.render() - top
    - ColorScale.updateColors()
	- markedValue - Show value in color bar and update
    - ColorScale.updateAxis()
	- setMin(), setMax()
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

function getColorScale(opts) {
	const _opts = {
		data: [0, 1],
		width: 150,
		position: '6,0',
		midColor: 'red'
	}

	return new ColorScale(Object.assign(_opts, opts))
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- dom/ColorScale -***-')
	test.end()
})

tape('new ColorScale()', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const testColorScale = new ColorScale({ holder, data: [0, 1] })

	test.equal(testColorScale.barheight, 14, 'Should set default value of 14 for barheight')
	test.equal(testColorScale.barwidth, 100, 'Should set default value of 100 for barwidth')
	test.deepEquals(testColorScale.colors, ['white', 'red'], 'Should set default colors to white and red')
	test.equal(testColorScale.topTicks, false, 'Should set default value of false for topTicks')
	test.equal(testColorScale.ticks, 5, 'Should set default value of 5 for ticks')
	test.equal(testColorScale.tickSize, 1, 'Should set default value of 1 for tickSize')
	test.equal(testColorScale.fontSize, 10, 'Should set default value of 10 for fontSize')
	test.equal(typeof testColorScale.render, 'function', 'Should have a testColorScale.render() function')
	test.equal(typeof testColorScale.updateAxis, 'function', 'Should have a testColorScale.updateAxis() function')
	test.equal(typeof testColorScale.updateColors, 'function', 'Should have a testColorScale.updateColors() function')
	test.equal(typeof testColorScale.updateScale, 'function', 'Should have a testColorScale.updateScale() function')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('ColorScale.render() - default bottom', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const testColorScale = getColorScale({ holder })

	test.ok(holder.select('svg[data-testid="sjpp-color-scale"]').node(), 'Should append an color scale to the holder')
	test.ok(
		holder.select('linearGradient[data-testid="sjpp-color-scale-bar"]').node(),
		'Should append an color bar to the holder'
	)
	test.ok(
		holder.select('g > g[data-testid="sjpp-color-scale-axis"]').node(),
		'Should append axis as a g element to the holder'
	)

	const childNodes = holder.select('svg > g').node().childNodes
	test.equal(childNodes[1].nodeName, 'rect', 'Should render color bar before the axis when topTicks is false')
	test.equal(childNodes[2].nodeName, 'g', 'Should render axis after the color bar topTicks is false')

	test.equal(
		holder.selectAll('text').nodes().length,
		testColorScale.ticks + 1,
		'Should append the correct number of ticks to scale'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('ColorScale.render() - top', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	getColorScale({ holder, topTicks: true, position: '10,15' })

	const childNodes = holder.select('svg > g').node().childNodes
	test.equal(childNodes[1].nodeName, 'rect', 'Should render axis before the color bar when topTicks is true')
	test.equal(childNodes[2].nodeName, 'g', 'Should render color bar after the axis when topTicks is true')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('ColorScale.updateColors()', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const testColorScale = getColorScale({ holder })

	const colors = ['blue', 'purple', 'green']
	testColorScale.colors = colors
	testColorScale.updateColors()

	const gradientStops = holder.selectAll('stop').nodes()
	test.equal(gradientStops[0].getAttribute('stop-color'), colors[0], 'Should update starting color')
	test.equal(gradientStops[1].getAttribute('stop-color'), colors[1], 'Should update ths only middle color')
	test.equal(gradientStops[2].getAttribute('stop-color'), colors[2], 'Should update ending color')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('ColorScale.updateAxis()', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const testColorScale = getColorScale({ holder })

	testColorScale.data = [0, 5]
	testColorScale.updateAxis()

	const ticks = holder.selectAll('text').nodes()

	test.equal(ticks[0].__data__, testColorScale.data[0], 'Should update the first tick to 0')
	test.equal(ticks[ticks.length - 1].__data__, testColorScale.data[1], 'Should update the last tick to 5')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('markedValue - Show value in color bar and update', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const testColorScale = getColorScale({ holder, data: [0, 40], markedValue: 15 })

	const valueElems = holder.selectAll('.sjpp-color-scale-marked').nodes()
	test.equal(valueElems[0].nodeName, 'line', 'Should render tick mark for marked value')
	test.equal(valueElems[1].nodeName, 'text', 'Should render text label for marked value')
	test.equal(
		valueElems[1].innerHTML,
		testColorScale.markedValue?.toString(),
		'Should render the correct value for marked value'
	)

	testColorScale.markedValue = 30
	testColorScale.updateValueInColorBar()
	const valueLabel = holder.select('text[data-testid="sjpp-color-scale-marked-label"]').node()
	test.equal(
		valueLabel.innerHTML,
		testColorScale.markedValue?.toString(),
		'Should update the label to match the new marked value'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('ColorScale.updateScale()', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const testColorScale = getColorScale({ holder, markedValue: 1 })

	const newColor = 'blue'
	testColorScale.colors[2] = newColor

	testColorScale.data = [-5, 5]
	testColorScale.markedValue = -1

	testColorScale.updateScale()

	const gradientStops = holder.selectAll('stop').nodes()
	test.equal(
		gradientStops[2].getAttribute('stop-color'),
		newColor,
		'Should call updateColors() and update the end color to blue'
	)

	const ticks = holder.selectAll('text').nodes()
	test.equal(ticks[0].__data__, -4, 'Should call updateAxis() and update the first tick to -5')
	test.equal(ticks[2].__data__, 0, 'Should insert a middle tick at 0')

	const valueLabel = holder.select('text[data-testid="sjpp-color-scale-marked-label"]').node()
	test.equal(
		valueLabel.innerHTML,
		testColorScale.markedValue?.toString(),
		'Should update the label to match the new marked value'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('setMin(), setMax()', async test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const initData = [-5, 5]
	const updateData = [-10, 10]
	const testColorScale = getColorScale({ holder, data: initData, ticks: 3 })

	//Update min
	testColorScale.setMin(updateData[0])
	test.equal(testColorScale.data[0], updateData[0], `Should update the minimum value = ${updateData[0]}`)
	test.equal(testColorScale.data[testColorScale.data.length - 1], initData[1], `Should not update the maximum value`)

	const tickLabels1 = testColorScale.dom.scaleAxis.selectAll('text').nodes()
	if (tickLabels1[0])
		test.equal(
			(tickLabels1[0] as any).__data__,
			updateData[0],
			`Should update the first tick label to ${updateData[0]}`
		)
	else test.fail(`Should render the first tick label with updated minimum value = ${updateData[0]}`)
	test.equal(
		(tickLabels1[tickLabels1.length - 1] as any).__data__,
		initData[1],
		`Should not update the last tick label`
	)

	//Update max
	testColorScale.setMax(updateData[1])

	const tickLabels2 = testColorScale.dom.scaleAxis.selectAll('text').nodes()
	if (tickLabels2.length)
		test.equal(
			(tickLabels2[tickLabels2.length - 1] as any).__data__,
			updateData[1],
			`Should update the last tick label to ${updateData[1]}`
		)
	else test.fail(`Should render the last tick label with updated maximum value = ${updateData[1]}`)

	if (test['_ok']) holder.remove()
	test.end()
})
