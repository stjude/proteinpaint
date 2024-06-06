import tape from 'tape'
import * as d3s from 'd3-selection'
import { ColorScale } from '../ColorScale'

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
		data: [0, 1]
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

	const testColorScale = getColorScale({ holder })

	test.ok(testColorScale.barheight == 14, 'Should set default value of 14 for barheight')
	test.ok(testColorScale.barwidth == 100, 'Should set default value of 100 for barwidth')
	test.ok(testColorScale.startColor == 'white', 'Should set default value of white for startColor')
	test.ok(testColorScale.midColor == 'white', 'Should set default value of white for midColor')
	test.ok(testColorScale.endColor == 'red', 'Should set default value of red for endColor')
	test.ok(testColorScale.position == '0,0', 'Should set default value of 0,0 for position')
	test.ok(testColorScale.svg.width == 100, 'Should set default value of 100 for svg.width')
	test.ok(testColorScale.svg.height == 30, 'Should set default value of 30 for svg.height')
	test.ok(testColorScale.tickPosition == 'bottom', 'Should set default value of bottom for tickPosition')
	test.ok(testColorScale.ticks == 5, 'Should set default value of 5 for ticks')
	test.ok(testColorScale.tickSize == 1, 'Should set default value of 1 for tickSize')
	test.ok(testColorScale.fontSize == 10, 'Should set default value of 10 for fontSize')
	test.equal(typeof testColorScale.render, 'function', 'Should have a testColorScale.render() function')
	test.equal(typeof testColorScale.updateAxis, 'function', 'Should have a testColorScale.updateAxis() function')
	test.equal(typeof testColorScale.updateColors, 'function', 'Should have a testColorScale.updateColors() function')
	test.equal(typeof testColorScale.updateScale, 'function', 'Should have a testColorScale.updateScale() function')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('ColorScale.render()', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any

	const testColorScale = getColorScale({ holder })
	testColorScale.render()

	test.ok(holder.select('svg[data-testid="sjpp-color-scale"]').node(), 'Should append an color scale to the holder')
	test.ok(
		holder.select('linearGradient[data-testid="sjpp-color-scale-bar"]').node(),
		'Should append an color bar to the holder'
	)
	test.ok(
		holder.select('g > g[data-testid="sjpp-color-scale-axis"]').node(),
		'Should append axis as a g element to the holder'
	)
	test.equal(
		holder.selectAll('text').nodes().length,
		testColorScale.ticks + 1,
		'Should append the correct number of ticks to scale'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('ColorScale.updateColors()', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any

	const testColorScale = getColorScale({ holder })
	testColorScale.render()

	testColorScale.startColor = 'blue'
	testColorScale.midColor = 'purple'
	testColorScale.endColor = 'green'

	testColorScale.updateColors()

	const gradientStops = holder.selectAll('stop').nodes()
	test.equal(gradientStops[0].getAttribute('stop-color'), 'blue', 'Should update startColor')
	test.equal(gradientStops[1].getAttribute('stop-color'), 'purple', 'Should update midColor')
	test.equal(gradientStops[2].getAttribute('stop-color'), 'green', 'Should update endColor')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('ColorScale.updateAxis()', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any

	const testColorScale = getColorScale({ holder })
	testColorScale.render()

	testColorScale.data = [0, 5]
	testColorScale.updateAxis()

	const ticks = holder.selectAll('text').nodes()

	test.equal(ticks[0].__data__, testColorScale.data[0], 'Should update the first tick to 0')
	test.equal(ticks[1].__data__, testColorScale.data[1], 'Should update the last tick to 5')

	if (test['_ok']) holder.remove()
	test.end()
})
