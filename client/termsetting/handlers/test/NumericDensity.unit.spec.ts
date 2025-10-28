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
	const term = JSON.parse(JSON.stringify(termjson.agedx))
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
				getViolinPlotData() {
					return agedxViolinData
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
