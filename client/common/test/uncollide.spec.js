import tape from 'tape'
import * as d3s from 'd3-selection'
import { uncollide } from '../uncollide'

/*************************
 reusable helper functions
**************************/

const side = 350
const fontSize = 16

function render(data) {
	const holder = d3s.select('body').append('div').style('display', 'inline-block').style('margin', '10px')

	const svg = holder.append('svg').attr('width', side).attr('height', side)

	svg
		.append('rect')
		.attr('x', 0)
		.attr('y', 0)
		.attr('width', side)
		.attr('height', side)
		.attr('fill', 'transparent')
		.style('stroke', '#000')
		.style('stroke-width', 1)

	svg
		.selectAll('circle')
		.data(data)
		.enter()
		.append('circle')
		.attr('r', 5)
		.attr('cx', d => d.x)
		.attr('cy', d => d.y)

	const svgBox = svg.node().getBoundingClientRect()

	const labels = svg.selectAll('g').data(data).enter().append('g')

	labels.each(function (d) {
		const g = d3s.select(this).attr('transform', `translate(${d.x},${d.y})`)
		g.append('text')
			//.attr('x', d.x)
			//.attr('y', d.y)
			.attr('font-size', fontSize)
			.attr('text-anchor', 'end')
			.text(d.label)
		showBox(svg, svgBox, g)
	})

	return { holder, svg, labels }
}

function showBox(svg, svgBox, g) {
	return
	const b = g.node().getBoundingClientRect()
	svg
		.append('rect')
		.attr('x', b.x - svgBox.x)
		.attr('y', b.y - svgBox.y)
		.attr('width', b.width)
		.attr('height', b.height)
		.attr('stroke', '#ccc')
		.attr('stroke-width', '1px')
		.attr('fill', 'transparent')
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- common/uncollide -***-')
	test.end()
})

tape('default options', async test => {
	const x = 0.3 * side,
		y = 0.5 * side
	const data = [
		{ label: 'aaabbbcccdddeeefff', x, y },
		{ label: 'xxxyyyzzz', x: x + 5, y: y + 5 },
		{ label: 'qqqrrrsss', x: x + 35, y: y + 50 }
	]
	const dom = render(data)
	test.equal(dom.holder.selectAll('text').size(), data.length, 'must start with the correct number of labels')
	await uncollide(dom.labels, { nameKey: 'label' })
	await sleep(100)
	const adjFontSize = '12px'
	test.equal(
		dom.labels
			.filter(function () {
				return d3s.select(this).select('text').attr('font-size') === adjFontSize
			})
			.size(),
		data.length,
		`should adjust all text font-size to ${adjFontSize}`
	)
	const text0 = dom.labels.filter(d => d.label === data[0].label).select('text')
	const xy0 = [0, 0]
	test.deepEqual(
		[+text0.attr('x'), +text0.attr('y')],
		xy0,
		`should NOT move the first label: [x,y] = [${xy0.join(',')}]`
	)

	const text1 = dom.labels.filter(d => d.label === data[1].label).select('text')
	const xy1 = [0, 9]
	test.deepEqual([+text1.attr('x'), +text1.attr('y')], xy1, `should move the second label, [x,y]: [${xy1.join(',')}]`)

	const text2 = dom.labels.filter(d => d.label === data[2].label).select('text')
	const xy2 = [0, 0]
	test.deepEqual(
		[+text2.attr('x'), +text2.attr('y')],
		xy2,
		`should NOT move the third label to [x,y]: [${xy2.join(',')}]`
	)
	test.end()
})

tape('overlapping points', async test => {
	const x = 0.3 * side,
		y = 0.5 * side
	const data = [
		{ label: 'ggghhhiiijjjklm', x, y },
		{ label: 'xxxyyyzzz', x, y },
		{ label: 'qqqrrrsss', x: x + 35, y: y + 50 }
	]
	const dom = render(data)
	await uncollide(dom.labels, { nameKey: 'label' })
	await sleep(300)
	const adjFontSize = '12px'
	test.equal(
		dom.labels
			.filter(function () {
				return d3s.select(this).select('text').attr('font-size') === adjFontSize
			})
			.size(),
		data.length,
		`should adjust all text font-size to ${adjFontSize}`
	)
	const text0 = dom.labels.filter(d => d.label === data[0].label).select('text')
	const xy0 = [0, 0]
	test.deepEqual(
		[+text0.attr('x'), +text0.attr('y')],
		xy0,
		`should NOT move the first label: [x,y] = [${xy0.join(',')}]`
	)

	const text1 = dom.labels.filter(d => d.label === data[1].label).select('text')
	const xy1 = [0, 14]
	test.deepEqual([+text1.attr('x'), +text1.attr('y')], xy1, `should move the second label, [x,y]: [${xy1.join(',')}]`)

	const text2 = dom.labels.filter(d => d.label === data[2].label).select('text')
	const xy2 = [0, 0]
	test.deepEqual(
		[+text2.attr('x'), +text2.attr('y')],
		xy2,
		`should NOT move the first label to [x,y]: [${xy2.join(',')}]`
	)
	test.end()
})

tape.skip('svg overflow', async test => {
	const x = 0.3 * side,
		y = 0.5 * side
	const data = [
		{ label: 'ggghhhiiijjjklmnopqrstuvwxyz', x, y },
		{ label: 'xxxyyyzzz', x: x + 5, y: y - 5 },
		{ label: 'qqqrrrsss', x: x + 35, y: y + 50 }
	]
	const dom = render(data)
	await uncollide(dom.labels, { nameKey: 'label' })
	await sleep(300)
	const adjFontSize = '12px'
	test.equal(
		dom.labels
			.filter(function () {
				return d3s.select(this).select('text').attr('font-size') === adjFontSize
			})
			.size(),
		data.length,
		`should adjust all text font-size to ${adjFontSize}`
	)
	const text0 = dom.labels.filter(d => d.label === data[0].label).select('text')
	const xy0 = [49.078125, 0]
	test.deepEqual([+text0.attr('x'), +text0.attr('y')], xy0, `should move the first label: [x,y] = [${xy0.join(',')}]`)
	test.end()
})
