import tape from 'tape'
import { getRunPp } from '../../test/front.helpers.js'
import { detectOne } from '../../test/test.helpers.js'

/**************
 test sections

grin2
***************/

tape('\n', function (test) {
	test.comment('-***- plots/grin2-***-')
	test.end()
})

tape('grin2', function (test) {
	runpp({
		state: {
			plots: [
				{
					chartType: 'grin2'
				}
			]
		},
		grin2: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})
	async function runTests(g) {
		test.ok(g.Inner.runButton, 'Run button is created')

		// click submit button to run analysis
		g.Inner.runButton.node().dispatchEvent(new Event('click'), { bubbles: true })
		const svg = await detectOne({ elem: g.Inner.dom.div.node(), selector: '[data-testid="sjpp-manhattan"]' })
		test.ok(svg, '<svg> is rendered')

		if (test['_ok']) g.Inner.app.destroy()
		test.end()
	}
})

/*************************
 reusable helper functions
**************************/

const runpp = getRunPp('mass', {
	state: {
		nav: { activeTab: 1 },
		vocab: { dslabel: 'TermdbTest', genome: 'hg38-test' }
	},
	debug: 1
})
