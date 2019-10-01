const tape = require('tape')
const d3s = require('d3-selection')
const serverconfig = require('../../../serverconfig')
const host = 'http://localhost:' + serverconfig.port
const helpers = require('../../../test/front.helpers.js')

tape('\n', function(test) {
	test.pass('-***- tdb.tree.search -***-')
	test.end()
})

tape('term search', function(test) {
	test.timeoutAfter(1000)
	test.plan(1)

	runproteinpaint({
		host,
		noheader: 1,
		nobox: true,
		termdb: {
			state: {
				dslabel: 'SJLife',
				genome: 'hg38'
			},
			callbacks: {
				search: {
					'postInit.test': testSearch
				}
			},
			debug: 1,
			serverData: helpers.serverData
		},
		serverData: helpers.serverData
	})
	async function testSearch(comp) {
		await comp.Inner.app.dispatch({ type: 'search_', str: 'cardio' })
		comp.Inner.app.on('postRender', () => {
			const table = comp.Inner.dom.resultDiv.select('table').node()
			test.equal(table.childNodes.length, 3, 'should show 3 matching entries')

			testViewButton(table)
			testTreeButton(table)
		})
	}
	function testViewButton(table) {
		// click on the view button of the first term <tr> in table, see if loads
	}
	function testTreeButton(table) {
		// click on the Tree button of first term in table, see if loads
	}
})

// given modifier_click_term, see if search result show as buttons
