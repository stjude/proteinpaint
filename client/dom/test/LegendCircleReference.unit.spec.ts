import tape from 'tape'
import { select } from 'd3-selection'
import { LegendCircleReference } from '#dom'

/*************************
 reusable helper functions
**************************/
function getHolder() {
	return select('body').append('div').style('max-width', '800px').style('border', '1px solid #555')
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.pass('-***- dom/LegendCircleReference -***-')
	test.end()
})

tape('Default LegendCircleReference', test => {
	test.timeoutAfter(100)

	const holder: any = getHolder()
	const svg = holder.append('svg').attr('width', 300).attr('height', 300)

	const ui = new LegendCircleReference({
		g: svg.append('g').attr('transform', 'translate(10, 10)'),
		inputMax: 20,
		inputMin: 5,
		isAscending: true,
		maxRadius: 20,
		minRadius: 5,
		prompt: 'Pixels',
		title: 'Test title',
		dotScaleCallback: () => {
			test.pass('dotScaleCallback')
		},
		minMaxCallback: () => {
			test.pass('minMaxCallback')
		}
	})

	test.equal(ui.g.selectAll('circle').size(), 2, 'Should render 2 circle elements')
	test.equal(ui.g.selectAll('text').size(), 3, 'Should render 3 text elements')
	test.equal(ui.g.selectAll('line').size(), 2, 'Should render 2 line elements')
	test.equal(ui.g.selectAll('rect').size(), 1, 'Should render 1 rect element')

	if (test['_ok']) holder.remove()
	test.end()
})
