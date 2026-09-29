import tape from 'tape'
import { CustomDownloadMenu } from '../CustomDownloadMenu'

/** Tests
 *  - constructor throws when chartImages is missing
 *  - addOption() throws when callback is not a function, otherwise is chainable
 *  - show() renders the standard options plus one row per extraOption
 *  - show() renders only the standard options when there are no extraOptions
 *  - clicking an extra option hides the menu and invokes its callback
 *  - clicking an extra option whose callback throws logs the error instead of throwing
 *  - clicking an extra option whose callback rejects logs the error instead of throwing
 */

/*************************
 reusable helper functions
**************************/

function getChartImages() {
	return [{ name: 'chart1', svg: { node: () => document.createElement('svg') } }]
}

/** dm.menu.dnode is typed as possibly null (d3 selection.node()), but is always
 * set right after `new CustomDownloadMenu()` since the Menu constructor appends it. */
function getDnode(dm: CustomDownloadMenu): HTMLElement {
	return dm.menu.dnode as HTMLElement
}

function getMenuOptionLabels(dm: CustomDownloadMenu) {
	return [...getDnode(dm).querySelectorAll('.sja_menuoption')].map(elem => (elem as HTMLElement).innerText)
}

/** Dispatch a real click event on a node, so that d3's .on('click', ...) handler fires */
function click(node: Element) {
	node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

/*************
 test sections
**************/

tape('\n', test => {
	test.comment('-***- dom/summary/CustomDownloadMenu -***-')
	test.end()
})

tape('new CustomDownloadMenu() throws when chartImages is missing', test => {
	test.timeoutAfter(100)

	test.throws(() => new CustomDownloadMenu({}), /chartImages is required/, 'Should throw when opts.chartImages is missing')
	test.end()
})

tape("addOption() throws when callback is not a function, otherwise is chainable", test => {
	test.timeoutAfter(100)

	const dm = new CustomDownloadMenu({ chartImages: getChartImages() })

	test.throws(
		() => dm.addOption({ label: 'no callback' } as any),
		/callback not function/,
		'Should throw when option.callback is not a function'
	)

	const chained = dm.addOption({ label: 'Extra', callback: () => undefined })
	test.equal(chained, dm, 'Should return the menu instance for chaining')
	test.equal(dm.extraOptions.length, 1, 'Should push the valid option onto extraOptions')

	dm.menu.destroy()
	test.end()
})

tape('show() renders the standard options plus one row per extraOption', test => {
	test.timeoutAfter(100)

	const dm = new CustomDownloadMenu({
		chartImages: getChartImages(),
		extraOptions: [
			{ label: 'Descriptive statistics', testid: 'sjpp-download-descrstats', callback: () => 'stats' },
			{ label: 'Group comparisons', testid: 'sjpp-download-pvalues', callback: () => 'pvalues' }
		]
	})

	dm.show(50, 50)
	const labels = getMenuOptionLabels(dm)

	test.ok(labels.includes('PDF Portrait'), 'Should still render the standard PDF Portrait option')
	test.ok(labels.includes('Descriptive statistics'), 'Should render the first extra option')
	test.ok(labels.includes('Group comparisons'), 'Should render the second extra option')
	test.equal(
		getDnode(dm).querySelectorAll('[data-testid="sjpp-download-descrstats"]').length,
		1,
		'Should set the testid attribute on the extra option'
	)

	dm.menu.destroy()
	test.end()
})

tape('show() renders only the standard options when there are no extraOptions', test => {
	test.timeoutAfter(100)

	const dm = new CustomDownloadMenu({ chartImages: getChartImages() })
	dm.show(50, 50)
	const labels = getMenuOptionLabels(dm)

	test.deepEqual(labels, ['PDF Portrait', 'PDF Landscape', 'SVG'], 'Should render only the standard options')

	dm.menu.destroy()
	test.end()
})

tape('clicking an extra option hides the menu and invokes its callback', test => {
	test.timeoutAfter(100)

	let callCount = 0
	const dm = new CustomDownloadMenu({
		chartImages: getChartImages(),
		extraOptions: [{ label: 'Extra', testid: 'sjpp-test-extra', callback: () => (callCount += 1) && undefined }]
	})
	dm.show(50, 50)

	const optionNode = getDnode(dm).querySelector('[data-testid="sjpp-test-extra"]') as HTMLElement
	test.ok(optionNode, 'Should find the rendered extra option node')

	click(optionNode)

	test.equal(callCount, 1, 'Should invoke the callback once on click')
	test.equal(getDnode(dm).style.display, 'none', 'Should hide the menu on click')

	dm.menu.destroy()
	test.end()
})

tape('clicking an extra option whose callback throws logs the error instead of throwing', test => {
	test.timeoutAfter(100)

	const origConsoleError = console.error
	let loggedMessage = ''
	console.error = (msg: string) => {
		loggedMessage = msg
	}

	const dm = new CustomDownloadMenu({
		chartImages: getChartImages(),
		extraOptions: [
			{
				label: 'Extra',
				testid: 'sjpp-test-throw',
				callback: () => {
					throw new Error('boom')
				}
			}
		]
	})
	dm.show(50, 50)
	const optionNode = getDnode(dm).querySelector('[data-testid="sjpp-test-throw"]') as HTMLElement

	test.doesNotThrow(() => click(optionNode), 'Should not let a synchronous callback error propagate out of the click handler')
	test.ok(loggedMessage.includes('boom'), 'Should log the error message via console.error')

	console.error = origConsoleError
	dm.menu.destroy()
	test.end()
})

tape('clicking an extra option whose callback rejects logs the error instead of throwing', async test => {
	test.timeoutAfter(500)

	const origConsoleError = console.error
	let loggedMessage = ''
	console.error = (msg: string) => {
		loggedMessage = msg
	}

	const dm = new CustomDownloadMenu({
		chartImages: getChartImages(),
		extraOptions: [
			{
				label: 'Extra',
				testid: 'sjpp-test-reject',
				callback: () => Promise.reject(new Error('async boom'))
			}
		]
	})
	dm.show(50, 50)
	const optionNode = getDnode(dm).querySelector('[data-testid="sjpp-test-reject"]') as HTMLElement

	click(optionNode)
	// let the rejected promise's catch handler run
	await new Promise(resolve => setTimeout(resolve, 0))

	test.ok(loggedMessage.includes('async boom'), 'Should log the rejected promise error via console.error')

	console.error = origConsoleError
	dm.menu.destroy()
	test.end()
})
