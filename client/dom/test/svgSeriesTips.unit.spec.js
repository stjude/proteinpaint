import tape from 'tape'
import { getSeriesTip } from '../svgSeriesTips'
import { select } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { Menu } from '#dom/menu'
/*
 Tests: 
	default behavior
 */

tape('\n', test => {
	test.comment('-***- dom/svgSeriesTips.unit.spec -***-')
	test.end()
})

tape('default behavior', test => {
	const width = 400
	const height = 350
	const svg = select('body')
		.append('div')
		.style('position', 'fixed')
		.style('bottom', 50)
		.style('left', 50)
		.append('svg')
		.attr('width', width)
		.attr('height', height)
		.style('margin', '20px')
		.style('fill', 'transparent')
		.style('stroke', '#000')
	const line = svg.append('line').style('stroke', '#000').style('stroke-width', '1px')
	const rect = svg.append('rect').attr('x', 0).attr('y', 0).attr('width', width).attr('height', height)
	const tip = new Menu({ padding: '5px' })

	const seriesTip = getSeriesTip(line, rect, tip)
	test.equal(line.style('display'), 'none', 'should hide the vertical line initially')

	const domain = [0, 4]
	const xScale = scaleLinear().domain(domain).range([0, width])
	const serieses = [
		{
			data: [
				{ x: 1, html: 'a1' },
				{ x: 2, html: 'a2' },
				{ x: 3, html: 'a3' },
				{ x: 4, html: 'a4' }
			]
		},
		{
			data: [
				{ x: 2.5, html: 'z2.5' },
				{ x: 3.5, html: 'z3.5' },
				{ x: 4, html: 'z4' }
			]
		}
	]
	seriesTip.update({ xScale, serieses })
	const rectNode = rect.node()
	const rectBox = rectNode.getBoundingClientRect()
	rectNode.dispatchEvent(
		new MouseEvent('mouseover', {
			view: window,
			bubbles: true,
			cancelable: true,
			clientX: rectBox.x + 120,
			clientY: rectBox.y + 120
		})
	)
	test.notEqual(line.style('display'), 'none', 'should display the vertical line on mouseover')
	const html1 = tip.d.html()
	test.ok(html1.includes('a1') && !html1.includes('z'), 'must only include a series info in the tip')

	rectNode.dispatchEvent(
		new MouseEvent('mousemove', {
			view: window,
			bubbles: true,
			cancelable: true,
			clientX: rectBox.x + 300,
			clientY: rectBox.y + 120
		})
	)
	const html2 = tip.d.html()
	test.ok(html2.includes('a3') && html2.includes('z2.5'), 'must only include both series a & z info in the tip')

	if (test._ok) {
		seriesTip.destroy()
		svg.remove()
		tip.hide()
		tip.d.remove()
	}
	test.end()
})
