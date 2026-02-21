import tape from 'tape'
import { getHslPalette } from '../colorPalette.js'
import { select } from 'd3-selection'
import { getColorScheme } from '#shared'

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- dom/colorPalette -***-')
	test.end()
})

tape('default behavior', test => {
	const n = 9 // target number of colors
	compare(test, n, getHslPalette(n, 90, 70))
	compare(test, n, getHslPalette(n, 10, 70))
	compare(test, n, getHslPalette(n, 50, 70))
	compare(test, n, getHslPalette(n, 90, 30))
	compare(test, n, getHslPalette(n, 10, 30))
	compare(test, n, getHslPalette(n, 50, 30))
	//compare(test, n, getColorScheme(n))
	test.end()
})

/**************
 test helpers
***************/

function compare(test, numColors, colors) {
	test.equal(colors.length, numColors, 'should give the expected number of colors')

	const holder = select(document.body)
		.append('div')
		.style('width', 'fit-content')
		.style('margin', '5px')
		.style('border', '1px solid #000')
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
	//if (test._ok) holder.remove()
}
