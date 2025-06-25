import tape from 'tape'
import * as d3s from 'd3-selection'
import { ColorScale, removeOutliers, removeInterpolatedOutliers } from '#dom'
import { detectGte } from '../../test/test.helpers.js'

/* Tests

ColorScale
	- new ColorScale()
	- ColorScale.render() - default bottom
	- ColorScale.render() - top
	- With labels
	- With .showNumsAsIs as true
	- ColorScale.updateColors()
	- markedValue - Show value in color bar and update
	- ColorScale.updateAxis()
	- .setColorsCallback()
	- .numericInputs
	- (skipped) Show ticks in scientific notation

Helpers
	- removeExtremeOutliers()
	- removeInterpolatedOutliers()
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
		domain: [0, 1],
		width: 150,
		position: '6,0'
	}

	return new ColorScale(Object.assign(_opts, opts))
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- dom/ColorScale/ColorScale -***-')
	test.end()
})

tape('new ColorScale()', test => {
	test.timeoutAfter(100)
	const holder = getHolder() as any
	const opts = { holder, domain: [0, 1] }
	const testColorScale = new ColorScale(opts)

	test.equal(testColorScale.barheight, 14, 'Should set default value of 14 for barheight')
	test.equal(testColorScale.barwidth, 100, 'Should set default value of 100 for barwidth')
	test.deepEquals(testColorScale.colors, ['white', 'red'], 'Should set default colors to white and red')
	test.deepEquals(testColorScale.domain, opts.domain, 'Should set default domain to [0, 1]')
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

tape('With labels', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const opts = { holder, topTicks: true, position: '20, 15', labels: { left: 'Left', right: 'Right' } }
	getColorScale(opts)

	const childNodes = holder.select('svg').node().childNodes

	test.true(
		childNodes[0].nodeName == 'text' && childNodes[0].innerHTML == opts.labels.left,
		`Should render text element to the left with label text = ${opts.labels.left}`
	)
	test.equal(childNodes[1].nodeName, 'g', 'Should render color bar between labels')
	test.true(
		childNodes[2].nodeName == 'text' && childNodes[2].innerHTML == opts.labels.right,
		`Should render text element to the left with label text = ${opts.labels.right}`
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('With .showNumsAsIs as true', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const domain = [-1.42, 0, 0.00462, 0.5]
	const opts = { holder, domain, colors: ['blue', 'white', 'purple', 'green'], showNumsAsIs: true }
	const testColorScale = getColorScale(opts)

	test.equal(
		testColorScale.tickValues,
		domain,
		'Should not format (i.e. round) domain values when showNumsAsIs is true'
	)

	const ticks = holder.selectAll('text').nodes()
	const tickValues = ticks.map(t => Number(t.__data__))
	test.deepEqual(tickValues, domain, 'Should render ticks with original domain values when showNumsAsIs is true')

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

	testColorScale.domain = [0, 5]
	testColorScale.updateAxis()

	const ticks = holder.selectAll('text').nodes()

	test.equal(ticks[0].__data__, testColorScale.domain[0], 'Should update the first tick to 0')
	test.equal(ticks[ticks.length - 1].__data__, testColorScale.domain[1], 'Should update the last tick to 5')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('markedValue - Show value in color bar and update', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const testColorScale = getColorScale({ holder, domain: [0, 40], markedValue: 15 })

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

	testColorScale.domain = [-5, 0, 5]
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

tape('.setColorsCallback()', async test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const newColor = 'blue'
	const newIdx = 0
	const testColorScale = getColorScale({
		holder,
		setColorsCallback: (value: string, idx: number) => {
			test.equal(value, newColor, 'Should return the correct color to the .setColorsCallback()')
			test.equal(idx, newIdx, 'Should return the correct index to the .setColorsCallback()')
			return value
		}
	})
	if (!testColorScale.menu) test.fail('Should create a menu when .setMinMaxCallback() is provided.')
	if (testColorScale.setColorsCallback) await testColorScale.setColorsCallback(newColor, newIdx)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('.numericInputs', async test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const newMax = 42
	const newMin = -10
	const defaultPercentile = 99
	const newPercentile = 50
	const testColorScale = getColorScale({
		holder,
		numericInputs: {
			defaultPercentile,
			callback: obj => {
				test.equal(typeof obj, 'object', 'Should pass an object to the numericInputs.callback()')
				if (obj.cutoffMode == 'fixed') {
					test.equal(obj.min, newMin, 'Should return the correct min value to the numericInputs.callback()')
					test.equal(obj.max, newMax, 'Should return the correct max value to the numericInputs.callback()')
				}
				if (obj.cutoffMode == 'percentile') {
					test.equal(
						obj.percentile,
						newPercentile,
						'Should return the correct min value to the numericInputs.callback()'
					)
				}
			}
		}
	})

	test.equal(
		testColorScale.menu!.cutoffMode,
		'auto',
		'Should set cutoffMode = "auto" when not specified and numericInputs.callback() is provided.'
	)
	test.true(
		typeof testColorScale.menu!.default == 'object' &&
			testColorScale.menu!.default.min == 0 &&
			testColorScale.menu!.default.max == 1,
		'Should set auto to default values when not specified and numericInputs.callback() is provided.'
	)

	if (testColorScale?.menu?.numInputCallback) {
		await testColorScale.menu.numInputCallback({ cutoffMode: 'fixed', min: newMin, max: newMax })
		await testColorScale.menu.numInputCallback({ cutoffMode: 'percentile', percentile: newPercentile })
	}

	if (test['_ok']) holder.remove()
	test.end()
})

tape.skip('Show ticks in scientific notation', async test => {
	test.timeoutAfter(3000)

	let first: string | number, second: string | number, third: string | number

	//[0.001, 0.005]
	first = '2.0e-3'
	second = '4.0e-3'
	const holder = getHolder() as any
	const testColorScale = getColorScale({
		holder,
		domain: [0.001, 0.005],
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
	testColorScale.domain = [-0.005, -0.001]
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
	testColorScale.domain = [0, 10]
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
	testColorScale.domain = [0, 0.00001]
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
	testColorScale.domain = [-0.001, 0]
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
	testColorScale.domain = [0, 5.75]
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
	testColorScale.domain = [-5.75, 0]
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
	testColorScale.domain = [10, 1000]
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
	testColorScale.domain = [-1200, -10]
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

/***************************
Color scale helper functions
****************************/

tape('\n', test => {
	test.pass('-***- dom/ColorScale/helpers -***-')
	test.end()
})

tape('removeOutliers()', test => {
	test.timeoutAfter(100)
	let minPercent: number, maxPercent: number, expected: number[], result: number[]
	const mockDomain = [
		-100, -0.8999999999999999, -0.7999999999999997, -0.6999999999999996, -0.5999999999999994, -0.49999999999999933,
		-0.3999999999999992, -0.2999999999999991, -0.19999999999999896, -0.09999999999999888, 0.08, 0.18000000000000005,
		0.2800000000000002, 0.38000000000000034, 0.4800000000000004, 0.5800000000000005, 0.6800000000000006,
		0.7800000000000008, 0.8800000000000009, 0.9800000000000011, 100
	]
	result = removeOutliers(mockDomain)
	test.deepEqual(result, mockDomain, `Should not remove outliers for such a small domain`)

	minPercent = 0.05
	maxPercent = 0.95
	result = removeOutliers(mockDomain, minPercent, maxPercent)
	expected = [
		-0.8999999999999999, -0.7999999999999997, -0.6999999999999996, -0.5999999999999994, -0.49999999999999933,
		-0.3999999999999992, -0.2999999999999991, -0.19999999999999896, -0.09999999999999888, 0.08, 0.18000000000000005,
		0.2800000000000002, 0.38000000000000034, 0.4800000000000004, 0.5800000000000005, 0.6800000000000006,
		0.7800000000000008, 0.8800000000000009, 0.9800000000000011
	]
	test.deepEqual(
		result,
		expected,
		`Should remove the extreme outliers from the domain with a ${minPercent}% and ${maxPercent}% cutoff`
	)

	minPercent = 0.25
	maxPercent = 0.75
	result = removeOutliers(mockDomain, minPercent, maxPercent)
	expected = [
		-0.49999999999999933, -0.3999999999999992, -0.2999999999999991, -0.19999999999999896, -0.09999999999999888, 0.08,
		0.18000000000000005, 0.2800000000000002, 0.38000000000000034, 0.4800000000000004, 0.5800000000000005
	]
	test.deepEqual(
		result,
		expected,
		`Should remove the extreme outliers from the domain with a ${minPercent}% and ${maxPercent}% cutoff`
	)

	test.end()
})

tape('removeInterpolatedOutliers()', test => {
	test.timeoutAfter(100)

	type SharedObj = { domain: number[]; range: string[] }
	let minPercent: number, maxPercent: number, expected: SharedObj, result: SharedObj
	const mockDomainRange = {
		domain: [-10000000000, -100, -5, -4, -3, -2, -1, -0.75, -0.5, -0.25, 0, 0.5, 0.75, 1, 2, 3, 4, 5, 100, 10000000000],
		range: [
			'#33FF57',
			'#FF33F3',
			'#3357FF',
			'#F3FF33',
			'#FF33A1',
			'#33FFF6',
			'#A133FF',
			'#FF7F33',
			'#33FF7F',
			'#7F33FF',
			'#FF337A',
			'#33FFA1',
			'#A1FF33',
			'#FF33F3',
			'#33A1FF',
			'#F633FF',
			'#FFA133',
			'#33F6FF',
			'#7AFF33',
			'#33F6FF'
		]
	}
	result = removeInterpolatedOutliers(mockDomainRange)
	test.deepEqual(result, mockDomainRange, `Should not remove outliers for such a small domain`)

	minPercent = 0.05
	maxPercent = 0.95
	result = removeInterpolatedOutliers(mockDomainRange, minPercent, maxPercent)
	expected = {
		domain: [-100, -5, -4, -3, -2, -1, -0.75, -0.5, -0.25, 0, 0.5, 0.75, 1, 2, 3, 4, 5, 100, 10000000000],
		range: [
			'#FF33F3',
			'#3357FF',
			'#F3FF33',
			'#FF33A1',
			'#33FFF6',
			'#A133FF',
			'#FF7F33',
			'#33FF7F',
			'#7F33FF',
			'#FF337A',
			'#33FFA1',
			'#A1FF33',
			'#FF33F3',
			'#33A1FF',
			'#F633FF',
			'#FFA133',
			'#33F6FF',
			'#7AFF33',
			'#33F6FF'
		]
	}
	test.deepEqual(
		result,
		expected,
		`Should remove the extreme outliers from the domain and range with a ${minPercent}% and ${maxPercent}% cutoff`
	)

	minPercent = 0.25
	maxPercent = 0.75
	result = removeInterpolatedOutliers(mockDomainRange, minPercent, maxPercent)
	expected = {
		domain: [-2, -1, -0.75, -0.5, -0.25, 0, 0.5, 0.75, 1, 2, 3],
		range: [
			'#33FFF6',
			'#A133FF',
			'#FF7F33',
			'#33FF7F',
			'#7F33FF',
			'#FF337A',
			'#33FFA1',
			'#A1FF33',
			'#FF33F3',
			'#33A1FF',
			'#F633FF'
		]
	}
	test.deepEqual(
		result,
		expected,
		`Should remove the extreme outliers from the domain and range with a ${minPercent}% and ${maxPercent}% cutoff`
	)

	test.end()
})
