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

	new LegendCircleReference({
		g: svg.append('g').attr('transform', 'translate(10, 10)'),
		inputMax: 4,
		inputMin: 0.5,
		isAscending: true,
		maxRadius: 20,
		minRadius: 5,
		prompt: 'Pixels',
		title: 'Test title',
		dotScaleCallback: () => {
			console.log('dotScaleCallback')
		},
		minMaxCallback: (min, max) => {
			console.log('minMaxCallback', min, max)
		}
	})

	// test.equal(ui.g.selectAll('*').size(), 0, 'Should render 0 elements')

	test.end()
})
