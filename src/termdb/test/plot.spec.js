const tape = require('tape')
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
  state: {
      dslabel: 'SJLife',
      genome: 'hg38'
  },
  debug: 1,
  fetchOpts: {
  	serverData: helpers.serverData
  }
})

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- tdb.tree -***-')
	test.end()
})

tape('view click', function(test) {
	test.timeoutAfter(2000)
	test.plan(3)

	runpp({
		state: {
			tree: {
				expandedTerms: ['root', 'Cancer-related Variables', 'Diagnosis']
			}
		},
		callbacks: {
			tree: {
				'postInit.test': runTests
			}
		}
	})

	function runTests(tree) {
		tree.on('postInit.test', null)
		helpers
			.rideInit({
				bus: tree,
				eventType: 'postNotify.test',
				arg: tree
			})
			.run(triggerViewClick, 100)
			.run(testAction, 600)
			.done(() => test.end())
	}

	function triggerViewClick(tree) {
		tree.Inner.dom.holder
			.select('.termview')
			.node()
			.click()
	}

	function testAction(tree) {
		test.equal(Object.keys(tree.Inner.components.plots).length, 1, 'should initialize a new plot component')

		const term = tree.Inner.dom.holder.select('.termview').datum()
		const plot = tree.Inner.components.plots[term.id]
		test.equal(plot && plot.Inner && plot.Inner.id, term.id, 'should assign the clicked term id as the plot id')

		test.equal(
			plot && plot.Inner && plot.Inner.dom.viz.selectAll('.pp-bars-svg').size(),
			1,
			'should render a barchart view'
		)
	}
})
