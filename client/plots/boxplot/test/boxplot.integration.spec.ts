import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'

/*
Tests:
	- Default boxplot
	- Boxplot with overlay term = sex
	- Boxplot with continuous overlay term = agedx
 */

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: {
			header_mode: 'hidden'
		},
		vocab: {
			dslabel: 'TermdbTest',
			genome: 'hg38-test'
		}
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', function (test) {
	test.pass('-***- plots/boxplot -***-')
	test.end()
})

tape('Default boxplot', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'boxplot',
					term: {
						id: 'agedx',
						q: { mode: 'continuous' }
					}
				}
			]
		},
		boxplot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(boxplot) {
		boxplot.on('postRender.test', null)
		const dom = boxplot.Inner.dom
		const config = boxplot.Inner.state.config

		test.equal(dom.plotTitle.text(), config.term.term.name, `Should render ${config.term.term.name} title`)
		test.true(dom.yAxis.select('path'), 'Should render y axis')
		test.equal(dom.boxplots.selectAll("g[id^='sjpp-boxplot-']").size(), 1, 'Should render 1 boxplot')

		if (test['_ok']) boxplot.Inner.app.destroy()
		test.end()
	}
})

tape('Boxplot with overlay term = sex', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'boxplot',
					term: {
						id: 'agedx',
						q: { mode: 'continuous' }
					},
					term2: {
						id: 'sex'
					}
				}
			]
		},
		boxplot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(boxplot) {
		boxplot.on('postRender.test', null)
		const dom = boxplot.Inner.dom
		const config = boxplot.Inner.state.config
		const numValues = Object.keys(config.term2.term.values).length
		test.equal(
			dom.boxplots.selectAll("g[id^='sjpp-boxplot-']").size(),
			numValues,
			`Should render ${numValues} boxplots`
		)

		if (test['_ok']) boxplot.Inner.app.destroy()
		test.end()
	}
})

tape('Boxplot with continuous overlay term = agedx', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'summary',
					childType: 'boxplot',
					term: {
						id: 'sex'
					},
					term2: {
						id: 'agedx',
						q: { mode: 'continuous' }
					}
				}
			]
		},
		boxplot: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(boxplot) {
		boxplot.on('postRender.test', null)
		const dom = boxplot.Inner.dom
		const config = boxplot.Inner.state.config
		const numValues = Object.keys(config.term.term.values).length
		test.equal(
			dom.boxplots.selectAll("g[id^='sjpp-boxplot-']").size(),
			numValues,
			`Should render ${numValues} boxplots`
		)

		if (test['_ok']) boxplot.Inner.app.destroy()
		test.end()
	}
})

// tape.skip('Boxplot with user settings', test => {
// 	//All the settings available to the user
// 	test.timeoutAfter(3000)

// 	const settings = {
// 		boxplotWidth: 550,
// 		color: 'purple',
// 		labelPad: 40,
// 		rowHeight: 30,
// 		rowSpace: 20
// 	}

// 	runpp({
// 		state: {
// 			plots: [
// 				{
// 					chartType: 'summary',
// 					childType: 'boxplot',
// 					term: {
// 						id: 'agedx',
// 						q: { mode: 'continuous' }
// 					},
// 					settings: {
// 						boxplot: settings
// 					}
// 				}
// 			]
// 		},
// 		boxplot: {
// 			callbacks: {
// 				'postRender.test': runTests
// 			}
// 		}
// 	})

// 	async function runTests(boxplot) {
// 		boxplot.on('postRender.test', null)
// 		const dom = boxplot.Inner.dom
// 		const bp = dom.boxplots.selectAll("g[id^='sjpp-boxplot-']")
// 		const lines = bp.selectAll('line').nodes()
// 		test.true(
// 			lines.some(d => {
// 				d.attributes.stroke.value != settings.color
// 			}),
// 			`Should render boxplot with ${settings.color} lines.`
// 		)

// 		if (test['_ok']) boxplot.Inner.app.destroy()
// 		test.end()
// 	}
// })
