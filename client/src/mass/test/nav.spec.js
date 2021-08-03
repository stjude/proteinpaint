import tape from 'tape'
import { select } from 'd3-selection'

/*************************
 reusable helper functions
**************************/

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- mass/nav -***-')
	test.end()
})

tape('tabs', async function(test) {
	const mass = await window.runp4({
		debug: 1,
		holder: select('body')
			.append('div')
			.node(),
		mass: {
			state: {
				genome: 'hg38',
				dslabel: 'SJLIFE',
				activeCohort: 1,
				nav: {
					show_tabs: true
				},
				termfilter: {
					filter: []
				}
			}
		}
	})[0]
	console.log(26, mass)

	test.pass()
	test.end()
})
