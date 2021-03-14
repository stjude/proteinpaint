const tape = require('tape')
const d3s = require('d3-selection')
const uncollide = require('../uncollide')

/*************************
 reusable helper functions
**************************/

const side = 350
const fontSize = 16

function render(data) {
	const holder = d3s
		.select('body')
		.append('div')
		.style('margin', '10px')
	const svg = holder
		.append('svg')
		.attr('width', side)
		.attr('height', side)

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

	const labels = svg
		.selectAll('g')
		.data(data)
		.enter()
		.append('g')
		.each(function(d) {
			const g = d3s.select(this).attr('transform', `translate(${d.x},${d.y})`)
			g.append('text')
				//.attr('x', d.x)
				//.attr('y', d.y)
				.attr('font-size', fontSize)
				.attr('text-anchor', 'start')
				.text(d.label)
			showBox(svg, g)
		})

	return { holder, svg, labels }
}

function showBox(svg, g) {
	const d = g.datum()
	const b = g.node().getBoundingClientRect()
	const s = svg.node().getBoundingClientRect()
	//const m = g.node().getCTM(); console.log(b, m)
	svg
		.append('rect')
		.attr('x', b.x - s.x)
		.attr('y', b.y - s.y)
		.attr('width', b.width)
		.attr('height', b.height)
		.attr('stroke', '#ccc')
		.attr('stroke-width', '1px')
		.attr('fill', 'transparent')
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- common/uncollide -***-')
	test.end()
})

tape('test', test => {
	const x = 0.3 * side,
		y = 0.5 * side
	const data = [{ label: 'aaabbbcccddd', x, y }, { label: 'xxxyyyzzz', x: x + 20, y: y + 20 }]
	const dom = render(data)
	test.equal(dom.holder.selectAll('text').size(), data.length, 'must start with the correct number of labels')
	test.end()
})
