import tape from 'tape'
import * as helpers from '../../../test/front.helpers.js'

/*
DO NOT ENABLE THIS FILE ON CI. ITS FOR PROTOTYPING ONLY

Tests:
    - Default correlation volcano plot
	- No featureTw
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
			//Eventually need to add data to TermdbTest
			//and switch dataset and genome
			dslabel: 'ALL-pharmacotyping',
			genome: 'hg38'
		}
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/correlationVolcano -***-')
	test.end()
})

tape('Default correlation volcano', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'correlationVolcano',
					featureTw: {
						term: {
							type: 'geneExpression',
							gene: 'KRAS'
						}
					}
				}
			]
		},
		correlationVolcano: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(correlationVolcano: any) {
		correlationVolcano.on('postRender.test', null)
		const dom = correlationVolcano.Inner.dom

		//Simple rendering tests.
		test.equal(dom.title.text(), 'KRAS Gene Expression', `Should display feature term wrapper name as title`)
		test.equal(
			dom.xAxisLabel.text(),
			'Correlation Coefficient',
			`Should display 'Correlation Coefficient' as x-axis label`
		)
		test.equal(dom.yAxisLabel.text(), '-log10(p value)', `Should display '-log10(p value)' as y-axis label`)

		testPlot(dom.plot)
		testLegend(dom.legend)

		if (test['_ok']) correlationVolcano.Inner.app.destroy()
		test.end()
	}

	function testPlot(plot) {
		const circleNum = plot.selectAll('circle[data-testid^="sjpp-corr-volcano-circle"]').size()
		const expected = 20
		//TODO: Change this when testing termdbtest data
		test.ok(circleNum > expected, `Should display more than ${expected} circles`)
	}

	function testLegend(legend) {
		const legendCircles = legend.selectAll('circle').size()
		const expected = 2
		test.equal(legendCircles, expected, `Should display ${expected} circles in the legend`)
	}
})

tape.skip('No featureTw', test => {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'correlationVolcano'
				}
			]
		},
		correlationVolcano: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(correlationVolcano: any) {
		correlationVolcano.on('postRender.test', null)
		//TODO

		// if (test['_ok']) correlationVolcano.Inner.app.destroy()
		test.end()
	}
})
