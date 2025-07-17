import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'

/* Tests
	- "Active items" in about tab
*/

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38-test',
		nav: {
			activeTab: 0
		}
	},
	debug: 1
})

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- mass/About -***-')
	test.end()
})

tape('"Active items" in about tab', function (test) {
	test.timeoutAfter(3000)

	runpp({
		about: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(about) {
		about.on('postRender.test', null)
		const aboutDom = about.Inner.subheader
		const activeItems = aboutDom.select('div[data-testid="sjpp-custom-active-item-btn"]').nodes()
		test.equal(
			activeItems.length,
			about.Inner.aboutOverrides.activeItems.items.length,
			'Should display plot buttons for all active items defined in the dataset config.'
		)

		activeItems[0].click()
		const appInner = about.Inner.app.Inner

		//Give app dispatch time to process
		//Leave this timeout higher to pass on CI
		setTimeout(() => {
			test.equal(appInner.state.plots.length, 1, 'Should create a plot when the active item button is clicked.')
			if (test['_ok']) about.Inner.app.destroy()
			test.end()
		}, 150)
	}
})
