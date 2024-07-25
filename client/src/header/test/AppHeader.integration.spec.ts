import tape from 'tape'
import * as d3s from 'd3-selection'
import { AppHeader } from '../AppHeader'
import { Menu } from '../../../dom/menu.js'
import { hg38, hg19 } from '../../../test/testdata/genomes'

/**************
 helper functions
***************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

function getHeader(opts) {
	const _opts = {
		headtip: new Menu({ padding: '0px' }),
		app: {
			genomes: {
				hg19,
				hg38
			}
		},
		data: {
			cardsPath: 'cards',
			codedate: 'Fri Jul 12 2024',
			genomes: {
				hg19,
				hg38
			}
		},
		jwt: {}
	}

	return new AppHeader(Object.assign(_opts, opts))
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- src/header/AppHeader -***-')
	test.end()
})

tape.skip('Validate rendering', test => {
	test.timeoutAfter(3000)
	const holder = getHolder()
	const header = getHeader({ holder })

	test.equal(holder.selectAll('input').size(), 1, 'Should render search box')
	test.end()
})
