import { initGenesetSearch } from '../genesetSearch'
const helpers = require('../../test/front.helpers.js')
const tape = require('tape')
const d3s = require('d3-selection')

function getHolder() {
	return d3s.select('body').append('div')
}

const runpp = helpers.getRunPp('mass', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38-test'
	},
	debug: 1
})

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- dom/geneDictionary -***-')
	test.end()
})

tape('Search genes test', function(test) {
	test.timeoutAfter(3000)

	const holder = getHolder()
	runpp({
		holder, //Fix for test failing because survival & summary sandboxs are not destroyed.
		state: {
			nav: {
				activeTab: 1
			},
			plots: [
				{
					chartType: 'matrix',
					settings: {
						matrix: {
							// the matrix autocomputes the colw based on available screen width,
							// need to set an exact screen width for consistent tests using getBBox()
							availContentWidth: 1200
						}
					},
					termgroups: [
						{
							name: 'Demographics',
							lst: [
								{
									id: 'sex'
									//q: { mode: 'values' } // or 'groupsetting'
								},
								{
									id: 'agedx',
									q: {
										mode: 'discrete',
										type: 'regular-bin',
										bin_size: 5,
										first_bin: {
											startunbounded: true,
											stop: 5,
											stopinclusive: true
										}
									} // or 'continuous'
								}
							]
						}
					]
				}
			]
		},
		matrix: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(scatter) {
		testPlot()
		test.end()

		function testPlot() {
			initGenesetSearch({ holder })
			// test.true(
			// 	numSymbols == scatter.Inner.charts[0].data.samples.length,
			// 	`Should be ${scatter.Inner.charts[0].data.samples.length}. Rendered ${numSymbols} symbols.`
			// )
		}
	}
})
