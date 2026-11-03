import tape from 'tape'
import { select } from 'd3-selection'
import { DotSizeScale } from '#dom'

/*************************
 reusable helper functions
**************************/
function getHolder() {
	return select('body').append('div').style('max-width', '800px')
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- dom/DotSizeScale -***-')
	test.end()
})

tape('Default DotSizeScale', test => {
	test.timeoutAfter(100)

	const holder: any = getHolder()
	const svg = holder.append('svg').attr('width', 300).attr('height', 300)

	const ui = new DotSizeScale({
		g: svg.append('g').attr('transform', 'translate(20, 20)'),
		inputMax: 20,
		inputMin: 5,
		isAscending: true,
		maxRadius: 20,
		minRadius: 5,
		title: 'Test title',
		menu: {
			minMaxLabel: 'Pixels',
			showOrder: true,
			callback: obj => {
				console.log(obj) // so ts doesn't complain
			}
		}
	})

	test.equal(ui.g.selectAll('circle').size(), 2, 'Should render 2 circle elements')
	test.equal(ui.g.selectAll('text').size(), 3, 'Should render 3 text elements')
	test.equal(ui.g.selectAll('line').size(), 2, 'Should render 2 line elements')
	test.equal(ui.g.selectAll('rect').size(), 1, 'Should render 1 rect element')

	if (test['_ok']) holder.remove()
	test.end()
})

function getScale(opts: any, size = 600) {
	const holder: any = getHolder()
	const svg = holder.append('svg').attr('width', size).attr('height', size)
	const ui = new DotSizeScale({
		g: svg.append('g'),
		inputMax: 300,
		inputMin: 2,
		title: 'Test title',
		...opts
	})
	return { holder, ui }
}

/** Everything that was rendered is inside of the svg that getDimensions() asks for. The title is above the origin
 * of the holder, so only the left, right, and bottom edges are checked, and the top of the circles. */
function fits(ui: any) {
	const box = ui.g.node().getBBox()
	const { width, height } = ui.getDimensions()
	const circleTop = Math.min(
		...ui.g
			.selectAll('circle')
			.nodes()
			.map((c: any) => c.parentNode.transform.baseVal[0].matrix.f - Number(c.getAttribute('r')))
	)
	return {
		left: box.x >= 0,
		right: box.x + box.width <= width,
		bottom: box.y + box.height <= height,
		top: circleTop >= 0
	}
}

/** The text of the labels, from the first circle to the last. The title is the first text. */
function labels(ui: any) {
	return ui.g
		.selectAll('text')
		.nodes()
		.slice(1)
		.map((t: any) => t.textContent)
}

tape('Labels', test => {
	test.timeoutAfter(100)
	const ascending = getScale({ minRadius: 5, maxRadius: 20 })
	test.deepEqual(labels(ascending.ui), ['5', '20'], 'Should label the smaller circle first in an ascending scale')
	const given = getScale({ minRadius: 5, maxRadius: 20, minLabel: 1.5, maxLabel: 9 })
	test.deepEqual(labels(given.ui), ['1.5', '9'], 'Should use the labels that were given')
	const descending = getScale({ minRadius: 5, maxRadius: 20, minLabel: 1.5, maxLabel: 9, isAscending: false })
	test.deepEqual(labels(descending.ui), ['9', '1.5'], 'Should keep each given label with its circle when descending')
	for (const { holder } of [ascending, given, descending]) holder.remove()
	test.end()
})

tape('Layout of small circles', test => {
	test.timeoutAfter(100)
	const { holder, ui } = getScale({ minRadius: 5, maxRadius: 20 })
	const layout = ui.getLayout()
	test.deepEqual(
		[layout.x, layout.y, layout.width],
		[40, 40, 70],
		'Should keep the position and distance that small circles always had'
	)
	const dimensions = ui.getDimensions()
	test.ok(dimensions.width > 0 && dimensions.height > 0, 'Should size the svg')
	test.deepEqual(Object.values(fits(ui)), [true, true, true, true], 'Should fit everything in the dimensions')
	if (test['_ok']) holder.remove()
	test.end()
})

tape('Layout of large circles', test => {
	test.timeoutAfter(100)
	const { holder, ui } = getScale({ minRadius: 40, maxRadius: 100 })
	const { x, y, width } = ui.getLayout()
	test.ok(width - 40 - 100 >= ui.circleGap, 'Should not let the larger circle cover the smaller one')
	test.ok(x - 40 - ui.shift >= 0, 'Should leave room for the label of the smaller circle')
	test.ok(y - 100 >= 0, 'Should leave room above the larger circle')
	test.deepEqual(Object.values(fits(ui)), [true, true, true, true], 'Should fit everything in the dimensions')
	const small = getScale({ minRadius: 5, maxRadius: 20 })
	test.ok(
		ui.getDimensions().width > small.ui.getDimensions().width &&
			ui.getDimensions().height > small.ui.getDimensions().height,
		'Should ask for more room for larger circles'
	)
	small.holder.remove()
	if (test['_ok']) holder.remove()
	test.end()
})

tape('Explicit position', test => {
	test.timeoutAfter(100)
	const { holder, ui } = getScale({ minRadius: 5, maxRadius: 20, x: 60, y: 55 })
	const layout = ui.getLayout()
	test.deepEqual([layout.x, layout.y], [60, 55], 'Should use the position of the caller')
	if (test['_ok']) holder.remove()
	test.end()
})

tape('Layout follows the radii set by the user', test => {
	test.timeoutAfter(100)
	const { holder, ui } = getScale({ minRadius: 5, maxRadius: 20 })
	ui.minRadius = 40
	ui.maxRadius = 100
	ui.renderLegendComponent()
	const { y, width } = ui.getLayout()
	test.ok(y >= 110, 'Should move the circles down for a larger maximum')
	test.ok(width >= 150, 'Should move the circles apart for larger radii')
	test.deepEqual(Object.values(fits(ui)), [true, true, true, true], 'Should still fit everything in the dimensions')
	if (test['_ok']) holder.remove()
	test.end()
})

tape('Descending scale', test => {
	test.timeoutAfter(100)
	const { holder, ui } = getScale({ minRadius: 40, maxRadius: 100, isAscending: false })
	const { x } = ui.getLayout()
	test.ok(x - 100 - ui.shift >= 0, 'Should leave room for the label of the larger circle on the left')
	const radii = ui.g
		.selectAll('circle')
		.nodes()
		.map((c: any) => Number(c.getAttribute('r')))
	test.deepEqual(radii, [100, 40], 'Should draw the larger circle first')
	test.deepEqual(labels(ui), ['100', '40'], 'Should label each circle with its own value')
	test.deepEqual(Object.values(fits(ui)), [true, true, true, true], 'Should fit everything in the dimensions')
	if (test['_ok']) holder.remove()
	test.end()
})
