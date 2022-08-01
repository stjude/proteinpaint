const tape = require('tape')
const helpers = require('../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38'
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- termdb/plot -***-')
	test.end()
})

tape('view click', function(test) {
	test.timeoutAfter(2000)
	test.plan(3)

	runpp({
		state: {
			tree: {
				expandedTermIds: ['root', 'Cancer-related Variables', 'Diagnosis']
			}
		},
		tree: {
			callbacks: {
				'postInit.test': triggerViewClick
			}
		},
		plot: {
			callbacks: {
				'postRender.test': testView
			}
		}
	})

	let tree, term
	function triggerViewClick(_tree) {
		tree = _tree
		setTimeout(() => {
			const viewBtn = tree.Inner.dom.treeDiv.select('.termview')
			term = viewBtn.datum()
			viewBtn.node().click()
		}, 300)
	}

	function testView(plot) {
		test.equal(Object.keys(tree.Inner.components.plots).length, 1, 'should initialize a new plot component')
		test.equal(plot && plot.Inner && plot.Inner.id, term.id, 'should assign the clicked term id as the plot id')
		test.equal(
			plot && plot.Inner && plot.Inner.dom.viz.selectAll('.pp-bars-svg').size(),
			1,
			'should render a barchart view'
		)
		test.end()
	}
})
