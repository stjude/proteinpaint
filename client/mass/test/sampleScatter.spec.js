'use strict'
const tape = require('tape')
const helpers = require('../../test/front.helpers.js')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		vocab: {
			dslabel: 'PNET',
			genome: 'hg19'
		}
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
	test.pass('-***- mass/sampleScatter -***-')
	test.end()
})

tape('initial tests', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE'
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(scatter) {
		console.log('running test...')
		const scatterDiv = scatter.Inner.dom.holder

		testPlot()
		testLegend()
		//testAxisDimension(scatter)
		//test.fail('...')
		if (test._ok) scatter.Inner.app.destroy()
		test.end()

		function testPlot() {
			const serieG = scatterDiv.select('.sjpcb-scatter-series')
			const total = 2882 //For this dataset
			const numSymbols = serieG.selectAll('path').size()
			test.true(numSymbols == total, `There are ${numSymbols} symbols. Should be ${total}`)
		}

		function testLegend() {
			const legendG = scatterDiv.select('.sjpcb-scatter-legend')
			test.true(legendG != null, 'should have a legend')
			test.equal(legendG.select('#legendTitle').text(), 'TSNE Category', 'Should be named as the term')
		}
	}
})
