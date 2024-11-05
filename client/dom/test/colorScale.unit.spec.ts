import tape from 'tape'
import * as d3s from 'd3-selection'
import { ColorScale } from '#dom'
import { detectGte } from '../../test/test.helpers.js'

/* Tests
    - new ColorScale()
    - ColorScale.render() - default bottom
    - ColorScale.render() - top
    - ColorScale.updateColors()
	- markedValue - Show value in color bar and update
    - ColorScale.updateAxis()
	- .setMinMaxCallback() and .setColorsCallback()
	- Show ticks in scientific notation
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
		position: '6,0'
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
	const opts = { holder, data: [0, 1] }
	const testColorScale = new ColorScale(opts)

	test.equal(testColorScale.barheight, 14, 'Should set default value of 14 for barheight')
	test.equal(testColorScale.barwidth, 100, 'Should set default value of 100 for barwidth')
	test.deepEquals(testColorScale.colors, ['white', 'red'], 'Should set default colors to white and red')
	test.deepEquals(testColorScale.data, opts.data, 'Should set default data to [0, 1]')
	test.equal(typeof testColorScale.dom, 'object', 'Should have a testColorScale.dom object')
	test.equal(testColorScale.fontSize, 10, 'Should set default value of 10 for fontSize')
	test.equal(testColorScale.markedValue, null, 'Should set default value of null for markedValue')
	test.equal(testColorScale.ticks, 5, 'Should set default value of 5 for ticks')
	test.equal(testColorScale.tickSize, 1, 'Should set default value of 1 for tickSize')
	test.equal(testColorScale.topTicks, false, 'Should set default value of false for topTicks')
	test.equal(typeof testColorScale.render, 'function', 'Should have a testColorScale.render() function')
	test.equal(typeof testColorScale.renderMenu, 'function', 'Should have a testColorScale.renderMenu() function')
	test.equal(typeof testColorScale.updateAxis, 'function', 'Should have a testColorScale.updateAxis() function')
	test.equal(typeof testColorScale.updateColors, 'function', 'Should have a testColorScale.updateColors() function')
	test.equal(typeof testColorScale.updateScale, 'function', 'Should have a testColorScale.updateScale() function')
	test.equal(
		typeof testColorScale.updateValueInColorBar,
		'function',
		'Should have a testColorScale.updateValueInColorBar() function'
	)

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

	testColorScale.data = [-5, 0, 5]
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

tape('.setMinMaxCallback() and .setColorsCallback()', async test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const newColor = 'blue'
	const newIdx = 0
	const newMax = 42
	const newMin = -10
	const testColorScale = getColorScale({
		holder,
		setColorsCallback: (value: string, idx: number) => {
			test.equal(value, newColor, 'Should return the correct color to the .setColorsCallback()')
			test.equal(idx, newIdx, 'Should return the correct index to the .setColorsCallback()')
			return value
		},
		setMinMaxCallback: obj => {
			test.equal(typeof obj, 'object', 'Should pass an object to the .setMinMaxCallback() callback')
			test.equal(obj.cutoffMode, 'fixed', 'Should return the correct cutoffMode to the .setMinMaxCallback() callback')
			test.equal(obj.min, newMin, 'Should return the correct min value to the .setMinMaxCallback) callback')
			test.equal(obj.max, newMax, 'Should return the correct max value to the .setMinMaxCallback() callback')
		}
	})

	test.equal(
		testColorScale.cutoffMode,
		'auto',
		'Should set cutoffMode = "auto" when not specified and .setMinMaxCallback() is provided.'
	)
	test.true(
		typeof testColorScale.default == 'object' && testColorScale.default.min == 0 && testColorScale.default.max == 1,
		'Should set auto to default values when not specified and .setMinMaxCallback() is provided.'
	)

	if (testColorScale.setColorsCallback) await testColorScale.setColorsCallback(newColor, newIdx)
	if (testColorScale.setMinMaxCallback)
		await testColorScale.setMinMaxCallback({ cutoffMode: 'fixed', min: newMin, max: newMax })

	if (test['_ok']) holder.remove()
	test.end()
})

tape('Show ticks in scientific notation', async test => {
	test.timeoutAfter(100)

	let first: string | number, second: string | number, third: string | number

	//[0.001, 0.005]
	first = '2.0e-3'
	second = '4.0e-3'
	const holder = getHolder() as any
	const testColorScale = getColorScale({
		holder,
		data: [0.001, 0.005],
		ticks: 2
	})

	const initTicks = holder.selectAll('text').nodes()
	test.equal(initTicks[0].innerHTML, first, `Should render scientific notation for first tick`)
	test.equal(initTicks[1].innerHTML, second, `Should render scientific notation for second tick`)

	//[-0.005, -0.001]
	/** Note: The minus sign in the browser is U+2212.
	 * The standard hypen when typing is U+002D. Use U+2212
	 * for testing.
	 */
	testColorScale.data = [-0.005, -0.001]
	first = '−4.0e-3'
	second = '−2.0e-3'

	const updatedTicks = await detectGte({
		selector: 'text',
		target: testColorScale.dom.scaleAxis.node(),
		count: 2,
		trigger: () => testColorScale.updateAxis(),
		matcher(muts) {
			for (const m of muts) {
				if (m.type == 'childList') return m
			}
		}
	})
	test.equal(
		updatedTicks[0].textContent,
		first,
		`Should render scientific notation for first tick = ${first} after update`
	)
	test.equal(
		updatedTicks[1].textContent,
		second,
		`Should render scientific notation for second tick = ${second} after update`
	)

	//Switch back to integers
	testColorScale.data = [0, 10]
	first = '0'
	second = '5'
	third = '10'

	const updatedTicks2 = await detectGte({
		selector: 'text',
		elem: testColorScale.dom.scaleAxis.node(),
		count: 3,
		trigger: () => testColorScale.updateAxis(),
		matcher(muts) {
			for (const m of muts) {
				if (m.type == 'childList') return m
			}
		}
	})

	test.equal(
		updatedTicks2[0].textContent,
		first,
		`Should not render scientific notation for first tick = ${first} after update`
	)
	test.equal(
		updatedTicks2[1].textContent,
		second,
		`Should not render scientific notation for second tick = ${second} after update`
	)
	test.equal(
		updatedTicks2[2].textContent,
		third,
		`Should not render scientific notation for third tick = ${third} after update`
	)

	//Zero to small number
	testColorScale.data = [0, 0.00001]
	first = '0.0e+0'
	second = '5.0e-6'
	third = '1.0e-5'

	const updatedTicks3 = await detectGte({
		selector: 'text',
		elem: testColorScale.dom.scaleAxis.node(),
		count: 3,
		trigger: () => testColorScale.updateAxis(),
		matcher(muts) {
			for (const m of muts) {
				if (m.type == 'childList') return m
			}
		}
	})

	test.equal(
		updatedTicks3[0].textContent,
		first,
		`Should render scientific notation for first tick = ${first} after update`
	)
	test.equal(
		updatedTicks3[1].textContent,
		second,
		`Should render scientific notation for second tick = ${second} after update`
	)
	test.equal(
		updatedTicks3[2].textContent,
		third,
		`Should render scientific notation for third tick = ${third} after update`
	)

	//neg small number to zero
	testColorScale.data = [-0.001, 0]
	first = '−1.0e-3'
	second = '−5.0e-4'
	third = '0.0e+0'

	const updatedTicks4 = await detectGte({
		selector: 'text',
		elem: testColorScale.dom.scaleAxis.node(),
		count: 3,
		trigger: () => testColorScale.updateAxis(),
		matcher(muts) {
			for (const m of muts) {
				if (m.type == 'childList') return m
			}
		}
	})

	test.equal(
		updatedTicks4[0].textContent,
		first,
		`Should render scientific notation for first tick = ${first} after update`
	)
	test.equal(
		updatedTicks4[1].textContent,
		second,
		`Should render scientific notation for second tick = ${second} after update`
	)
	test.equal(
		updatedTicks4[2].textContent,
		third,
		`Should render scientific notation for third tick = ${third} after update`
	)

	//zero min to integer
	testColorScale.data = [0, 5.75]
	first = '0'
	second = '2'
	third = '4'

	const updatedTicks5 = await detectGte({
		selector: 'text',
		elem: testColorScale.dom.scaleAxis.node(),
		count: 3,
		trigger: () => testColorScale.updateAxis(),
		matcher(muts) {
			for (const m of muts) {
				if (m.type == 'childList') return m
			}
		}
	})

	test.equal(
		updatedTicks5[0].textContent,
		first,
		`Should not render scientific notation for first tick = ${first} after update`
	)
	test.equal(
		updatedTicks5[1].textContent,
		second,
		`Should not render scientific notation for second tick = ${second} after update`
	)
	test.equal(
		updatedTicks5[2].textContent,
		third,
		`Should not render scientific notation for third tick = ${third} after update`
	)

	//integer to zero max
	testColorScale.data = [-5.75, 0]
	first = '−4'
	second = '−2'
	third = '0'

	const updatedTicks6 = await detectGte({
		selector: 'text',
		elem: testColorScale.dom.scaleAxis.node(),
		count: 3,
		trigger: () => testColorScale.updateAxis(),
		matcher(muts) {
			for (const m of muts) {
				if (m.type == 'childList') return m
			}
		}
	})

	test.equal(
		updatedTicks6[0].textContent,
		first,
		`Should not render scientific notation for first tick = ${first} after update`
	)
	test.equal(
		updatedTicks6[1].textContent,
		second,
		`Should not render scientific notation for second tick = ${second} after update`
	)
	test.equal(
		updatedTicks6[2].textContent,
		third,
		`Should not render scientific notation for third tick = ${third} after update`
	)

	//Large range postive integers
	testColorScale.data = [10, 1000]
	first = '500'
	second = '1,000'

	const updatedTicks7 = await detectGte({
		selector: 'text',
		elem: testColorScale.dom.scaleAxis.node(),
		count: 3,
		trigger: () => testColorScale.updateAxis(),
		matcher(muts) {
			for (const m of muts) {
				if (m.type == 'childList') return m
			}
		}
	})

	test.equal(
		updatedTicks7[0].textContent,
		first,
		`Should not render scientific notation for first tick = ${first} after update`
	)
	test.equal(
		updatedTicks7[1].textContent,
		second,
		`Should not render scientific notation for second tick = ${second} after update`
	)

	//Large range negative integers
	testColorScale.data = [-1200, -10]
	first = '−1,000'
	second = '−500'

	const updatedTicks8 = await detectGte({
		selector: 'text',
		elem: testColorScale.dom.scaleAxis.node(),
		count: 3,
		trigger: () => testColorScale.updateAxis(),
		matcher(muts) {
			for (const m of muts) {
				if (m.type == 'childList') return m
			}
		}
	})

	test.equal(
		updatedTicks8[0].textContent,
		first,
		`Should not render scientific notation for first tick = ${first} after update`
	)
	test.equal(
		updatedTicks8[1].textContent,
		second,
		`Should not render scientific notation for second tick = ${second} after update`
	)

	if (test['_ok']) holder.remove()
	test.end()
})
