import tape from 'tape'
import { NumericDensity } from '../NumericDensity.ts'
import { termjson } from '../../../test/testdata/termjson'
import { agedx as agedxViolinData } from '../../../test/testdata/violinPlotData.js'
import { TwRouter } from '#tw'
import * as d3s from 'd3-selection'

/*************************
 reusable helper functions
**************************/

async function getNumericDensity(opts: any = {}) {
	const term = opts.term || JSON.parse(JSON.stringify(termjson.agedx))
	const violinData = opts.violinData || agedxViolinData
	const rawTw = {
		term,
		q: {
			mode: 'continuous'
		}
	}
	const tw = await TwRouter.initRaw(rawTw)

	const density = new NumericDensity({
		termsetting: {
			tw,
			term: rawTw.term,
			q: rawTw.q,
			opts: {
				// numericEditMenuVersion: ['continuous', 'discrete', 'binary', 'spline'],
				// usecase: opts.usecase
				...opts
			},
			api: {
				runCallback() {}
			},
			dom: {
				tip: {
					hide() {}
				}
			},
			vocabApi: {
				getViolinBox() {
					return violinData
				}
			}
		}
	})

	const holder = d3s
		.select('body')
		.append('div')
		.style('position', 'fixed')
		.style('top', 500)
		.style('left', 500)
		.style('width', 'fit-content')
		.style('margin', '20px')
		.style('padding', '5px')
		.style('border', '1px solid #000')

	return {
		rawTw,
		tw,
		holder,
		density,
		destroy: () => {
			density.destroy()
			holder.remove()
		}
	}
}

/* a term with valueConversion{} stores its values in one unit (e.g. day) and is read by users in
another (e.g. year). density_data is in the stored unit, while the boundary values exchanged with
the bin/knot editors and the domain of this.xscale are in the user-facing one */
const DAY_TO_YEAR = 1 / 365.25

function getConvertedTerm(overrides: any = {}) {
	const term = JSON.parse(JSON.stringify(termjson.agedx))
	term.valueConversion = { fromUnit: 'day', toUnit: 'year', scaleFactor: DAY_TO_YEAR }
	return Object.assign(term, overrides)
}

/* drag the first rendered line and resolve with the value handed to the boundary callback.
the callback fires on each drag event and again on drag end, so only the first is kept */
async function dragFirstLine(density, values, xOffset = 150) {
	let resolve
	const dragged = new Promise<{ lineData: any; value: number }>(res => (resolve = res))
	await density.setBinLines({
		values,
		callback(lineData, value) {
			resolve({ lineData, value })
		}
	})
	const lines = [...density.dom.binsize_g.node().querySelectorAll('line')]
	simulateDrag(lines[0], xOffset)
	return dragged
}

function simulateDrag(elem, xOffset) {
	const box = elem.getBoundingClientRect()
	const draggedX = box.x + xOffset
	elem.dispatchEvent(
		new MouseEvent('mousedown', {
			bubbles: true,
			cancelable: true,
			clientX: box.x,
			clientY: box.y,
			view: window
		})
	)
	// elem.dispatchEvent(
	// 	new MouseEvent('mousemove', {
	// 		bubbles: true,
	// 		cancelable: true,
	// 		clientX: draggedX,
	// 		clientY: box.y,
	// 		view: window
	// 	})
	// )
	elem.dispatchEvent(
		new MouseEvent('mouseup', {
			bubbles: true,
			cancelable: true,
			clientX: draggedX,
			clientY: 150,
			view: window
		})
	)
}

tape('violin as density plot', async test => {
	const { density, holder, destroy } = await getNumericDensity()
	await density.showViolin(holder)
	test.equal(holder.selectAll('svg').size(), 1, `should render a density plot svg`)
	test.equal(holder.selectAll('svg image').size(), 1, `should render an image inside the svg`)
	if ((test as any)._ok) destroy()
	test.end()
})

tape('1 draggable line without lastVisibleLine', async test => {
	test.timeoutAfter(20)
	test.plan(4)
	const { density, holder, destroy } = await getNumericDensity()
	await density.showViolin(holder)

	let hasTestedCallback = false
	const values = [
		{ x: 100, isDraggable: true, movesWithLineIndex: -1 },
		{ x: 1000, movesWithLineIndex: 0 },
		{ x: 3000, movesWithLineIndex: 0 }
	]

	density.setBinLines({
		values,
		callback(lineData, value) {
			if (hasTestedCallback === true) return
			hasTestedCallback = true
			const comparableKeys = Object.keys(values[0])
			test.deepEqual(
				Object.fromEntries(Object.entries(lineData).filter(kv => comparableKeys.includes(kv[0]))),
				values[0],
				`should provide a copy of the draggable line data as the first argument to callback`
			)
			test.true((value - 1516.62) / value < 0.01, `should provide the value as the second argument to callback`)
			test.deepEqual(
				lines
					.filter(l => l.style.display !== 'none')
					.map((l, i) => Math.abs(Math.floor(Number(l.getAttribute('x1')) - x1b4drag[i] - xOffset)) < 2),
				// check that the difference between expected and actual x values is less than a few pixels
				[true, true, true],
				`should also move non-draggable lines in the expected x-positions of the density plot`
			)
			if ((test as any)._ok) destroy()
			test.end()
		}
	})

	const lines = [...density.dom.binsize_g.node().querySelectorAll('line')]
	const x1b4drag = [21, 116, 328]
	test.deepEqual(
		lines.filter(l => l.style.display !== 'none').map(l => Number(l.getAttribute('x1'))),
		x1b4drag,
		`should render 3 visible lines in the expected x-positions of the density plot`
	)

	const xOffset = 150
	// will call the callback() in setBinLines() argument above
	simulateDrag(lines[0], xOffset)
})

tape('1 draggable line with lastVisibleLine', async test => {
	test.timeoutAfter(20)
	test.plan(4)
	const { density, holder, destroy } = await getNumericDensity()
	await density.showViolin(holder)

	let hasTestedCallback = false
	const values = [
		{ x: 100, isDraggable: true, movesWithLineIndex: -1 },
		{ x: 500, movesWithLineIndex: 0 },
		{ x: 1000, movesWithLineIndex: 0 },
		{ x: 2000, isDraggable: true, isLastVisibleLine: true }
	]

	density.setBinLines({
		values,
		callback(lineData, value) {
			if (hasTestedCallback === true) return
			hasTestedCallback = true
			const comparableKeys = Object.keys(values[0])
			test.deepEqual(
				Object.fromEntries(Object.entries(lineData).filter(kv => comparableKeys.includes(kv[0]))),
				values[0],
				`should provide a copy of the draggable line data as the first argument to callback`
			)
			test.true((value - 1516.62) / value < 0.01, `should provide the value as the second argument to callback`)
			const expectedXDiff = [0, 0, 44]
			test.deepEqual(
				lines
					.filter(l => l.style.display !== 'none')
					.map(
						(l, i) => Math.abs(Math.floor(Number(l.getAttribute('x1')) - x1b4drag[i] - xOffset) + expectedXDiff[i]) < 2
					),
				// check that the difference between expected and actual x values is less than a few pixels
				[true, true, true],
				`should also move non-draggable lines in the expected x-positions of the density plot`
			)
			if ((test as any)._ok) destroy()
			test.end()
		}
	})

	const lines = [...density.dom.binsize_g.node().querySelectorAll('line')]
	const x1b4drag = [21, 63, 116, 222]
	test.deepEqual(
		lines.filter(l => l.style.display !== 'none').map(l => Number(l.getAttribute('x1'))),
		x1b4drag,
		`should render 3 visible lines in the expected x-positions of the density plot`
	)

	const xOffset = 150
	// will call the callback() in setBinLines() argument above
	simulateDrag(lines[0], xOffset)
})

tape('converted term: plot range in the user-facing unit', async test => {
	test.timeoutAfter(1000)
	const { density, holder, destroy } = await getNumericDensity({ term: getConvertedTerm() })
	await density.showViolin(holder)

	test.equal(density.scaleFactor, DAY_TO_YEAR, `should take the scaleFactor from term.valueConversion`)
	test.equal(
		density.displayMin,
		agedxViolinData.min * DAY_TO_YEAR,
		`should state the plot minimum in the user-facing unit`
	)
	test.equal(
		density.displayMax,
		agedxViolinData.max * DAY_TO_YEAR,
		`should state the plot maximum in the user-facing unit`
	)
	/* an editor input shows a converted value rounded to 2 decimals, but a domain endpoint must not
	be: rounding moves every scaled x by up to half of the last shown digit, and collapses the domain
	outright when the converted range is smaller than that */
	test.notEqual(
		density.displayMax,
		Number((agedxViolinData.max * DAY_TO_YEAR).toFixed(2)),
		`should not round the plot maximum to the decimals an editor input shows`
	)

	// the bin lines are drawn over the violin's axis, so the two must scale the same values alike
	await density.setBinLines({ values: [{ x: 2, isDraggable: true }], callback() {} })
	test.deepEqual(
		density.xscale.domain(),
		density.vr.axisScaleUI.domain(),
		`should give xscale the same domain as the violin axis it overlays`
	)
	const v = 5 // years
	test.equal(
		density.xscale(v) + density.plot_size.xpad,
		density.vr.axisScaleUI(v) + density.vr.shiftx,
		`should map a value to the same x as the violin axis, allowing for the two group translations`
	)

	if ((test as any)._ok) destroy()
	test.end()
})

tape('converted term: a range narrower than the rounding of a displayed value', async test => {
	test.timeoutAfter(1000)
	/* a stored range of under ~2 days is under 0.005 years, so both endpoints round to the same
	2-decimal year. rounding them, as toUserUnit() does, left xscale with a zero-width domain: every
	line landed on the same x and every drag was rejected as being outside the plot */
	const violinData = { ...agedxViolinData, min: 100.5, max: 101.5 }
	const { density, holder, destroy } = await getNumericDensity({ term: getConvertedTerm(), violinData })
	await density.showViolin(holder)

	test.equal(
		Number(density.displayMin.toFixed(2)),
		Number(density.displayMax.toFixed(2)),
		`the test data should be a range that rounds to a single value in the user-facing unit`
	)
	test.notEqual(density.displayMin, density.displayMax, `should keep the two plot endpoints distinct`)

	/* the dragged value is reported to 2 decimals, which is coarser than a range this narrow, so
	only assert that a drag is accepted and reports a number at all -- with a collapsed domain every
	drag was rejected as being outside the plot and the callback was never called */
	const { value } = await dragFirstLine(density, [{ x: 101 * DAY_TO_YEAR, isDraggable: true }])
	test.true(Number.isFinite(value), `should report a value for a drag within the plot`)
	test.equal(
		Math.round(density.xscale(density.displayMax)) - Math.round(density.xscale(density.displayMin)),
		density.plot_size.width,
		`should scale the range over the full width of the plot`
	)

	if ((test as any)._ok) destroy()
	test.end()
})

tape('dragged value is rounded for the unit it is reported in', async test => {
	test.timeoutAfter(1000)
	/* a converted value is on a much smaller scale than what it was converted from (12 years vs
	4710 days), so it is reported to 2 decimals; an unconverted integer term is reported whole */
	const converted = await getNumericDensity({ term: getConvertedTerm() })
	await converted.density.showViolin(converted.holder)
	const convertedDrag = await dragFirstLine(converted.density, [{ x: 2, isDraggable: true }])
	test.equal(
		Number(convertedDrag.value.toFixed(2)),
		convertedDrag.value,
		`should report a converted value with no more than 2 decimals`
	)
	test.true(
		convertedDrag.value > 2 &&
			convertedDrag.value > converted.density.displayMin &&
			convertedDrag.value < converted.density.displayMax,
		`should report a converted value that moved to the right and stayed within the plot range (got ${convertedDrag.value})`
	)
	if ((test as any)._ok) converted.destroy()

	const term = JSON.parse(JSON.stringify(termjson.agedx))
	term.type = 'integer'
	const integer = await getNumericDensity({ term })
	await integer.density.showViolin(integer.holder)
	test.equal(integer.density.scaleFactor, 1, `should not convert a term without valueConversion`)
	const integerDrag = await dragFirstLine(integer.density, [{ x: 100, isDraggable: true }])
	test.equal(
		integerDrag.value,
		Math.round(integerDrag.value),
		`should report a whole number for an unconverted integer term`
	)
	if ((test as any)._ok) integer.destroy()

	test.end()
})

/* a boundary line may not be dragged onto or past a neighboring one. an editor addresses a boundary
by the index its line had when the lines were rendered, and re-derives the values it writes back to
its inputs from its own bin list, which it keeps sorted. so a line that crosses its neighbor is
addressed as the neighbor by the next drag event, and two boundaries of the same value are merged
into one, leaving the editor holding fewer boundaries than the plot is showing lines */
tape('a dragged line stops at its neighboring line', async test => {
	test.timeoutAfter(1000)
	const { density, holder, destroy } = await getNumericDensity()
	await density.showViolin(holder)

	const calls: { index: number; value: number }[] = []
	const values = [
		{ x: 100, isDraggable: true },
		{ x: 2000, isDraggable: true }
	]
	await density.setBinLines({
		values,
		callback(lineData, value) {
			calls.push({ index: lineData.index, value })
		}
	})
	const lines = [...density.dom.binsize_g.node().querySelectorAll('line')]
	const lineX = (i: number) => Number(lines[i].getAttribute('x1'))
	const neighborX = lineX(1)

	// drag the left line to the right, well past the second line
	simulateDrag(lines[0], 400)
	test.equal(calls.length, 1, `should report the drag of a line that is dragged past its neighbor`)
	test.true(
		calls[0].value < values[1].x,
		`should report a value below the neighboring boundary (got ${calls[0].value})`
	)
	test.true(lineX(0) < neighborX, `should stop the dragged line before the neighboring line`)
	test.equal(lineX(1), neighborX, `should leave the neighboring line where it was`)

	// and back to the left, past the plot minimum
	simulateDrag(lines[0], -800)
	test.true(calls[1].value > density.displayMin, `should report a value above the plot minimum (got ${calls[1].value})`)
	test.true(lineX(0) > Math.round(density.xscale(density.displayMin)), `should stop the dragged line inside the plot`)

	// the same holds in the other direction, for the line that has a neighbor to its left
	const draggedX = lineX(0)
	simulateDrag(lines[1], -800)
	test.true(lineX(1) > draggedX, `should stop a line dragged to the left after its neighboring line`)
	test.true(
		calls[calls.length - 1].value > calls[1].value,
		`should report a value above the neighboring boundary (got ${calls[calls.length - 1].value})`
	)

	if ((test as any)._ok) destroy()
	test.end()
})

tape('a boundary line drawn outside the plot is still draggable', async test => {
	test.timeoutAfter(1000)
	/* a bin boundary saved for a wider cohort can be beyond the range of the values now plotted, in
	which case its line is drawn past the edge of the plot, where every pointer position is out of
	bounds. it must still be draggable back into the plot */
	const { density, holder, destroy } = await getNumericDensity()
	await density.showViolin(holder)

	const calls: number[] = []
	await density.setBinLines({
		// agedx values run to 4710, so a boundary of 9000 is drawn past the right edge of the plot
		values: [
			{ x: 100, isDraggable: true },
			{ x: 9000, isDraggable: true }
		],
		callback(_, value) {
			calls.push(value)
		}
	})
	const lines = [...density.dom.binsize_g.node().querySelectorAll('line')]
	const scaledMaxX = Math.round(density.xscale(density.displayMax))
	test.true(
		Number(lines[1].getAttribute('x1')) > scaledMaxX,
		`the test data should put the second line past the right edge of the plot`
	)

	// a small drag, with the pointer never entering the plot
	simulateDrag(lines[1], -30)
	test.equal(calls.length, 1, `should report a drag of a line that is drawn outside the plot`)
	test.true(calls[0] <= density.displayMax, `should report a value within the plot range (got ${calls[0]})`)
	test.equal(
		Number(lines[1].getAttribute('x1')),
		scaledMaxX - 1,
		`should move the line to just inside the edge of the plot`
	)

	if ((test as any)._ok) destroy()
	test.end()
})

tape('a dragged line does not report the value of its neighboring line', async test => {
	test.timeoutAfter(1000)
	/* the reported value is rounded, so with a narrow range a line can round onto its neighbor's
	value while still being pixels away from it. the two boundaries would then merge into one */
	const term = JSON.parse(JSON.stringify(termjson.agedx))
	term.type = 'integer'
	const violinData = { ...agedxViolinData, min: 0, max: 10 }
	const { density, holder, destroy } = await getNumericDensity({ term, violinData })
	await density.showViolin(holder)

	const calls: number[] = []
	await density.setBinLines({
		values: [
			{ x: 5, isDraggable: true },
			{ x: 6, isDraggable: true }
		],
		callback(_, value) {
			calls.push(value)
		}
	})
	const lines = [...density.dom.binsize_g.node().querySelectorAll('line')]
	// 50px per whole number, so this lands 5px short of the neighboring line but rounds onto its value
	simulateDrag(lines[0], 45)
	test.deepEqual(calls, [], `should not report a drag that rounds onto the neighboring boundary`)

	// a drag that rounds to a value of its own is still reported
	simulateDrag(lines[0], -60)
	test.deepEqual(calls, [4], `should report a drag that rounds to a value between the neighboring boundaries`)

	if ((test as any)._ok) destroy()
	test.end()
})
