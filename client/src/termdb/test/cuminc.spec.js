const tape = require('tape')
const termjson = require('../../../test/testdata/termjson').termjson
const helpers = require('../../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('termdb', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38'
		//nav: { header_mode: 'with_tabs' }
	},
	debug: 1
})

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- termdb/cuminc -***-')
	test.end()
})

tape('basic cuminc plot', function(test) {
	test.timeoutAfter(2000)
	runpp({
		state: {
			tree: {
				expandedTermIds: [
					'root',
					'Clinically-assessed Variables',
					'ctcae_graded',
					'Cardiovascular System',
					'Arrhythmias',
					'Cardiac dysrhythmia'
				],
				visiblePlotIds: ['Cardiac dysrhythmia'],
				plots: {
					'Cardiac dysrhythmia': {
						term: {
							id: 'Cardiac dysrhythmia',
							term: termjson['Cardiac dysrhythmia'],
							q: { bar_by_grade: true, value_by_max_grade: true }
						},
						settings: {
							currViews: ['cuminc']
						}
					}
				}
			}
		},
		plot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	let cumincDiv
	async function runTests(plot) {
		cumincDiv = plot.Inner.components.cuminc.Inner.dom.chartsDiv
		test.equal(cumincDiv && cumincDiv.selectAll('.sjpcb-cuminc-series').size(), 1, 'should render 1 cuminc series g')
		test.equal(
			cumincDiv && cumincDiv.selectAll('.sjpcb-cuminc-series path').size(),
			2,
			'should render 2 cuminc series paths for estimate line and 95% CI area'
		)
		test.equal(
			cumincDiv && cumincDiv.selectAll('.sjpcb-cuminc-series circle').size(),
			9,
			'should render 9 cuminc series circles'
		)
		test.end()
	}
})
