import tape from 'tape'
import { getHslPalette } from '../colorPalette.js'
import { select } from 'd3-selection'

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- dom/boxplot -***-')
	test.end()
})

tape('default behavior', test => {
	const numColors = 30
	const colors = getHslPalette(30)
	test.equal(colors.length, numColors, 'should give the expected number of colors')

	const holder = select(document.body).append('div').style('border', '1px solid #000')
	const divs = holder
		.selectAll('div')
		.data(colors)
		.enter()
		.append('div')
		.attr('title', d => d)
		.style('display', 'inline-block')
		.style('width', '30px')
		.style('height', '30px')
		.style('background', d => d)

	const uniqueColors = new Set()
	for (const div of holder.node().querySelectorAll('div')) {
		// getComputedStyle() will normalize to an rgb color value
		uniqueColors.add(window.getComputedStyle(div).backgroundColor)
	}

	test.equal(uniqueColors.size, numColors, 'should generate unique colors')
	if (test._ok) holder.remove()
	test.end()
})
