import tape from 'tape'
import * as d3s from 'd3-selection'
import { Menu } from '#dom/Menu'

/*************************
 reusable helper functions
**************************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- dom/menu -***-')
	test.end()
})

tape.only('Launch Menu', test => {
	const x = new Menu()
	test.end()
})
